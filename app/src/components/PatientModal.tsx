"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Patient, LogEntry } from "@/lib/types";
import { ElapsedTime } from "@/components/ElapsedTime";

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

const ESI_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-600 border-red-300",
  2: "bg-orange-100 text-orange-600 border-orange-300",
  3: "bg-yellow-100 text-yellow-600 border-yellow-300",
  4: "bg-green-100 text-green-600 border-green-300",
  5: "bg-blue-100 text-blue-600 border-blue-300",
};

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
  if (!patient) return null;

  const arrivalEntry = eventLog.find((e) => e.pid === patient.pid && e.event === "called_in");
  const currentStatusEntry = [...eventLog].reverse().find(
    (e) => e.pid === patient.pid && e.event !== "called_in"
  );

  const statusLabel = STATUS_LABELS[patient.status] ?? patient.status.replace("_", " ").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-white border-gray-200">
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
          {/* Demographics - table style */}
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

          {/* Chief Complaint */}
          {patient.chief_complaint && (
            <DataField label="Chief Complaint" value={patient.chief_complaint} />
          )}

          {/* Triage Notes */}
          {patient.triage_notes && (
            <DataField label="Triage Notes" value={patient.triage_notes} muted />
          )}

          {/* Lab Results */}
          {patient.lab_results && patient.lab_results.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
                Lab Results
              </div>
              <div className="space-y-1 border border-border/20 rounded p-2 bg-muted/10">
                {patient.lab_results.map((lab, i) => {
                  const arrived = lab.arrives_at_tick <= currentTick;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2 text-xs font-mono ${
                        lab.is_surprising && arrived ? "text-red-600 font-medium" : "text-foreground/80"
                      }`}
                    >
                      <span className="shrink-0 w-4 mt-0.5">
                        {arrived ? (lab.is_surprising ? "⚠" : "✓") : "⏳"}
                      </span>
                      <span>
                        {lab.test}
                        {arrived && lab.result && ` — ${lab.result}`}
                        {!arrived && " — pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Doctor Rejection Notes */}
          {patient.rejection_notes && patient.rejection_notes.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-600 mb-1.5">
                Doctor Rejection Notes
              </div>
              <div className="space-y-1.5 border border-yellow-300 rounded p-2.5 bg-yellow-50">
                {patient.rejection_notes.map((note, i) => (
                  <div key={i} className="flex gap-2 text-xs font-mono">
                    <span className="text-yellow-500 shrink-0">#{i + 1}</span>
                    <span className="text-foreground/70">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discharge Papers */}
          {patient.discharge_papers && Object.keys(patient.discharge_papers).length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-1.5">
                Discharge Papers
              </div>
              <div className="space-y-2 border border-emerald-300 rounded p-2.5 bg-emerald-50">
                {Object.entries(patient.discharge_papers).map(([key, val]) => (
                  <div key={key}>
                    <span className="text-[9px] font-mono font-semibold text-emerald-600 uppercase tracking-wider">
                      {key.replace(/_/g, " ")}
                    </span>
                    <p className="text-xs font-mono text-foreground/75 whitespace-pre-wrap mt-0.5 leading-relaxed">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-border/20">
            {patient.status === "called_in" && onAccept && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs"
                onClick={() => { onAccept(patient.pid); onClose(); }}
              >
                Accept Patient
              </Button>
            )}
            {patient.status === "waiting_room" && onAssignBed && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs"
                onClick={() => { onAssignBed(patient.pid); onClose(); }}
              >
                Assign Bed
              </Button>
            )}
            {patient.status === "er_bed" && patient.color !== "green" && onFlagDischarge && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs"
                onClick={() => { onFlagDischarge(patient.pid); onClose(); }}
              >
                Flag for Discharge
              </Button>
            )}
            {patient.status === "er_bed" && patient.color === "green" && onDischarge && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs"
                onClick={() => { onDischarge(patient.pid); onClose(); }}
              >
                Discharge
              </Button>
            )}
            {(patient.status === "or" || patient.status === "icu") && onMarkDone && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs"
                onClick={() => { onMarkDone(patient.pid); onClose(); }}
              >
                Mark Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
