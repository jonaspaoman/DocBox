export interface LabResult {
  test: string;
  result: string;
  is_surprising: boolean;
  arrives_at_tick: number;
}

export type PatientColor = "grey" | "yellow" | "green" | "red";

export type PatientStatus =
  | "called_in"
  | "waiting_room"
  | "er_bed"
  | "or"
  | "discharge"
  | "icu"
  | "done";

export interface Patient {
  pid: string;
  name: string;
  sex?: string;
  age?: number;
  dob?: string;
  chief_complaint?: string;
  hpi?: string;
  pmh?: string;
  family_social_history?: string;
  review_of_systems?: string;
  objective?: string;
  primary_diagnoses?: string;
  justification?: string;
  plan?: string;
  esi_score?: number;
  triage_notes?: string;
  color: PatientColor;
  status: PatientStatus;
  bed_number?: number;
  is_simulated: boolean;
  version: number;
  lab_results?: LabResult[];
  time_to_discharge?: number;
  discharge_blocked_reason?: string;
  discharge_papers?: Record<string, string>;
  entered_current_status_tick?: number;
  created_at?: string;
  updated_at?: string;
}

export type LogEventType =
  | "called_in"
  | "accepted"
  | "assigned_bed"
  | "flagged_discharge"
  | "discharged"
  | "marked_done"
  | "lab_arrived"
  | "turned_red";

export interface LogEntry {
  id: string;
  pid: string;
  patientName: string;
  event: LogEventType;
  timestamp: Date;
  tick: number;
}

export interface SimState {
  current_tick: number;
  speed_multiplier: number;
  mode: "manual" | "semi-auto" | "full-auto";
  is_running: boolean;
}

export type WSMessageType =
  | "patient_added"
  | "patient_update"
  | "sim_state"
  | "lab_arrived"
  | "discharge_ready";

export interface WSMessage {
  type: WSMessageType;
  patient?: Patient;
  patient_id?: string;
  changes?: Partial<Patient>;
  version?: number;
  // sim_state fields
  current_tick?: number;
  speed_multiplier?: number;
  mode?: string;
  is_running?: boolean;
}
