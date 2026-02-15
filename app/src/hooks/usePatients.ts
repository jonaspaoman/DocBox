"use client";

import { useState, useCallback, useEffect } from "react";
import { Patient, PatientStatus } from "@/lib/types";
import * as api from "@/lib/api";

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    api.fetchPatients().then(setPatients).catch(() => {});
  }, []);

  const addPatient = useCallback((patient: Patient) => {
    setPatients((prev) => {
      if (prev.some((p) => p.pid === patient.pid)) return prev;
      return [...prev, patient];
    });
  }, []);

  const updatePatient = useCallback(
    (pid: string, changes: Partial<Patient>, version?: number) => {
      setPatients((prev) =>
        prev.map((p) => {
          if (p.pid !== pid) return p;
          if (version !== undefined && version <= p.version) return p;
          return { ...p, ...changes, version: version ?? p.version + 1 };
        })
      );
    },
    []
  );

  const removePatient = useCallback((pid: string) => {
    setPatients((prev) => prev.filter((p) => p.pid !== pid));
  }, []);

  // called_in → waiting_room
  const acceptPatient = useCallback(async (pid: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.pid === pid
          ? { ...p, status: "waiting_room" as PatientStatus, version: p.version + 1 }
          : p
      )
    );
    api.acceptPatient(pid);
  }, []);

  // waiting_room → er_bed
  const assignBed = useCallback(async (pid: string, bedNumber: number) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.pid === pid
          ? { ...p, status: "er_bed" as PatientStatus, bed_number: bedNumber, version: p.version + 1 }
          : p
      )
    );
    api.assignBed(pid, bedNumber);
  }, []);

  // Flag for discharge: marks patient green (still in er_bed)
  const flagForDischarge = useCallback((pid: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.pid === pid
          ? { ...p, color: "green" as const, version: p.version + 1 }
          : p
      )
    );
  }, []);

  // Discharge: green er_bed patient → done
  const dischargePatient = useCallback(async (pid: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.pid === pid
          ? { ...p, status: "done" as PatientStatus, bed_number: undefined, color: "green" as const, version: p.version + 1 }
          : p
      )
    );
    api.advancePatient(pid);
  }, []);

  // or/icu → done
  const markDone = useCallback(async (pid: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.pid === pid
          ? { ...p, status: "done" as PatientStatus, bed_number: undefined, version: p.version + 1 }
          : p
      )
    );
    api.advancePatient(pid);
  }, []);

  return {
    patients,
    setPatients,
    addPatient,
    updatePatient,
    removePatient,
    acceptPatient,
    assignBed,
    flagForDischarge,
    dischargePatient,
    markDone,
  };
}
