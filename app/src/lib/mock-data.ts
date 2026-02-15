// Patient data sourced from backend/data/patients.json
// Transforms nested backend schema into flat frontend Patient type

import { Patient, PatientColor, PatientStatus } from "./types";
import rawPatients from "./patients.json";

interface RawPatient {
  demographics: { name: string; sex: string; dob: string; address?: string };
  medical_history: string;
  ed_session: {
    triage: {
      chief_complaint_summary: string;
      hpi_narrative: string;
      esi_score: number;
      time_admitted: string;
    };
    doctor_notes: {
      subjective: string;
      objective: string;
      assessment: string;
      plan: string;
    };
    labs: { test: string; result: string; is_surprising: boolean; arrives_at_tick: number }[];
    discharge_papers: Record<string, string> | null;
  };
}

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function transformPatient(
  raw: RawPatient,
  index: number,
  override: {
    status: PatientStatus;
    color: PatientColor;
    bed_number?: number;
    entered_current_status_tick: number;
    version: number;
    is_simulated: boolean;
  }
): Patient {
  const t = raw.ed_session.triage;
  const d = raw.ed_session.doctor_notes;
  return {
    pid: `p${index + 1}`,
    name: raw.demographics.name,
    sex: raw.demographics.sex,
    dob: raw.demographics.dob,
    age: ageFromDob(raw.demographics.dob),
    chief_complaint: t.chief_complaint_summary,
    hpi: t.hpi_narrative,
    triage_notes: t.chief_complaint_summary,
    pmh: raw.medical_history,
    objective: d.objective,
    primary_diagnoses: d.assessment,
    justification: d.assessment,
    plan: d.plan,
    review_of_systems: raw.medical_history,
    esi_score: t.esi_score,
    color: override.color,
    status: override.status,
    bed_number: override.bed_number,
    is_simulated: override.is_simulated,
    version: override.version,
    entered_current_status_tick: override.entered_current_status_tick,
    lab_results: raw.ed_session.labs.length > 0 ? raw.ed_session.labs : undefined,
    discharge_papers: raw.ed_session.discharge_papers ?? undefined,
  };
}

// Initial board state: spread patients across statuses for a realistic starting board
// Index maps to rawPatients array (0-indexed)
const INITIAL_OVERRIDES: {
  status: PatientStatus;
  color: PatientColor;
  bed_number?: number;
  entered_current_status_tick: number;
  version: number;
  is_simulated: boolean;
}[] = [
  // 0: Maria Santos — ER bed, yellow (real caller feel)
  { status: "er_bed", color: "yellow", bed_number: 5, entered_current_status_tick: 5, version: 3, is_simulated: false },
  // 1: James Walker — called in (chest pain, ESI 2)
  { status: "called_in", color: "grey", entered_current_status_tick: 0, version: 1, is_simulated: true },
  // 2: Ashley Chen — done (laceration, has discharge papers)
  { status: "done", color: "green", entered_current_status_tick: 18, version: 6, is_simulated: true },
  // 3: Robert Mitchell — ER bed (asthma exacerbation, ESI 2)
  { status: "er_bed", color: "grey", bed_number: 3, entered_current_status_tick: 4, version: 2, is_simulated: true },
  // 4: Linda Okafor — ER bed, red (surprising INR)
  { status: "er_bed", color: "red", bed_number: 1, entered_current_status_tick: 2, version: 3, is_simulated: true },
  // 5: David Park — waiting room (migraine)
  { status: "waiting_room", color: "grey", entered_current_status_tick: 3, version: 2, is_simulated: true },
  // 6: Patricia Gomez — ER bed (pyelonephritis)
  { status: "er_bed", color: "grey", bed_number: 7, entered_current_status_tick: 6, version: 2, is_simulated: true },
  // 7: Kevin Brooks — ER bed, green (wrist fracture, ready to discharge)
  { status: "er_bed", color: "green", bed_number: 8, entered_current_status_tick: 12, version: 4, is_simulated: true },
  // 8: Susan Williams — ER bed (allergic reaction, observation)
  { status: "er_bed", color: "grey", bed_number: 14, entered_current_status_tick: 10, version: 3, is_simulated: true },
  // 9: Thomas Anderson — ER bed (syncope)
  { status: "er_bed", color: "grey", bed_number: 11, entered_current_status_tick: 8, version: 2, is_simulated: true },
  // 10: Fatima Al-Hassan — ER bed, red (CHF decompensation)
  { status: "er_bed", color: "red", bed_number: 2, entered_current_status_tick: 2, version: 3, is_simulated: true },
  // 11: Marcus Johnson — done (ankle sprain, has discharge papers)
  { status: "done", color: "green", entered_current_status_tick: 20, version: 6, is_simulated: true },
  // 12: Dorothy Chen — called in (confusion/sepsis, ESI 2)
  { status: "called_in", color: "grey", entered_current_status_tick: 0, version: 1, is_simulated: true },
  // 13: Ryan O'Brien — waiting room (kidney stone)
  { status: "waiting_room", color: "grey", entered_current_status_tick: 4, version: 2, is_simulated: true },
  // 14: Emily Torres — ER bed (DKA, ESI 2)
  { status: "er_bed", color: "grey", bed_number: 4, entered_current_status_tick: 3, version: 2, is_simulated: true },
  // 15: George Harris — ER bed, green (nosebleed, ready to discharge)
  { status: "er_bed", color: "green", bed_number: 9, entered_current_status_tick: 14, version: 4, is_simulated: true },
  // 16: Carmen Reyes — waiting room (back pain)
  { status: "waiting_room", color: "grey", entered_current_status_tick: 5, version: 1, is_simulated: true },
  // 17: Harold Washington — ER bed (GI bleed)
  { status: "er_bed", color: "grey", bed_number: 6, entered_current_status_tick: 7, version: 2, is_simulated: true },
  // 18: Sophia Kim — done (strep throat, has discharge papers)
  { status: "done", color: "green", entered_current_status_tick: 16, version: 6, is_simulated: true },
  // 19: William Davis — called in (thunderclap headache/SAH, ESI 2)
  { status: "called_in", color: "grey", entered_current_status_tick: 0, version: 1, is_simulated: true },
];

const typed = rawPatients as RawPatient[];

export const MOCK_PATIENTS: Patient[] = typed.map((raw, i) =>
  transformPatient(raw, i, INITIAL_OVERRIDES[i])
);

// --- New patient injection ---
// Cycles through backend patients as "new" arrivals

let nextMockIdx = 0;

export function getNextMockPatient(): Patient {
  const raw = typed[nextMockIdx % typed.length];
  const pid = `p${100 + nextMockIdx}`;
  nextMockIdx++;

  return {
    pid,
    name: raw.demographics.name,
    sex: raw.demographics.sex,
    dob: raw.demographics.dob,
    age: ageFromDob(raw.demographics.dob),
    chief_complaint: raw.ed_session.triage.chief_complaint_summary,
    hpi: raw.ed_session.triage.hpi_narrative,
    triage_notes: raw.ed_session.triage.chief_complaint_summary,
    pmh: raw.medical_history,
    objective: raw.ed_session.doctor_notes.objective,
    primary_diagnoses: raw.ed_session.doctor_notes.assessment,
    plan: raw.ed_session.doctor_notes.plan,
    esi_score: raw.ed_session.triage.esi_score,
    color: "grey",
    status: "called_in",
    is_simulated: true,
    version: 1,
    entered_current_status_tick: 0,
    lab_results: raw.ed_session.labs.length > 0 ? raw.ed_session.labs : undefined,
  };
}
