"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Patient, PatientStatus, LogEntry } from "@/lib/types";
import { Column } from "./Column";
import { BedGrid } from "./BedGrid";
import { PatientModal } from "./PatientModal";

interface BoardProps {
  patients: Patient[];
  currentTick: number;
  isRunning?: boolean;
  onAccept: (pid: string) => void;
  onAssignBed: (pid: string, bedNumber: number) => void;
  onFlagDischarge: (pid: string) => void;
  onDischarge: (pid: string) => void;
  onMarkDone: (pid: string) => void;
  eventLog?: LogEntry[];
  overdueWaitPids?: Set<string>;
}

function byStatus(patients: Patient[], ...statuses: PatientStatus[]) {
  return patients.filter((p) => statuses.includes(p.status));
}

function findNextAvailableBed(patients: Patient[]): number | null {
  const occupied = new Set(patients.filter((p) => p.bed_number).map((p) => p.bed_number));
  for (let i = 1; i <= 16; i++) {
    if (!occupied.has(i)) return i;
  }
  return null;
}

function FlowArrow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center w-24 shrink-0 select-none gap-2">
      <span className="text-[11px] font-mono font-medium text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="relative w-full h-6 flex items-center">
        {/* Track line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-gray-300 rounded-full" />
        {/* Animated chevrons — only when running */}
        {active && (
          <div className="absolute inset-x-0 top-0 bottom-0 overflow-hidden">
            <svg className="flow-chevron absolute top-1/2 -translate-y-1/2 text-emerald-500" width="7" height="10" viewBox="0 0 7 10"><path d="M1 1l4.5 4L1 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <svg className="flow-chevron-2 absolute top-1/2 -translate-y-1/2 text-emerald-500" width="7" height="10" viewBox="0 0 7 10"><path d="M1 1l4.5 4L1 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <svg className="flow-chevron-3 absolute top-1/2 -translate-y-1/2 text-emerald-500" width="7" height="10" viewBox="0 0 7 10"><path d="M1 1l4.5 4L1 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        )}
        {/* Arrow tip */}
        <svg className={`absolute -right-1 top-1/2 -translate-y-1/2 ${active ? "text-emerald-400" : "text-gray-300"}`} width="10" height="12" viewBox="0 0 10 12">
          <path d="M2 2l5 4-5 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function useScaleToFit(containerRef: React.RefObject<HTMLDivElement | null>, contentRef: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const compute = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const contentW = content.scrollWidth;
      const contentH = content.scrollHeight;
      if (contentW === 0 || contentH === 0) return;
      const s = Math.min(cw / contentW, ch / contentH, 1);
      setScale(s);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    ro.observe(content);
    return () => ro.disconnect();
  }, [containerRef, contentRef]);

  return scale;
}

export function Board({
  patients,
  currentTick,
  isRunning = false,
  onAccept,
  onAssignBed,
  onFlagDischarge,
  onDischarge,
  onMarkDone,
  eventLog = [],
  overdueWaitPids,
}: BoardProps) {
  const waitTimes = useMemo(() => {
    const map = new Map<string, Date>();
    for (const entry of eventLog) {
      if (entry.event === "called_in" && !map.has(entry.pid)) {
        map.set(entry.pid, entry.timestamp);
      }
    }
    return map;
  }, [eventLog]);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const handlePatientClick = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
  }, []);

  const bedsAvailable = findNextAvailableBed(patients) !== null;

  const handleAssignBed = useCallback(
    (pid: string) => {
      const bed = findNextAvailableBed(patients);
      if (bed !== null) onAssignBed(pid, bed);
    },
    [patients, onAssignBed]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scale = useScaleToFit(containerRef, contentRef);

  return (
    <>
      <div ref={containerRef} className="flex-1 overflow-hidden grid-bg">
        <div className="w-full h-full flex items-center justify-center">
          <div
            ref={contentRef}
            className="flex gap-4 items-center px-8 py-8 origin-center"
            style={{ transform: `scale(${scale})` }}
          >
            {/* Called In */}
            <div className="w-[260px] shrink-0">
              <Column
                title="Called In"
                patients={byStatus(patients, "called_in")}
                onPatientClick={handlePatientClick}
                accentColor="border-l-gray-500/30"
                waitTimes={waitTimes}
              />
            </div>

            <FlowArrow label="Triage" active={isRunning} />

            {/* Waiting Room */}
            <div className="w-[260px] shrink-0">
              <Column
                title="Waiting Room"
                patients={byStatus(patients, "waiting_room")}
                onPatientClick={handlePatientClick}
                accentColor="border-l-amber-500/40"
                waitTimes={waitTimes}
                showEsi
                overduePids={overdueWaitPids}
              />
            </div>

            <FlowArrow label="Assign" active={isRunning} />

            {/* Hospital boundary */}
            <div className="relative bg-white rounded-xl p-4 border border-emerald-500/25 flex flex-col gap-4">
              <div className="absolute -top-3 left-4 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-emerald-600/70 bg-white border border-emerald-500/25 rounded-md">
                Hospital
              </div>
              <BedGrid
                patients={byStatus(patients, "er_bed")}
                onPatientClick={handlePatientClick}
                waitTimes={waitTimes}
              />
              {/* Disposition sub-lanes — side by side below beds */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-mono font-medium text-muted-foreground/60 uppercase tracking-widest px-1">
                  Disposition
                </div>
                <div className="flex gap-2">
                  <Column
                    title="OR"
                    patients={byStatus(patients, "or")}
                    onPatientClick={handlePatientClick}
                    accentColor="border-l-orange-500/40"
                    className="flex-1"
                    compact
                    waitTimes={waitTimes}
                  />
                  <Column
                    title="ICU"
                    patients={byStatus(patients, "icu")}
                    onPatientClick={handlePatientClick}
                    accentColor="border-l-purple-500/40"
                    className="flex-1"
                    compact
                    waitTimes={waitTimes}
                  />
                </div>
              </div>
            </div>

            <FlowArrow label="Discharge" active={isRunning} />

            {/* Done */}
            <div className="w-[260px] shrink-0">
              <Column
                title="Done"
                patients={byStatus(patients, "discharge", "done")}
                onPatientClick={handlePatientClick}
                accentColor="border-l-emerald-500/40"
                waitTimes={waitTimes}
              />
            </div>
          </div>
        </div>
      </div>

      <PatientModal
        patient={selectedPatient}
        open={selectedPatient !== null}
        onClose={() => setSelectedPatient(null)}
        currentTick={currentTick}
        onAccept={onAccept}
        onAssignBed={bedsAvailable ? handleAssignBed : undefined}
        onFlagDischarge={onFlagDischarge}
        onDischarge={onDischarge}
        onMarkDone={onMarkDone}
        eventLog={eventLog}
      />
    </>
  );
}
