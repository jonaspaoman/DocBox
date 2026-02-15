// REST API helper functions
// Falls back gracefully when backend is not reachable

import { Patient, SimState } from "./types";
import { MOCK_PATIENTS, getNextMockPatient } from "./mock-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function tryFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch {
    console.warn(`API unreachable: ${opts?.method ?? "GET"} ${url}`);
    return null;
  }
}

// --- Patients ---

export async function fetchPatients(): Promise<Patient[]> {
  const res = await tryFetch(`${API_URL}/api/patients`);
  if (res) return res.json();
  return [...MOCK_PATIENTS];
}

export async function fetchPatient(pid: string): Promise<Patient | undefined> {
  const res = await tryFetch(`${API_URL}/api/patients/${pid}`);
  if (res) return res.json();
  return MOCK_PATIENTS.find((p) => p.pid === pid);
}

export async function advancePatient(pid: string): Promise<{ status: string }> {
  const res = await tryFetch(`${API_URL}/api/patients/${pid}/advance`, { method: "POST" });
  if (res) return res.json();
  return { status: "ok" };
}

export async function assignBed(pid: string, bedNumber: number): Promise<{ bed_number: number }> {
  const res = await tryFetch(`${API_URL}/api/patients/${pid}/assign-bed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bed_number: bedNumber }),
  });
  if (res) return res.json();
  return { bed_number: bedNumber };
}

export async function acceptPatient(pid: string): Promise<{ status: string }> {
  const res = await tryFetch(`${API_URL}/api/patients/${pid}/accept`, { method: "POST" });
  if (res) return res.json();
  return { status: "waiting_room" };
}

export async function updatePatient(
  pid: string,
  changes: Partial<Patient>
): Promise<Partial<Patient>> {
  const res = await tryFetch(`${API_URL}/api/patients/${pid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (res) return res.json();
  return changes;
}

// --- Simulation ---

export async function startSim(): Promise<{ status: string }> {
  const res = await tryFetch(`${API_URL}/api/sim/start`, { method: "POST" });
  if (res) return res.json();
  return { status: "running" };
}

export async function stopSim(): Promise<{ status: string }> {
  const res = await tryFetch(`${API_URL}/api/sim/stop`, { method: "POST" });
  if (res) return res.json();
  return { status: "stopped" };
}

export async function setSimSpeed(speed: number): Promise<{ speed: number }> {
  const res = await tryFetch(`${API_URL}/api/sim/speed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speed }),
  });
  if (res) return res.json();
  return { speed };
}

export async function injectPatient(): Promise<{ patient: Patient }> {
  const res = await tryFetch(`${API_URL}/api/sim/inject`, { method: "POST" });
  if (res) return res.json();
  return { patient: getNextMockPatient() };
}

// Maps frontend 3-mode to backend 2-mode: semi-auto and full-auto both send "auto"
export async function setSimMode(mode: SimState["mode"]): Promise<{ mode: string }> {
  const backendMode = mode === "manual" ? "manual" : "auto";
  const res = await tryFetch(`${API_URL}/api/sim/mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: backendMode }),
  });
  if (res) return res.json();
  return { mode };
}

export async function fetchSimState(): Promise<SimState> {
  const res = await tryFetch(`${API_URL}/api/sim/state`);
  if (res) return res.json();
  return {
    current_tick: 0,
    speed_multiplier: 1.0,
    mode: "semi-auto",
    is_running: false,
  };
}

// --- Rejection LLM ---

export interface RejectionResult {
  time_to_discharge: number;
  additional_labs: { test: string; result: string; is_surprising: boolean; arrives_at_tick: number }[];
  reasoning: string;
}

export async function processRejection(
  patient: Patient,
  rejectionNote: string,
  currentTick: number
): Promise<RejectionResult> {
  try {
    const res = await fetch("/api/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient, rejectionNote, currentTick }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    console.warn("Rejection LLM call failed, using defaults");
    return {
      time_to_discharge: Math.floor(Math.random() * 9) + 4,
      additional_labs: [],
      reasoning: "LLM unavailable — using default delay.",
    };
  }
}
