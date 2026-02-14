"use client";

import { createContext, useContext, useEffect, useRef, useCallback, useState, ReactNode } from "react";
import { Patient, SimState, LogEntry, LogEventType } from "@/lib/types";
import { usePatients } from "@/hooks/usePatients";
import { useSimulation } from "@/hooks/useSimulation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { injectPatient, stopSim } from "@/lib/api";

function findNextAvailableBed(patients: Patient[]): number | null {
  const occupied = new Set(
    patients.filter((p) => p.bed_number).map((p) => p.bed_number)
  );
  for (let i = 1; i <= 16; i++) {
    if (!occupied.has(i)) return i;
  }
  return null;
}

interface PatientContextValue {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  addPatient: (patient: Patient) => void;
  updatePatient: (pid: string, changes: Partial<Patient>, version?: number) => void;
  removePatient: (pid: string) => void;
  acceptPatient: (pid: string) => Promise<void>;
  assignBed: (pid: string, bedNumber: number) => Promise<void>;
  flagForDischarge: (pid: string) => void;
  dischargePatient: (pid: string) => Promise<void>;
  markDone: (pid: string) => Promise<void>;
  simState: SimState;
  setSimState: React.Dispatch<React.SetStateAction<SimState>>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setMode: (mode: SimState["mode"]) => Promise<void>;
  tick: () => void;
  resetSim: () => Promise<void>;
  injectNewPatient: () => Promise<void>;
  eventLog: LogEntry[];
}

const PatientContext = createContext<PatientContextValue | null>(null);

let logIdCounter = 0;

export function PatientProvider({ children }: { children: ReactNode }) {
  const patientHook = usePatients();
  const simHook = useSimulation();
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);

  const addLogEntry = useCallback((pid: string, patientName: string, event: LogEventType, tick: number) => {
    const entry: LogEntry = {
      id: String(++logIdCounter),
      pid,
      patientName,
      event,
      timestamp: new Date(),
      tick,
    };
    setEventLog((prev) => [...prev, entry]);
  }, []);

  useWebSocket({
    addPatient: patientHook.addPatient,
    updatePatient: patientHook.updatePatient,
    setSimState: simHook.setSimState,
  });

  // --- Simulation engine (runs globally across all pages) ---

  const patientsRef = useRef(patientHook.patients);
  patientsRef.current = patientHook.patients;
  const modeRef = useRef(simHook.simState.mode);
  modeRef.current = simHook.simState.mode;
  const tickRef = useRef(simHook.simState.current_tick);
  tickRef.current = simHook.simState.current_tick;

  const addLogEntryRef = useRef(addLogEntry);
  addLogEntryRef.current = addLogEntry;

  const dischargeTimers = useRef<Map<string, number>>(new Map());

  const simTick = useCallback(() => {
    simHook.tick();
    const current = patientsRef.current;
    const mode = modeRef.current;
    const currentTick = tickRef.current + 1;

    const advanceable: { pid: string; action: () => void }[] = [];

    for (const p of current) {
      // Check for surprising lab results arriving this tick — turn patient red
      if (p.status === "er_bed" && p.color !== "red" && p.color !== "green" && p.lab_results) {
        const hasSurprise = p.lab_results.some(
          (lab) => lab.is_surprising && lab.arrives_at_tick <= currentTick
        );
        if (hasSurprise) {
          patientHook.updatePatient(p.pid, { color: "red" });
          addLogEntryRef.current(p.pid, p.name, "turned_red", currentTick);
          dischargeTimers.current.delete(p.pid);
          continue;
        }
      }

      // Both semi-auto and full-auto: called_in → waiting_room → er_bed
      if (p.status === "called_in") {
        advanceable.push({ pid: p.pid, action: () => {
          patientHook.acceptPatient(p.pid);
          addLogEntryRef.current(p.pid, p.name, "accepted", currentTick);
        }});
      } else if (p.status === "waiting_room") {
        const bed = findNextAvailableBed(current);
        if (bed !== null) {
          advanceable.push({
            pid: p.pid,
            action: () => {
              patientHook.assignBed(p.pid, bed);
              addLogEntryRef.current(p.pid, p.name, "assigned_bed", currentTick);
            },
          });
        }
      }

      // Semi-auto and full-auto: flag for discharge after a random delay
      if (p.status === "er_bed" && p.color !== "green") {
        if (!dischargeTimers.current.has(p.pid)) {
          const delay = p.color === "red"
            ? Math.floor(Math.random() * 11) + 8
            : Math.floor(Math.random() * 9) + 4;
          dischargeTimers.current.set(p.pid, currentTick + delay);
        }
        const readyAt = dischargeTimers.current.get(p.pid)!;
        if (currentTick >= readyAt) {
          advanceable.push({
            pid: p.pid,
            action: () => {
              patientHook.flagForDischarge(p.pid);
              addLogEntryRef.current(p.pid, p.name, "flagged_discharge", currentTick);
              dischargeTimers.current.delete(p.pid);
            },
          });
        }
      }

      // Full-auto only: green er_bed patients get discharged to done
      if (mode === "full-auto") {
        if (p.status === "er_bed" && p.color === "green") {
          advanceable.push({
            pid: p.pid,
            action: () => {
              patientHook.dischargePatient(p.pid);
              addLogEntryRef.current(p.pid, p.name, "discharged", currentTick);
            },
          });
        }
        if (p.status === "or" || p.status === "icu") {
          advanceable.push({
            pid: p.pid,
            action: () => {
              patientHook.markDone(p.pid);
              addLogEntryRef.current(p.pid, p.name, "marked_done", currentTick);
            },
          });
        }
      }
    }

    if (advanceable.length > 0) {
      const pick = advanceable[Math.floor(Math.random() * advanceable.length)];
      pick.action();
    }

    // Occasionally inject a new patient
    if (Math.random() < 0.25) {
      injectPatient().then(({ patient }) => {
        patientHook.addPatient(patient);
        addLogEntryRef.current(patient.pid, patient.name, "called_in", currentTick);
      });
    }
  }, [simHook.tick, patientHook]);

  // Simulation interval — runs in semi-auto and full-auto, not manual
  useEffect(() => {
    if (!simHook.simState.is_running || simHook.simState.mode === "manual") return;

    const intervalMs = 1500 / simHook.simState.speed_multiplier;
    const id = setInterval(simTick, intervalMs);
    return () => clearInterval(id);
  }, [simHook.simState.is_running, simHook.simState.mode, simHook.simState.speed_multiplier, simTick]);

  const resetSim = useCallback(async () => {
    await stopSim();
    simHook.setSimState({
      current_tick: 0,
      speed_multiplier: simHook.simState.speed_multiplier,
      mode: simHook.simState.mode,
      is_running: false,
    });
    patientHook.setPatients([]);
    dischargeTimers.current.clear();
    setEventLog([]);
  }, [simHook, patientHook]);

  const injectNewPatient = useCallback(async () => {
    const { patient } = await injectPatient();
    patientHook.addPatient(patient);
    addLogEntry(patient.pid, patient.name, "called_in", tickRef.current);
  }, [patientHook, addLogEntry]);

  const value: PatientContextValue = {
    ...patientHook,
    simState: simHook.simState,
    setSimState: simHook.setSimState,
    start: simHook.start,
    stop: simHook.stop,
    setSpeed: simHook.setSpeed,
    setMode: simHook.setMode,
    tick: simHook.tick,
    resetSim,
    injectNewPatient,
    eventLog,
  };

  return (
    <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
  );
}

export function usePatientContext() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatientContext must be used within PatientProvider");
  return ctx;
}
