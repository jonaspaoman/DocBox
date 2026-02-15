"use client";

import { useState, useCallback, useMemo } from "react";
import { Patient, PatientStatus, LogEntry } from "@/lib/types";
import { Column } from "./Column";
import { BedGrid } from "./BedGrid";
import { PatientModal } from "./PatientModal";

interface BoardProps {
  patients: Patient[];
  currentTick: number;
  onAccept: (pid: string) => void;
  onAssignBed: (pid: string, bedNumber: number) => void;
  onFlagDischarge: (pid: string) => void;
  onDischarge: (pid: string) => void;
  onMarkDone: (pid: string) => void;
  eventLog?: LogEntry[];
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

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center w-8 shrink-0 select-none">
      <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider whitespace-nowrap -rotate-90 mb-2">
        {label}
      </span>
      <div className="w-px flex-1 border-l border-dashed border-muted-foreground/15" />
      <span className="text-muted-foreground/20 text-xs mt-1">&rsaquo;</span>
    </div>
  );
}

export function Board({
  patients,
  currentTick,
  onAccept,
  onAssignBed,
  onFlagDischarge,
  onDischarge,
  onMarkDone,
  eventLog = [],
}: BoardProps) {
  // Build a map of pid → earliest arrival time from the event log
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

  return (
    <>
      <div className="flex gap-0 flex-1 px-4 py-4 overflow-auto items-center justify-center grid-bg">
        {/* Called In */}
        <div className="w-[180px] shrink-0">
          <Column
            title="Called In"
            patients={byStatus(patients, "called_in")}
            onPatientClick={handlePatientClick}
            accentColor="border-l-gray-500/30"
            waitTimes={waitTimes}
          />
        </div>

        <FlowArrow label="Triage" />

        {/* Waiting Room */}
        <div className="w-[180px] shrink-0">
          <Column
            title="Waiting Room"
            patients={byStatus(patients, "waiting_room")}
            onPatientClick={handlePatientClick}
            accentColor="border-l-amber-500/40"
            waitTimes={waitTimes}
            showEsi
          />
        </div>

        <FlowArrow label="Assign" />

        {/* Hospital boundary */}
        <div className="relative bg-[oklch(0.14_0_0)] rounded-lg p-3 border border-emerald-500/15 flex flex-col gap-3">
          <div className="absolute -top-2.5 left-3 px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-[0.2em] text-emerald-500/50 bg-[oklch(0.14_0_0)] border border-emerald-500/15 rounded">
            Hospital
          </div>
          <BedGrid
            patients={byStatus(patients, "er_bed")}
            onPatientClick={handlePatientClick}
            waitTimes={waitTimes}
          />
          {/* Disposition sub-lanes — side by side below beds */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[9px] font-mono font-medium text-muted-foreground/50 uppercase tracking-widest px-1">
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

        <FlowArrow label="Discharge" />

        {/* Done */}
        <div className="w-[180px] shrink-0">
          <Column
            title="Done"
            patients={byStatus(patients, "discharge", "done")}
            onPatientClick={handlePatientClick}
            accentColor="border-l-emerald-500/40"
            waitTimes={waitTimes}
          />
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
