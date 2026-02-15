"use client";

import { createContext, useContext, useEffect, useRef, useCallback, useState, useMemo, ReactNode } from "react";
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

export type AppMode = "docbox" | "baseline";

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
  acknowledgeLab: (pid: string) => void;
  overdueWaitPids: Set<string>;
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
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  baselineSelectedPid: string | null;
  setBaselineSelectedPid: (pid: string | null) => void;
  /** Raw patients (before baseline color override) for sidebar file viewer */
  rawPatients: Patient[];
}

const PatientContext = createContext<PatientContextValue | null>(null);

let logIdCounter = 0;

export function PatientProvider({ children }: { children: ReactNode }) {
  const patientHook = usePatients();
  const simHook = useSimulation();
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const [appMode, setAppMode] = useState<AppMode>("docbox");
  const [baselineSelectedPid, setBaselineSelectedPid] = useState<string | null>(null);

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
  const appModeRef = useRef(appMode);
  appModeRef.current = appMode;

  const addLogEntryRef = useRef(addLogEntry);
  addLogEntryRef.current = addLogEntry;

  const dischargeTimers = useRef<Map<string, number>>(new Map());
  const waitTimers = useRef<Map<string, number>>(new Map());

  const simTick = useCallback(() => {
    simHook.tick();
    const current = patientsRef.current;
    const mode = modeRef.current;
    const currentTick = tickRef.current + 1;

    const advanceable: { pid: string; action: () => void }[] = [];
    const waitingCandidates: Patient[] = [];

    for (const p of current) {
      // Check for surprising lab results arriving this tick — turn patient red (skip in baseline)
      if (appModeRef.current === "docbox" && p.status === "er_bed" && p.color !== "red" && p.color !== "green" && p.lab_results) {
        const hasSurprise = p.lab_results.some(
          (lab) => lab.is_surprising && !lab.acknowledged && lab.arrives_at_tick <= currentTick
        );
        if (hasSurprise) {
          patientHook.updatePatient(p.pid, { color: "red" });
          addLogEntryRef.current(p.pid, p.name, "turned_red", currentTick);
          dischargeTimers.current.delete(p.pid);
          continue;
        }
      }

      // called_in → waiting_room (auto in all modes except manual and nurse-manual)
      // In baseline mode, never auto-accept — nurse must manually accept
      const autoAccept = appModeRef.current !== "baseline" && mode !== "manual" && mode !== "nurse-manual";
      if (p.status === "called_in" && autoAccept) {
        advanceable.push({ pid: p.pid, action: () => {
          patientHook.acceptPatient(p.pid);
          addLogEntryRef.current(p.pid, p.name, "accepted", currentTick);
        }});
      }

      // Waiting room: track wait time for priority
      if (p.status === "waiting_room") {
        if (!waitTimers.current.has(p.pid)) {
          const threshold = Math.floor(Math.random() * 8) + 18; // 18-25 ticks
          waitTimers.current.set(p.pid, currentTick + threshold);
        }
        waitingCandidates.push(p);
      } else {
        waitTimers.current.delete(p.pid);
      }

      // Flag for discharge after a delay (auto in all modes except manual)
      // Block discharge flagging for red patients until lab is acknowledged
      if (mode !== "manual" && p.status === "er_bed" && p.color !== "green" && !(p.color === "red" && !p.lab_acknowledged)) {
        if (!dischargeTimers.current.has(p.pid)) {
          const delay = p.time_to_discharge
            ?? Math.floor(Math.random() * 9) + 4;
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

      // Auto-discharge green patients + mark OR/ICU done (auto and nurse-manual)
      const autoDischarge = mode === "auto" || mode === "nurse-manual";
      if (autoDischarge) {
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

    // Assign beds: overdue patients get immediate priority (guaranteed), others go in the random pool
    // In baseline mode, assign all waiting patients to beds immediately
    if (waitingCandidates.length > 0) {
      if (appModeRef.current === "baseline") {
        // Baseline: assign all waiting patients immediately
        for (const candidate of waitingCandidates) {
          const bed = findNextAvailableBed(current);
          if (bed !== null) {
            patientHook.assignBed(candidate.pid, bed);
            addLogEntryRef.current(candidate.pid, candidate.name, "assigned_bed", currentTick);
          }
        }
      } else {
        waitingCandidates.sort((a, b) => {
          const aOverdue = (waitTimers.current.get(a.pid) ?? Infinity) <= currentTick ? 0 : 1;
          const bOverdue = (waitTimers.current.get(b.pid) ?? Infinity) <= currentTick ? 0 : 1;
          if (aOverdue !== bOverdue) return aOverdue - bOverdue;
          return (a.esi_score ?? 5) - (b.esi_score ?? 5);
        });
        const top = waitingCandidates[0];
        const isOverdue = (waitTimers.current.get(top.pid) ?? Infinity) <= currentTick;
        const bed = findNextAvailableBed(current);
        if (bed !== null) {
          if (isOverdue) {
            // Overdue patients get assigned immediately — not randomly
            patientHook.assignBed(top.pid, bed);
            addLogEntryRef.current(top.pid, top.name, "assigned_bed", currentTick);
          } else {
            advanceable.push({
              pid: top.pid,
              action: () => {
                patientHook.assignBed(top.pid, bed);
                addLogEntryRef.current(top.pid, top.name, "assigned_bed", currentTick);
              },
            });
          }
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

  // Simulation interval — runs in all modes when simulation is active
  useEffect(() => {
    if (!simHook.simState.is_running) return;

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
    waitTimers.current.clear();
    setEventLog([]);
  }, [simHook, patientHook]);

  const injectNewPatient = useCallback(async () => {
    const { patient } = await injectPatient();
    patientHook.addPatient(patient);
    addLogEntry(patient.pid, patient.name, "called_in", tickRef.current);
  }, [patientHook, addLogEntry]);

  // Wrap discharge/done actions so they always log events
  const dischargePatientWithLog = useCallback(async (pid: string) => {
    const p = patientsRef.current.find((pt) => pt.pid === pid);
    await patientHook.dischargePatient(pid);
    if (p) addLogEntry(pid, p.name, "discharged", tickRef.current);
  }, [patientHook, addLogEntry]);

  const markDoneWithLog = useCallback(async (pid: string) => {
    const p = patientsRef.current.find((pt) => pt.pid === pid);
    await patientHook.markDone(pid);
    if (p) addLogEntry(pid, p.name, "marked_done", tickRef.current);
  }, [patientHook, addLogEntry]);

  const acknowledgeLab = useCallback((pid: string) => {
    const p = patientsRef.current.find((pt) => pt.pid === pid);
    const updatedLabs = p?.lab_results?.map((lab) =>
      lab.is_surprising ? { ...lab, acknowledged: true } : lab
    );
    patientHook.updatePatient(pid, {
      lab_acknowledged: true,
      color: p?.is_simulated === false ? "yellow" : "grey",
      ...(updatedLabs ? { lab_results: updatedLabs } : {}),
    });
    dischargeTimers.current.delete(pid);
  }, [patientHook]);

  // Poll for real Vapi patients
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/vapi-patient");
        if (!res.ok) return;
        const patients: Patient[] = await res.json();
        for (const p of patients) {
          patientHook.addPatient(p);
          addLogEntry(p.pid, p.name, "called_in", tickRef.current);
        }
      } catch {
        // Silently ignore fetch errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [patientHook, addLogEntry]);

  // Compute which waiting room patient is overdue (max 1) — empty in baseline
  const overdueWaitPids = useMemo(() => {
    if (appMode === "baseline") return new Set<string>();
    const tick = simHook.simState.current_tick;
    let oldestPid: string | null = null;
    let oldestThreshold = Infinity;
    for (const [pid, threshold] of waitTimers.current.entries()) {
      if (tick >= threshold && threshold < oldestThreshold) {
        oldestPid = pid;
        oldestThreshold = threshold;
      }
    }
    const set = new Set<string>();
    if (oldestPid) set.add(oldestPid);
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simHook.simState.current_tick, patientHook.patients, appMode]);

  // In baseline mode, override all patient colors to grey
  const exposedPatients = useMemo(() => {
    if (appMode === "baseline") {
      return patientHook.patients.map((p) => ({ ...p, color: "grey" as const }));
    }
    return patientHook.patients;
  }, [appMode, patientHook.patients]);

  // In baseline mode, flagForDischarge skips setting color to green
  const flagForDischargeWrapped = useCallback((pid: string) => {
    if (appMode === "baseline") {
      patientHook.setPatients((prev) =>
        prev.map((p) =>
          p.pid === pid
            ? { ...p, time_to_discharge: undefined, version: p.version + 1 }
            : p
        )
      );
    } else {
      patientHook.flagForDischarge(pid);
    }
  }, [appMode, patientHook]);

  const value: PatientContextValue = {
    ...patientHook,
    patients: exposedPatients,
    flagForDischarge: flagForDischargeWrapped,
    dischargePatient: dischargePatientWithLog,
    markDone: markDoneWithLog,
    acknowledgeLab,
    overdueWaitPids,
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
    appMode,
    setAppMode,
    baselineSelectedPid,
    setBaselineSelectedPid,
    rawPatients: patientHook.patients,
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
