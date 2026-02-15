"use client";

import { useState, useMemo } from "react";
import { LogPanel } from "@/components/LogPanel";
import { SidebarNurse } from "@/components/SidebarNurse";
import { SidebarDoctor } from "@/components/SidebarDoctor";
import { usePatientContext } from "@/context/PatientContext";
import { Patient, LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type SidebarTab = "nurse" | "doctor";

interface SidebarPanelProps {
  entries: LogEntry[];
}

function PatientFileViewer({ patient, showDischarge, dischargeData }: { patient: Patient; showDischarge?: boolean; dischargeData?: Record<string, string> }) {
  const papers = dischargeData ?? patient.discharge_papers;
  const hasPapers = papers && Object.keys(papers).length > 0;
  const isDischarge = !!showDischarge;

  const fields: { label: string; value?: string | number | null }[] = isDischarge && hasPapers
    ? Object.entries(papers!).map(([key, value]) => ({ label: key, value }))
    : [
        { label: "Name", value: patient.name },
        { label: "Age", value: patient.age },
        { label: "Sex", value: patient.sex },
        { label: "DOB", value: patient.dob },
        { label: "ESI Score", value: patient.esi_score != null ? `${patient.esi_score}` : null },
        { label: "Chief Complaint", value: patient.chief_complaint },
        { label: "Triage Notes", value: patient.triage_notes },
        { label: "HPI", value: patient.hpi },
        { label: "PMH", value: patient.pmh },
        { label: "Family / Social Hx", value: patient.family_social_history },
        { label: "Review of Systems", value: patient.review_of_systems },
        { label: "Objective", value: patient.objective },
        { label: "Diagnoses", value: patient.primary_diagnoses },
        { label: "Plan", value: patient.plan },
      ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-2 shrink-0 bg-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/50">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="text-[11px] font-mono font-bold text-foreground/90 uppercase tracking-widest">
          {isDischarge ? "Discharge File" : "Patient File"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/50 select-text cursor-text">
        <div className="px-3 py-2 space-y-1.5">
          <div className="text-[13px] font-mono font-bold text-foreground/85 pb-1 border-b border-border/20">
            {patient.name}
            {patient.age != null && patient.sex && (
              <span className="text-muted-foreground/50 font-normal ml-2">
                {patient.age}{patient.sex.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {isDischarge && !hasPapers ? (
            <p className="text-muted-foreground/30 text-[11px] font-mono text-center pt-6 leading-relaxed">
              No discharge data available for this patient.
            </p>
          ) : (
            fields.map(({ label, value }) => {
              if (value == null || String(value).trim() === "") return null;
              return (
                <div key={label}>
                  <span className="text-[9px] font-mono font-semibold text-muted-foreground/40 uppercase tracking-widest">
                    {label}
                  </span>
                  <p className="text-[11px] font-mono text-foreground/75 leading-relaxed whitespace-pre-wrap select-text">
                    {String(value)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function SidebarPanel({ entries }: SidebarPanelProps) {
  const [tab, setTab] = useState<SidebarTab>("nurse");
  const { patients, appMode, baselineSelectedPid, rawPatients, baselineGroundTruth } = usePatientContext();
  const isBaseline = appMode === "baseline";

  const nurseCount = useMemo(() => patients.filter((p) => p.status === "called_in").length, [patients]);
  const doctorCount = useMemo(() => patients.filter((p) => p.status === "er_bed" && (p.color === "green" || p.color === "red")).length, [patients]);

  const tabs: { key: SidebarTab; label: string; count: number }[] = [
    { key: "nurse", label: "Nurse", count: nurseCount },
    { key: "doctor", label: "Doctor", count: doctorCount },
  ];

  // In baseline mode, show patient file viewer + log at bottom
  if (isBaseline) {
    const selectedPatient = baselineSelectedPid
      ? rawPatients.find((p) => p.pid === baselineSelectedPid) ?? null
      : null;
    const livePatient = baselineSelectedPid
      ? patients.find((p) => p.pid === baselineSelectedPid) ?? null
      : null;
    const liveStatus = livePatient?.status;
    const isInBed = liveStatus === "er_bed" || liveStatus === "discharge" || liveStatus === "done";
    const groundTruth = baselineSelectedPid ? baselineGroundTruth.get(baselineSelectedPid) : undefined;

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 min-h-0 overflow-hidden border-t border-border/30">
          {selectedPatient ? (
            <PatientFileViewer patient={selectedPatient} showDischarge={isInBed} dischargeData={isInBed ? groundTruth?.discharge_papers : undefined} />
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-2 shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/50">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-[11px] font-mono font-bold text-foreground/90 uppercase tracking-widest">
                  Patient File
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center bg-gray-50/50">
                <p className="text-muted-foreground/30 text-[11px] font-mono text-center px-6 leading-relaxed">
                  Click a patient on the board to view their file here.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="h-[150px] shrink-0 border-t border-border/30 overflow-hidden">
          <LogPanel entries={entries} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toggle buttons */}
      <div className="flex shrink-0 border-y border-border/30">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            className={cn(
              "flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors relative flex items-center justify-center gap-2",
              tab === key
                ? "text-foreground/90 bg-gray-100 border-b-2 border-foreground/80"
                : "text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-gray-50"
            )}
            onClick={() => setTab(key)}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                "inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-mono font-bold leading-none",
                tab === key
                  ? "bg-emerald-500 text-white"
                  : "bg-red-500 text-white"
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active panel + log always at bottom */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === "nurse" ? <SidebarNurse /> : <SidebarDoctor />}
        </div>
        <div className="h-[150px] shrink-0 border-t border-border/30 overflow-hidden">
          <LogPanel entries={entries} />
        </div>
      </div>
    </div>
  );
}
