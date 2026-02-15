"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Patient, LogEntry } from "@/lib/types";
import { ElapsedTime } from "@/components/ElapsedTime";
import { usePatientContext } from "@/context/PatientContext";

interface PatientModalProps {
  patient: Patient | null;
  open: boolean;
  onClose: () => void;
  currentTick: number;
  onAccept?: (pid: string) => void;
  onAssignBed?: (pid: string) => void;
  onFlagDischarge?: (pid: string) => void;
  onDischarge?: (pid: string) => void;
  onMarkDone?: (pid: string) => void;
  eventLog?: LogEntry[];
}

const STATUS_LABELS: Record<string, string> = {
  called_in: "CALLED IN",
  waiting_room: "WAITING",
  er_bed: "HOSPITAL BED",
  or: "OR",
  icu: "ICU",
  discharge: "DISCHARGING",
  done: "DONE",
};

const BASELINE_STATUS_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  called_in: "WALKED IN",
};

const ESI_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-600 border-red-300",
  2: "bg-orange-100 text-orange-600 border-orange-300",
  3: "bg-yellow-100 text-yellow-600 border-yellow-300",
  4: "bg-green-100 text-green-600 border-green-300",
  5: "bg-blue-100 text-blue-600 border-blue-300",
};

const DISCHARGE_FIELDS: { key: string; label: string; multiline: boolean }[] = [
  { key: "disposition", label: "Disposition", multiline: false },
  { key: "diagnosis", label: "Diagnosis", multiline: false },
  { key: "discharge_justification", label: "Discharge Justification", multiline: true },
  { key: "admitting_attending", label: "Admitting Attending", multiline: false },
  { key: "follow_up", label: "Follow-Up", multiline: false },
  { key: "follow_up_instructions", label: "Follow-Up Instructions", multiline: true },
  { key: "warning_instructions", label: "Warning / Return Instructions", multiline: true },
  { key: "soap_note", label: "SOAP Note", multiline: true },
  { key: "avs", label: "After Visit Summary (AVS)", multiline: true },
  { key: "work_school_form", label: "Work / School Form", multiline: true },
];

export function PatientModal({
  patient,
  open,
  onClose,
  currentTick,
  onAccept,
  onAssignBed,
  onFlagDischarge,
  onDischarge,
  onMarkDone,
  eventLog = [],
}: PatientModalProps) {
  const { appMode, updatePatient } = usePatientContext();
  const isBaseline = appMode === "baseline";

  if (!patient) return null;

  if (isBaseline) {
    return (
      <Dialog open={open} onOpenChange={() => {}} modal={false}>
        <DialogContent
          className="max-w-md max-h-[85vh] flex flex-col overflow-hidden bg-white border-gray-200 p-0 shadow-xl"
          overlayClassName="bg-transparent pointer-events-none"
          onEscapeKeyDown={(e) => e.preventDefault()}
          showCloseButton={false}
        >
          <BaselineModalBody
            patient={patient}
            currentTick={currentTick}
            onClose={onClose}
            onAccept={onAccept}
            onAssignBed={onAssignBed}
            onDischarge={onDischarge}
            onMarkDone={onMarkDone}
            eventLog={eventLog}
            updatePatient={updatePatient}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-white border-gray-200">
        <DocboxModalBody
          patient={patient}
          currentTick={currentTick}
          onClose={onClose}
          onAccept={onAccept}
          onAssignBed={onAssignBed}
          onFlagDischarge={onFlagDischarge}
          onDischarge={onDischarge}
          onMarkDone={onMarkDone}
          eventLog={eventLog}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Original DocBox modal body — unchanged */
function DocboxModalBody({
  patient,
  currentTick,
  onClose,
  onAccept,
  onAssignBed,
  onFlagDischarge,
  onDischarge,
  onMarkDone,
  eventLog,
}: {
  patient: Patient;
  currentTick: number;
  onClose: () => void;
  onAccept?: (pid: string) => void;
  onAssignBed?: (pid: string) => void;
  onFlagDischarge?: (pid: string) => void;
  onDischarge?: (pid: string) => void;
  onMarkDone?: (pid: string) => void;
  eventLog: LogEntry[];
}) {
  const arrivalEntry = eventLog.find((e) => e.pid === patient.pid && e.event === "called_in");
  const currentStatusEntry = [...eventLog].reverse().find(
    (e) => e.pid === patient.pid && e.event !== "called_in"
  );
  const statusLabel = STATUS_LABELS[patient.status] ?? patient.status.replace("_", " ").toUpperCase();

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between pr-6">
          <span className="font-mono text-foreground flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: { grey: "#6B7280", yellow: "#EAB308", green: "#22C55E", red: "#EF4444" }[patient.color] }}
            />
            {patient.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-muted/30 text-muted-foreground border-border/30">
              {statusLabel}
            </span>
            {patient.esi_score && (
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${ESI_COLORS[patient.esi_score] ?? "bg-muted/30 text-muted-foreground border-border/30"}`}>
                ESI {patient.esi_score}
              </span>
            )}
          </div>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono border border-border/20 rounded p-2.5 bg-muted/10">
          {patient.age != null && (
            <>
              <span className="text-muted-foreground/60 uppercase">Age</span>
              <span className="text-foreground">{patient.age}</span>
            </>
          )}
          {patient.sex && (
            <>
              <span className="text-muted-foreground/60 uppercase">Sex</span>
              <span className="text-foreground">{patient.sex}</span>
            </>
          )}
          {patient.bed_number != null && (
            <>
              <span className="text-muted-foreground/60 uppercase">Bed</span>
              <span className="text-emerald-600">#{patient.bed_number}</span>
            </>
          )}
          {patient.time_to_discharge != null && (
            <>
              <span className="text-muted-foreground/60 uppercase">TTD</span>
              <span className="text-foreground">{patient.time_to_discharge} ticks</span>
            </>
          )}
          {arrivalEntry && (
            <>
              <span className="text-muted-foreground/60 uppercase">Wait</span>
              <ElapsedTime since={arrivalEntry.timestamp} className="text-yellow-600 text-xs" />
            </>
          )}
          {currentStatusEntry && patient.status !== "done" && (
            <>
              <span className="text-muted-foreground/60 uppercase">In Status</span>
              <ElapsedTime since={currentStatusEntry.timestamp} className="text-emerald-600 text-xs" />
            </>
          )}
        </div>

        {patient.chief_complaint && <DataField label="Chief Complaint" value={patient.chief_complaint} />}
        {patient.triage_notes && <DataField label="Triage Notes" value={patient.triage_notes} muted />}

        {patient.status !== "called_in" && patient.status !== "waiting_room" && patient.lab_results && patient.lab_results.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Lab Results</div>
            <div className="space-y-1 border border-border/20 rounded p-2 bg-muted/10">
              {patient.lab_results.map((lab, i) => {
                const arrived = lab.arrives_at_tick <= currentTick;
                return (
                  <div key={i} className={`flex items-start gap-2 text-xs font-mono ${lab.is_surprising && !lab.acknowledged && arrived ? "text-red-600 font-medium" : "text-foreground/80"}`}>
                    <span className="shrink-0 w-4 mt-0.5">{arrived ? (lab.is_surprising && !lab.acknowledged ? "⚠" : "✓") : "⏳"}</span>
                    <span>{lab.test}{arrived && lab.result && ` — ${lab.result}`}{!arrived && " — pending"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {patient.rejection_notes && patient.rejection_notes.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-600 mb-1.5">Doctor Rejection Notes</div>
            <div className="space-y-1.5 border border-yellow-500/30 rounded p-2.5 bg-yellow-500/10">
              {patient.rejection_notes.map((note, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono">
                  <span className="text-yellow-500 shrink-0">#{i + 1}</span>
                  <span className="text-foreground/70">{note}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {patient.doctor_notes && patient.doctor_notes.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-blue-600 mb-1.5">Doctor Notes</div>
            <div className="space-y-1.5 border border-blue-500/30 rounded p-2.5 bg-blue-500/10">
              {patient.doctor_notes.map((note, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono">
                  <span className="text-blue-500 shrink-0">#{i + 1}</span>
                  <span className="text-foreground/70">{note}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {patient.discharge_papers && Object.keys(patient.discharge_papers).length > 0 && (patient.status === "discharge" || patient.status === "done") && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-1.5">Discharge Papers</div>
            <div className="space-y-2 border border-emerald-500/30 rounded p-2.5 bg-emerald-500/10">
              {Object.entries(patient.discharge_papers).map(([key, val]) => (
                <div key={key}>
                  <span className="text-[9px] font-mono font-semibold text-emerald-600 uppercase tracking-wider">{key.replace(/_/g, " ")}</span>
                  <p className="text-xs font-mono text-foreground/75 whitespace-pre-wrap mt-0.5 leading-relaxed">{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border/20">
          {patient.status === "called_in" && onAccept && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs" onClick={() => { onAccept(patient.pid); onClose(); }}>
              Accept Patient
            </Button>
          )}
          {patient.status === "waiting_room" && onAssignBed && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs" onClick={() => { onAssignBed(patient.pid); onClose(); }}>
              Assign Bed
            </Button>
          )}
          {patient.status === "er_bed" && patient.color !== "green" && onFlagDischarge && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs" onClick={() => { onFlagDischarge(patient.pid); onClose(); }}>
              Flag for Discharge
            </Button>
          )}
          {patient.status === "er_bed" && patient.color === "green" && onDischarge && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs" onClick={() => { onDischarge(patient.pid); onClose(); }}>
              Discharge
            </Button>
          )}
          {(patient.status === "or" || patient.status === "icu") && onMarkDone && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs" onClick={() => { onMarkDone(patient.pid); onClose(); }}>
              Mark Done
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

const BASELINE_DISCHARGE_FIELDS = DISCHARGE_FIELDS.slice(0, 5);

/** Score first N words of two strings — returns count of matching words */
function scoreFirstNWords(submitted: string, truth: string, n: number): number {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  const subWords = normalize(submitted);
  const truthWords = normalize(truth);
  let matched = 0;
  for (let i = 0; i < Math.min(n, truthWords.length); i++) {
    if (i < subWords.length && subWords[i] === truthWords[i]) matched++;
  }
  return matched;
}

/** Baseline modal body — editable blank fields, sticky footer, validation errors */
function BaselineModalBody({
  patient,
  currentTick,
  onClose,
  onAccept,
  onAssignBed,
  onDischarge,
  onMarkDone,
  eventLog,
  updatePatient,
}: {
  patient: Patient;
  currentTick: number;
  onClose: () => void;
  onAccept?: (pid: string) => void;
  onAssignBed?: (pid: string) => void;
  onDischarge?: (pid: string) => void;
  onMarkDone?: (pid: string) => void;
  eventLog: LogEntry[];
  updatePatient: (pid: string, changes: Partial<Patient>, version?: number) => void;
}) {
  const { baselineGroundTruth, recordBaselineScore } = usePatientContext();
  const isCalledIn = patient.status === "called_in";
  const isErBed = patient.status === "er_bed";

  const [submitted, setSubmitted] = useState(false);

  const [intake, setIntake] = useState({
    name: "",
    age: 0,
    sex: "",
    chief_complaint: "",
    triage_notes: "",
    esi_score: 0,
  });

  const [papers, setPapers] = useState<Record<string, string>>(() => {
    const blank: Record<string, string> = {};
    for (const { key } of DISCHARGE_FIELDS) blank[key] = "";
    return blank;
  });

  useEffect(() => {
    setIntake({ name: "", age: 0, sex: "", chief_complaint: "", triage_notes: "", esi_score: 0 });
    const blank: Record<string, string> = {};
    for (const { key } of DISCHARGE_FIELDS) blank[key] = "";
    setPapers(blank);
    setSubmitted(false);
  }, [patient.pid]);

  const intakeErrors = {
    name: intake.name.trim() === "",
    age: intake.age <= 0,
    sex: intake.sex === "",
    chief_complaint: intake.chief_complaint.trim() === "",
    triage_notes: intake.triage_notes.trim() === "",
    esi_score: intake.esi_score < 1 || intake.esi_score > 5,
  };
  const intakeValid = !Object.values(intakeErrors).some(Boolean);

  const dischargeErrors: Record<string, boolean> = {};
  for (const { key } of BASELINE_DISCHARGE_FIELDS) {
    dischargeErrors[key] = (papers[key] ?? "").trim() === "";
  }
  const dischargeValid = !Object.values(dischargeErrors).some(Boolean);

  const errBorder = "border-red-500 ring-1 ring-red-500/30";
  const errBorderBottom = "border-b-red-500";

  const handleAccept = useCallback(() => {
    setSubmitted(true);
    if (!intakeValid || !onAccept) return;

    // Score intake against ground truth
    const gt = baselineGroundTruth.get(patient.pid);
    if (gt) {
      let score = 0;
      let max = 0;
      // Exact match fields: name (case-insensitive), age, sex, esi_score
      max += 1; if (intake.name.trim().toLowerCase() === (gt.name ?? "").trim().toLowerCase()) score += 1;
      max += 1; if (intake.age === gt.age) score += 1;
      max += 1; if (intake.sex === gt.sex) score += 1;
      max += 1; if (intake.esi_score === gt.esi_score) score += 1;
      // First 8 words: chief_complaint, triage_notes
      const ccMax = Math.min(8, (gt.chief_complaint ?? "").trim().split(/\s+/).filter(Boolean).length);
      max += ccMax;
      score += scoreFirstNWords(intake.chief_complaint, gt.chief_complaint ?? "", 8);
      const tnMax = Math.min(8, (gt.triage_notes ?? "").trim().split(/\s+/).filter(Boolean).length);
      max += tnMax;
      score += scoreFirstNWords(intake.triage_notes, gt.triage_notes ?? "", 8);
      recordBaselineScore(patient.pid, "intake", score, max);
    }

    // Don't update patient data — keep original file intact for sidebar
    onAccept(patient.pid);
    onClose();
  }, [intakeValid, onAccept, patient.pid, onClose, baselineGroundTruth, recordBaselineScore]);

  const handleDischarge = useCallback(() => {
    setSubmitted(true);
    if (!dischargeValid || !onDischarge) return;

    // Score discharge against ground truth (if available)
    const gt = baselineGroundTruth.get(patient.pid);
    if (gt?.discharge_papers) {
      let score = 0;
      let max = 0;
      for (const { key, multiline } of BASELINE_DISCHARGE_FIELDS) {
        const truthVal = gt.discharge_papers[key] ?? "";
        if (!truthVal) continue; // skip fields with no ground truth
        if (multiline) {
          const wordMax = Math.min(8, truthVal.trim().split(/\s+/).filter(Boolean).length);
          max += wordMax;
          score += scoreFirstNWords(papers[key] ?? "", truthVal, 8);
        } else {
          max += 1;
          if ((papers[key] ?? "").trim().toLowerCase() === truthVal.trim().toLowerCase()) score += 1;
        }
      }
      if (max > 0) recordBaselineScore(patient.pid, "discharge", score, max);
    }

    // Don't update patient data — keep original file intact for sidebar
    onDischarge(patient.pid);
    onClose();
  }, [dischargeValid, onDischarge, patient.pid, onClose, baselineGroundTruth, recordBaselineScore]);

  const statusLabel = BASELINE_STATUS_LABELS[patient.status] ?? patient.status.replace("_", " ").toUpperCase();

  const RequiredHint = () => (
    <span className="text-[9px] font-mono text-red-500 mt-0.5">Required</span>
  );

  return (
    <>
      {/* Custom X button (since we disabled Radix's built-in close) */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-xs opacity-70 transition-opacity hover:opacity-100"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Header */}
      <div className="px-6 pt-6 pb-0 shrink-0">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span className="font-mono text-foreground flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full shrink-0 bg-gray-400" />
              {isCalledIn ? (intake.name.trim() || "New Patient") : patient.name}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-muted/30 text-muted-foreground border-border/30">
              {statusLabel}
            </span>
          </DialogTitle>
        </DialogHeader>
      </div>

      {/* Scrollable form area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6">
        <div className="space-y-3 text-sm pb-2">
          {isCalledIn && (
            <>
              <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2.5 text-xs font-mono border border-border/20 rounded p-2.5 bg-muted/10">
                <span className="text-muted-foreground/60 uppercase self-center">Name</span>
                <div className="flex flex-col">
                  <input
                    className={`bg-transparent border-b text-foreground/85 outline-none text-xs font-mono pb-0.5 ${submitted && intakeErrors.name ? errBorderBottom : "border-gray-300 focus:border-emerald-500/40"}`}
                    placeholder="Enter name..."
                    value={intake.name}
                    onChange={(e) => setIntake((d) => ({ ...d, name: e.target.value }))}
                  />
                  {submitted && intakeErrors.name && <RequiredHint />}
                </div>
                <span className="text-muted-foreground/60 uppercase self-center">Age</span>
                <div className="flex flex-col">
                  <input
                    type="number"
                    className={`bg-transparent border-b text-foreground/85 outline-none text-xs font-mono w-16 pb-0.5 ${submitted && intakeErrors.age ? errBorderBottom : "border-gray-300 focus:border-emerald-500/40"}`}
                    placeholder="—"
                    value={intake.age || ""}
                    onChange={(e) => setIntake((d) => ({ ...d, age: parseInt(e.target.value) || 0 }))}
                  />
                  {submitted && intakeErrors.age && <RequiredHint />}
                </div>
                <span className="text-muted-foreground/60 uppercase self-center">Sex</span>
                <div className="flex flex-col">
                  <select
                    className={`bg-transparent border-b text-foreground/85 outline-none text-xs font-mono pb-0.5 w-20 ${submitted && intakeErrors.sex ? errBorderBottom : "border-gray-300 focus:border-emerald-500/40"}`}
                    value={intake.sex}
                    onChange={(e) => setIntake((d) => ({ ...d, sex: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                  {submitted && intakeErrors.sex && <RequiredHint />}
                </div>
                <span className="text-muted-foreground/60 uppercase self-center">ESI</span>
                <div className="flex flex-col">
                  <select
                    className={`bg-transparent border-b text-foreground/85 outline-none text-xs font-mono pb-0.5 ${submitted && intakeErrors.esi_score ? errBorderBottom : "border-gray-300 focus:border-emerald-500/40"}`}
                    value={intake.esi_score}
                    onChange={(e) => setIntake((d) => ({ ...d, esi_score: parseInt(e.target.value) }))}
                  >
                    <option value={0}>— Select ESI —</option>
                    <option value={1}>1 — Resuscitation</option>
                    <option value={2}>2 — Emergent</option>
                    <option value={3}>3 — Urgent</option>
                    <option value={4}>4 — Less Urgent</option>
                    <option value={5}>5 — Non-Urgent</option>
                  </select>
                  {submitted && intakeErrors.esi_score && <RequiredHint />}
                </div>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Chief Complaint</div>
                <input
                  className={`w-full border rounded px-2 py-1.5 text-sm font-mono text-foreground/85 outline-none bg-muted/10 ${submitted && intakeErrors.chief_complaint ? errBorder : "border-border/20 focus:border-emerald-500/40"}`}
                  placeholder="Enter chief complaint..."
                  value={intake.chief_complaint}
                  onChange={(e) => setIntake((d) => ({ ...d, chief_complaint: e.target.value }))}
                />
                {submitted && intakeErrors.chief_complaint && <RequiredHint />}
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Triage Notes</div>
                <textarea
                  className={`w-full border rounded px-2 py-1.5 text-sm font-mono min-h-[60px] resize-y text-foreground/85 outline-none bg-muted/10 leading-relaxed ${submitted && intakeErrors.triage_notes ? errBorder : "border-border/20 focus:border-emerald-500/40"}`}
                  placeholder="Enter triage notes..."
                  value={intake.triage_notes}
                  onChange={(e) => setIntake((d) => ({ ...d, triage_notes: e.target.value }))}
                />
                {submitted && intakeErrors.triage_notes && <RequiredHint />}
              </div>
            </>
          )}

          {isErBed && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono border border-border/20 rounded p-2.5 bg-muted/10">
                <span className="text-muted-foreground/60 uppercase">Bed</span>
                <span className="text-foreground">#{patient.bed_number ?? "—"}</span>
              </div>

              {BASELINE_DISCHARGE_FIELDS.map(({ key, label, multiline }) => (
                <div key={key}>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</div>
                  {multiline ? (
                    <textarea
                      className={`w-full border rounded px-2 py-1.5 text-sm font-mono min-h-[60px] resize-y text-foreground/85 outline-none bg-muted/10 leading-relaxed ${submitted && dischargeErrors[key] ? errBorder : "border-border/20 focus:border-emerald-500/40"}`}
                      placeholder={`Enter ${label.toLowerCase()}...`}
                      value={papers[key] ?? ""}
                      onChange={(e) => setPapers((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className={`w-full border rounded px-2 py-1.5 text-sm font-mono text-foreground/85 outline-none bg-muted/10 ${submitted && dischargeErrors[key] ? errBorder : "border-border/20 focus:border-emerald-500/40"}`}
                      placeholder={`Enter ${label.toLowerCase()}...`}
                      value={papers[key] ?? ""}
                      onChange={(e) => setPapers((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
                  {submitted && dischargeErrors[key] && <RequiredHint />}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Sticky footer with action buttons */}
      <div className="px-6 pb-4 pt-2 border-t border-border/20 shrink-0 bg-white">
        {isCalledIn && onAccept && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs w-full"
            onClick={handleAccept}
          >
            Accept Patient
          </Button>
        )}
        {isErBed && onDischarge && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs w-full"
            onClick={handleDischarge}
          >
            Discharge
          </Button>
        )}
        {patient.status === "waiting_room" && onAssignBed && (
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs w-full" onClick={() => { onAssignBed(patient.pid); onClose(); }}>
            Assign Bed
          </Button>
        )}
        {(patient.status === "or" || patient.status === "icu") && onMarkDone && (
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs w-full" onClick={() => { onMarkDone(patient.pid); onClose(); }}>
            Mark Done
          </Button>
        )}
      </div>
    </>
  );
}

function DataField({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">
        {label}
      </div>
      <p className={`text-sm ${muted ? "text-muted-foreground" : "text-foreground/90"}`}>{value}</p>
    </div>
  );
}
