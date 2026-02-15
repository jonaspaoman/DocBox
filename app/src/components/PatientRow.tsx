"use client";

import { useRef, useEffect, useState } from "react";
import { Patient } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLOR_BORDER: Record<string, string> = {
  grey: "border-l-gray-500",
  yellow: "border-l-yellow-500",
  green: "border-l-emerald-500",
  red: "border-l-red-500",
};

const ESI_VARIANT: Record<number, "default" | "secondary" | "destructive" | "outline"> = {
  1: "destructive",
  2: "destructive",
  3: "default",
  4: "secondary",
  5: "outline",
};

interface PatientRowProps {
  patient: Patient;
  children?: React.ReactNode;
  onEdit?: () => void;
  hideDetails?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  editableFields?: Set<string>;
  draft?: Record<string, any>;
  onFieldChange?: (field: string, value: any) => void;
  /** Rendered in the always-visible header row (e.g. elapsed wait time) */
  headerExtra?: React.ReactNode;
  /** Subject line shown prominently above patient name */
  subject?: string;
  subjectColor?: string;
}

export function PatientRow({ patient, children, onEdit, hideDetails, expanded, onToggle, editableFields, draft, onFieldChange, headerExtra, subject, subjectColor }: PatientRowProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (expanded && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [expanded, children, hideDetails]);

  return (
    <div className={cn(
      "rounded-md overflow-hidden border-l-2 border border-gray-200 bg-gray-50 transition-colors",
      expanded && "border-gray-300 bg-gray-100",
      COLOR_BORDER[patient.color] || "border-l-gray-500"
    )}>
      <div className="flex items-center">
        <button
          type="button"
          className="flex-1 flex flex-col px-4 py-3 text-left hover:bg-gray-100 transition-colors gap-1"
          onClick={onToggle}
        >
          {subject && (
            <span className={cn("text-[10px] font-mono font-bold uppercase tracking-wider", subjectColor ?? "text-muted-foreground")}>
              {subject}
            </span>
          )}
          <div className="flex items-center gap-3 w-full">
            <svg
              className={cn(
                "w-3 h-3 shrink-0 text-muted-foreground/50 transition-transform duration-200",
                expanded && "rotate-90"
              )}
              viewBox="0 0 6 10"
              fill="currentColor"
            >
              <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-medium font-mono text-sm truncate text-foreground/90">{patient.name}</span>
            {patient.age != null && patient.sex && (
              <span className="text-muted-foreground text-xs font-mono shrink-0">
                {patient.age}{patient.sex.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-muted-foreground text-xs font-mono truncate flex-1 text-right">
              {patient.chief_complaint ?? "—"}
            </span>
            {patient.esi_score != null && (
              <Badge variant={ESI_VARIANT[patient.esi_score] ?? "outline"} className="shrink-0 font-mono text-[10px]">
                ESI {patient.esi_score}
              </Badge>
            )}
            {headerExtra}
          </div>
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-3 text-xs font-mono font-medium text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors shrink-0"
          >
            Edit
          </button>
        )}
      </div>

      <div
        className="transition-[max-height,opacity] duration-200 ease-in-out overflow-hidden"
        style={{ maxHeight: expanded ? height + 32 : 0, opacity: expanded ? 1 : 0 }}
      >
        <div ref={contentRef} className="px-4 pb-4 space-y-2 border-t border-gray-200 pt-3">
          {!hideDetails && (
            <>
              {/* Demographics bar */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono rounded-md border border-gray-200 bg-gray-50 p-2.5">
                {editableFields?.has("name") ? (
                  <>
                    <span className="text-muted-foreground/50 uppercase">Name</span>
                    <input className="bg-transparent border-b border-gray-300 text-foreground/80 outline-none text-xs font-mono" value={draft?.name ?? patient.name} onChange={(e) => onFieldChange?.("name", e.target.value)} />
                  </>
                ) : null}
                {editableFields?.has("age") ? (
                  <>
                    <span className="text-muted-foreground/50 uppercase">Age</span>
                    <input type="number" className="bg-transparent border-b border-gray-300 text-foreground/80 outline-none text-xs font-mono w-16" value={draft?.age ?? patient.age ?? ""} onChange={(e) => onFieldChange?.("age", parseInt(e.target.value) || 0)} />
                  </>
                ) : null}
                {editableFields?.has("sex") ? (
                  <>
                    <span className="text-muted-foreground/50 uppercase">Sex</span>
                    <select className="bg-transparent border-b border-gray-300 text-foreground/80 outline-none text-xs font-mono" value={draft?.sex ?? patient.sex ?? ""} onChange={(e) => onFieldChange?.("sex", e.target.value)}>
                      <option value="">—</option>
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </>
                ) : null}
                {editableFields?.has("esi_score") ? (
                  <>
                    <span className="text-muted-foreground/50 uppercase">ESI Score</span>
                    <select className="bg-transparent border-b border-gray-300 text-foreground/80 outline-none text-xs font-mono" value={draft?.esi_score ?? patient.esi_score ?? 3} onChange={(e) => onFieldChange?.("esi_score", parseInt(e.target.value))}>
                      <option value={1}>1 — Resuscitation</option>
                      <option value={2}>2 — Emergent</option>
                      <option value={3}>3 — Urgent</option>
                      <option value={4}>4 — Less Urgent</option>
                      <option value={5}>5 — Non-Urgent</option>
                    </select>
                  </>
                ) : null}
                <span className="text-muted-foreground/50 uppercase">Status</span>
                <span className="text-emerald-600">{patient.status}</span>
                {patient.bed_number != null && (
                  <>
                    <span className="text-muted-foreground/50 uppercase">Bed</span>
                    <span className="text-emerald-600">#{patient.bed_number}</span>
                  </>
                )}
                {patient.dob && (
                  <>
                    <span className="text-muted-foreground/50 uppercase">DOB</span>
                    <span className="text-foreground/80">{patient.dob}</span>
                  </>
                )}
                {patient.time_to_discharge != null && (
                  <>
                    <span className="text-muted-foreground/50 uppercase">TTD</span>
                    <span className="text-emerald-600">{patient.time_to_discharge} ticks</span>
                  </>
                )}
              </div>

              {/* Clinical sections */}
              {(patient.chief_complaint || editableFields?.has("chief_complaint")) && (
                <Section label="Chief Complaint" value={draft?.chief_complaint ?? patient.chief_complaint ?? ""} editable={editableFields?.has("chief_complaint")} onChange={(v) => onFieldChange?.("chief_complaint", v)} />
              )}
              {(patient.triage_notes || editableFields?.has("triage_notes")) && (
                <Section label="Triage Notes" value={draft?.triage_notes ?? patient.triage_notes ?? ""} editable={editableFields?.has("triage_notes")} onChange={(v) => onFieldChange?.("triage_notes", v)} multiline />
              )}
              {patient.hpi && <Section label="HPI" value={patient.hpi} />}
              {patient.pmh && <Section label="PMH" value={patient.pmh} />}
              {patient.family_social_history && (
                <Section label="Family / Social Hx" value={patient.family_social_history} />
              )}
              {patient.review_of_systems && (
                <Section label="Review of Systems" value={patient.review_of_systems} />
              )}
              {patient.objective && <Section label="Objective" value={patient.objective} />}
              {(patient.primary_diagnoses || editableFields?.has("primary_diagnoses")) && (
                <Section label="Diagnoses" value={draft?.primary_diagnoses ?? patient.primary_diagnoses ?? ""} editable={editableFields?.has("primary_diagnoses")} onChange={(v) => onFieldChange?.("primary_diagnoses", v)} />
              )}
              {(patient.justification || editableFields?.has("justification")) && (
                <Section label="Justification" value={draft?.justification ?? patient.justification ?? ""} editable={editableFields?.has("justification")} onChange={(v) => onFieldChange?.("justification", v)} multiline />
              )}
              {(patient.plan || editableFields?.has("plan")) && (
                <Section label="Plan" value={draft?.plan ?? patient.plan ?? ""} editable={editableFields?.has("plan")} onChange={(v) => onFieldChange?.("plan", v)} multiline />
              )}
              {patient.discharge_blocked_reason && (
                <Section label="Discharge Blocked" value={patient.discharge_blocked_reason} highlight="red" />
              )}

              {/* Lab Results — only show once patient is in er_bed or later */}
              {patient.status !== "called_in" && patient.status !== "waiting_room" && patient.lab_results && patient.lab_results.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">
                    Lab Results
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {patient.lab_results.map((lr) => {
                      const flagged = lr.is_surprising && !lr.acknowledged;
                      return (
                        <div
                          key={lr.test}
                          className={cn(
                            "flex items-center gap-2 text-xs font-mono",
                            flagged ? "text-red-600" : "text-foreground/70"
                          )}
                        >
                          <span className={cn(
                            "shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px]",
                            flagged ? "bg-red-500/20" : "bg-emerald-500/15"
                          )}>
                            {flagged ? "!" : "\u2713"}
                          </span>
                          <span className="text-muted-foreground/60">{lr.test}:</span>
                          <span className={flagged ? "font-medium" : ""}>{lr.result}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discharge Papers */}
              {patient.discharge_papers &&
                Object.keys(patient.discharge_papers).length > 0 && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
                    <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">
                      Discharge Papers
                    </span>
                    <div className="mt-1.5 space-y-2">
                      {Object.entries(patient.discharge_papers).map(([key, val]) => (
                        <div key={key}>
                          <span className="text-[10px] font-mono font-medium text-emerald-600/70 uppercase">{key}</span>
                          <p className="text-sm whitespace-pre-wrap text-foreground/80 mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

function Section({ label, value, highlight, editable, onChange, multiline }: { label: string; value: string; highlight?: "red"; editable?: boolean; onChange?: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
      <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">{label}</span>
      {editable ? (
        multiline ? (
          <textarea
            className="w-full mt-1 rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm font-mono min-h-[60px] resize-y text-foreground/80 outline-none focus:border-emerald-500/40"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
          />
        ) : (
          <input
            className="w-full mt-1 bg-transparent border-b border-gray-300 text-sm text-foreground/80 outline-none font-mono focus:border-emerald-500/40 pb-0.5"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
          />
        )
      ) : (
        <p className={cn(
          "text-sm mt-1 leading-relaxed",
          highlight === "red" ? "text-red-600" : "text-foreground/80"
        )}>{value}</p>
      )}
    </div>
  );
}
