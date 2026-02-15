"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Patient, PatientStatus, LogEntry } from "@/lib/types";
import { Column } from "./Column";
import { BedGrid } from "./BedGrid";
import { PatientModal } from "./PatientModal";
import { usePatientContext } from "@/context/PatientContext";

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
    <div className="flex flex-col items-center justify-center w-14 shrink-0 select-none gap-1">
      <span className="text-[9px] font-mono font-medium text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <svg width="56" height="12" viewBox="0 0 56 12" fill="none" className="overflow-visible">
        {/* Static base line */}
        <line x1="0" y1="6" x2="48" y2="6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" />
        {/* Animated marching dots */}
        {active && (
          <line
            x1="0" y1="6" x2="48" y2="6"
            stroke="#34d399"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="3 8"
            className="flow-march"
          />
        )}
        {/* Arrowhead */}
        <path d="M46 2l6 4-6 4" stroke={active ? "#34d399" : "#d1d5db"} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function HospitalBoundary({ children, isRunning }: { children: React.ReactNode; isRunning: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pathD, setPathD] = useState("");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [labelPos, setLabelPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      if (!c) return;

      const left = c.querySelector<HTMLElement>("[data-wing='left']");
      const right = c.querySelector<HTMLElement>("[data-wing='right']");
      if (!left || !right) return;

      const cRect = c.getBoundingClientRect();
      const lRect = left.getBoundingClientRect();
      const rRect = right.getBoundingClientRect();

      const W = cRect.width;
      const H = cRect.height;
      setSize({ w: W, h: H });

      const R = 12;

      // Left wing bounds (relative to container)
      const lT = lRect.top - cRect.top;
      const lB = lRect.bottom - cRect.top;
      const lL = 0;
      const lR = lRect.right - cRect.left;

      // Right wing bounds
      const rT = 0;
      const rB = H;
      const rR = W;

      // Junction x where wings meet
      const jx = lR;

      setLabelPos({ x: lL + 16, y: lT - 2 });

      // Draw single L-shape path clockwise from top-left of left wing
      const d = [
        `M ${lL + R} ${lT}`,
        // Top of left wing → junction
        `L ${jx - R} ${lT}`,
        // Concave corner: turn up toward right wing top
        `Q ${jx} ${lT} ${jx} ${lT - R}`,
        `L ${jx} ${rT + R}`,
        // Top-left corner of right wing (convex)
        `Q ${jx} ${rT} ${jx + R} ${rT}`,
        // Top edge of right wing
        `L ${rR - R} ${rT}`,
        // Top-right corner
        `Q ${rR} ${rT} ${rR} ${rT + R}`,
        // Right edge
        `L ${rR} ${rB - R}`,
        // Bottom-right corner
        `Q ${rR} ${rB} ${rR - R} ${rB}`,
        // Bottom of right wing → junction
        `L ${jx + R} ${rB}`,
        // Bottom-left corner of right wing (convex)
        `Q ${jx} ${rB} ${jx} ${rB - R}`,
        // Concave corner: turn left toward left wing bottom
        `L ${jx} ${lB + R}`,
        `Q ${jx} ${lB} ${jx - R} ${lB}`,
        // Bottom of left wing
        `L ${lL + R} ${lB}`,
        // Bottom-left corner
        `Q ${lL} ${lB} ${lL} ${lB - R}`,
        // Left edge
        `L ${lL} ${lT + R}`,
        // Back to start
        `Q ${lL} ${lT} ${lL + R} ${lT}`,
        "Z",
      ].join(" ");

      setPathD(d);
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* SVG border */}
      {pathD && (
        <svg
          className="absolute inset-0 pointer-events-none z-0"
          width={size.w}
          height={size.h}
          fill="white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={pathD} fill="white" stroke="rgba(16,185,129,0.25)" strokeWidth="1" />
        </svg>
      )}
      {/* Hospital label */}
      <div
        className="absolute px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-emerald-600/70 bg-white border border-emerald-500/25 rounded z-20"
        style={{ left: labelPos.x, top: labelPos.y, transform: "translateY(-50%)" }}
      >
        Hospital
      </div>
      {/* Content */}
      <div className="relative z-10 flex items-center">
        {children}
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
  const { appMode, setBaselineSelectedPid } = usePatientContext();
  const isBaseline = appMode === "baseline";

  const waitTimes = useMemo(() => {
    const map = new Map<string, Date>();
    for (const entry of eventLog) {
      if (!map.has(entry.pid)) {
        map.set(entry.pid, entry.timestamp);
      }
    }
    return map;
  }, [eventLog]);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const handlePatientClick = useCallback((patient: Patient) => {
    if (isBaseline && patient.status === "waiting_room") return;
    setSelectedPatient(patient);
    if (isBaseline) {
      setBaselineSelectedPid(patient.pid);
    }
  }, [isBaseline, setBaselineSelectedPid]);

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
      <div ref={containerRef} className="w-full h-full overflow-hidden grid-bg">
        <div className="w-full h-full flex items-center justify-center">
          <div
            ref={contentRef}
            className="flex gap-3 items-center px-4 py-4 origin-center"
            style={{ transform: `scale(${scale})` }}
          >
            {/* Called In / Walked In */}
            <div className="w-[230px] shrink-0">
              <Column
                title={isBaseline ? "Walked In" : "Called In"}
                patients={byStatus(patients, "called_in")}
                onPatientClick={handlePatientClick}
                accentColor="border-l-gray-500/30"
                waitTimes={waitTimes}
                titleColor="text-slate-500"
                icon={isBaseline
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M7 21l3-7 2.5 2V21h2v-6.5l-2.5-2 .5-3c1.5 1.5 3.5 2.5 6 2.5v-2c-2 0-3.5-1-4.5-2.5l-1-1.5c-.5-.5-1-1-1.5-1s-1 0-1.5.5L6 10v4h2V11l1.5-1L7 21z"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>}
              />
            </div>

            <FlowArrow label="Triage" active={isRunning} />

            {/* Hospital boundary — single irregular SVG border */}
            <HospitalBoundary isRunning={isRunning}>
              {/* Left wing — Waiting Room */}
              <div data-wing="left" className="pt-5 pb-3 px-4">
                <div className="w-[230px] shrink-0">
                  <Column
                    title="Waiting Room"
                    patients={byStatus(patients, "waiting_room")}
                    onPatientClick={handlePatientClick}
                    accentColor="border-l-amber-500/40"
                    waitTimes={waitTimes}
                    showEsi
                    overduePids={overdueWaitPids}
                    titleColor="text-amber-600"
                    icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                  />
                </div>
              </div>

              {/* Right wing — Beds + Disposition */}
              <div data-wing="right" className="pt-5 pb-3 pr-4 pl-2 flex items-center gap-3">
                <FlowArrow label="Assign" active={isRunning} />

                <div className="flex flex-col gap-2">
                  <BedGrid
                    patients={byStatus(patients, "er_bed")}
                    onPatientClick={handlePatientClick}
                    waitTimes={waitTimes}
                  />
                  {/* Disposition sub-lanes */}
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[9px] font-mono font-medium text-muted-foreground/60 uppercase tracking-widest px-1">
                      Disposition
                    </div>
                    <div className="flex gap-1">
                      <Column
                        title="OR"
                        patients={byStatus(patients, "or")}
                        onPatientClick={handlePatientClick}
                        accentColor="border-l-orange-500/40"
                        titleColor="text-orange-600"
                        className="flex-1"
                        compact
                        waitTimes={waitTimes}
                      />
                      <Column
                        title="ICU"
                        patients={byStatus(patients, "icu")}
                        onPatientClick={handlePatientClick}
                        accentColor="border-l-purple-500/40"
                        titleColor="text-purple-600"
                        className="flex-1"
                        compact
                        waitTimes={waitTimes}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </HospitalBoundary>

            <FlowArrow label="Discharge" active={isRunning} />

            {/* Done */}
            <div className="w-[230px] shrink-0">
              <Column
                title="Done"
                patients={byStatus(patients, "discharge", "done")}
                onPatientClick={handlePatientClick}
                accentColor="border-l-emerald-500/40"
                waitTimes={waitTimes}
                titleColor="text-emerald-600"
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
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
