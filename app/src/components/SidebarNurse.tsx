"use client";

import { useState, useMemo, useEffect } from "react";
import { Patient } from "@/lib/types";
import * as api from "@/lib/api";
import { usePatientContext } from "@/context/PatientContext";
import { ElapsedTime } from "@/components/ElapsedTime";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ESI_VARIANT: Record<number, "default" | "secondary" | "destructive" | "outline"> = {
  1: "destructive",
  2: "destructive",
  3: "default",
  4: "secondary",
  5: "outline",
};

const COLOR_BORDER: Record<string, string> = {
  grey: "border-l-gray-500",
  yellow: "border-l-yellow-500",
  green: "border-l-emerald-500",
  red: "border-l-red-500",
};

export function SidebarNurse() {
  const { patients, updatePatient, acceptPatient, eventLog } = usePatientContext();

  const arrivalTimes = useMemo(() => {
    const map = new Map<string, Date>();
    for (const entry of eventLog) {
      if (!map.has(entry.pid)) {
        map.set(entry.pid, entry.timestamp);
      }
    }
    return map;
  }, [eventLog]);

  const [search, setSearch] = useState("");
  const [selectedPid, setSelectedPid] = useState<string | null>(null);

  const calledIn = useMemo(() => {
    let filtered = patients.filter((p) => p.status === "called_in");
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
    }
    filtered.sort((a, b) => {
      const ta = arrivalTimes.get(a.pid)?.getTime() ?? 0;
      const tb = arrivalTimes.get(b.pid)?.getTime() ?? 0;
      return tb - ta;
    });
    return filtered;
  }, [patients, search, arrivalTimes]);

  const selectedPatient = selectedPid ? patients.find((p) => p.pid === selectedPid) : null;

  // If selected patient no longer exists or is no longer called_in, deselect
  useEffect(() => {
    if (selectedPid && !selectedPatient) setSelectedPid(null);
  }, [selectedPid, selectedPatient]);

  // Inline detail view
  if (selectedPid && selectedPatient) {
    return (
      <NurseDetail
        patient={selectedPatient}
        arrivalTime={arrivalTimes.get(selectedPid)}
        onBack={() => setSelectedPid(null)}
        onAccept={() => {
          acceptPatient(selectedPid);
          setSelectedPid(null);
        }}
        onSave={(changes) => {
          api.updatePatient(selectedPid, changes);
          updatePatient(selectedPid, changes);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] font-mono font-bold text-foreground/90 uppercase tracking-widest">
            Nurse Inbox
          </span>
          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            {calledIn.length}
          </span>
        </div>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-[11px] font-mono border border-gray-200 rounded bg-gray-50 placeholder:text-muted-foreground/30"
        />
      </div>

      {/* Patient list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {calledIn.length === 0 ? (
          <p className="text-muted-foreground/30 text-[11px] font-mono py-8 text-center">
            No incoming patients.
          </p>
        ) : (
          <div className="py-1 space-y-1 px-2">
            {calledIn.map((p) => (
              <button
                key={p.pid}
                type="button"
                className={cn(
                  "w-full rounded border-l-[3px] border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left px-3 py-2",
                  COLOR_BORDER[p.color] || "border-l-gray-500"
                )}
                onClick={() => setSelectedPid(p.pid)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium font-mono text-[12px] truncate text-foreground/90">{p.name}</span>
                  <div className="flex-1" />
                  {p.esi_score != null && (
                    <Badge variant={ESI_VARIANT[p.esi_score] ?? "outline"} className="shrink-0 font-mono text-[9px] px-1.5 py-0">
                      ESI {p.esi_score}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.age != null && p.sex && (
                    <span className="text-muted-foreground/50 text-[10px] font-mono">
                      {p.age} {p.sex.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1" />
                  {arrivalTimes.get(p.pid) && (
                    <ElapsedTime since={arrivalTimes.get(p.pid)!} className="text-yellow-600 text-[10px] font-mono" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NurseDetail({
  patient,
  arrivalTime,
  onBack,
  onAccept,
  onSave,
}: {
  patient: Patient;
  arrivalTime?: Date;
  onBack: () => void;
  onAccept: () => void;
  onSave: (changes: Partial<Patient>) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    name: patient.name,
    age: patient.age ?? 0,
    sex: patient.sex ?? "",
    chief_complaint: patient.chief_complaint ?? "",
    triage_notes: patient.triage_notes ?? "",
    esi_score: patient.esi_score ?? 3,
  }));

  useEffect(() => {
    setDraft({
      name: patient.name,
      age: patient.age ?? 0,
      sex: patient.sex ?? "",
      chief_complaint: patient.chief_complaint ?? "",
      triage_notes: patient.triage_notes ?? "",
      esi_score: patient.esi_score ?? 3,
    });
  }, [patient]);

  const handleAccept = () => {
    onSave({
      name: draft.name,
      age: draft.age,
      sex: draft.sex,
      chief_complaint: draft.chief_complaint,
      triage_notes: draft.triage_notes,
      esi_score: draft.esi_score,
    });
    onAccept();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/70">
      {/* Single rounded card */}
      <div className="flex flex-col flex-1 min-h-0 m-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Card header — pinned */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60 shrink-0">
            <button onClick={onBack} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1 -ml-1">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="10 12 6 8 10 4" />
              </svg>
            </button>
            <span className="text-[14px] font-mono font-bold text-foreground/90 truncate">{patient.name}</span>
            {arrivalTime && (
              <ElapsedTime since={arrivalTime} className="text-yellow-600 text-[11px] font-mono shrink-0" />
            )}
          </div>

        {/* Card body — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-5">
            {/* Demographics */}
            <div>
              <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-3">Demographics</span>
              <div className="space-y-2.5 text-[12px] font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-12 shrink-0 font-medium">Name</span>
                  <input
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-foreground/90 outline-none text-[12px] font-mono focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-12 shrink-0 font-medium">Age</span>
                  <input
                    type="number"
                    className="w-20 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-foreground/90 outline-none text-[12px] font-mono focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                    value={draft.age}
                    onChange={(e) => setDraft({ ...draft, age: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-12 shrink-0 font-medium">Sex</span>
                  <select
                    className="bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-foreground/90 outline-none text-[12px] font-mono focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                    value={draft.sex}
                    onChange={(e) => setDraft({ ...draft, sex: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider w-12 shrink-0 font-medium">ESI</span>
                  <select
                    className="bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-foreground/90 outline-none text-[12px] font-mono focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                    value={draft.esi_score}
                    onChange={(e) => setDraft({ ...draft, esi_score: parseInt(e.target.value) })}
                  >
                    <option value={1}>1 — Resuscitation</option>
                    <option value={2}>2 — Emergent</option>
                    <option value={3}>3 — Urgent</option>
                    <option value={4}>4 — Less Urgent</option>
                    <option value={5}>5 — Non-Urgent</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Chief Complaint */}
            <div>
              <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-2">Chief Complaint</span>
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-[12px] text-foreground/90 outline-none font-mono focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                value={draft.chief_complaint}
                onChange={(e) => setDraft({ ...draft, chief_complaint: e.target.value })}
              />
            </div>

            <div className="h-px bg-gray-100" />

            {/* Triage Notes */}
            <div>
              <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-2">Triage Notes</span>
              <textarea
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-[12px] font-mono min-h-[80px] resize-y text-foreground/90 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 leading-relaxed"
                value={draft.triage_notes}
                onChange={(e) => setDraft({ ...draft, triage_notes: e.target.value })}
              />
            </div>

            {patient.pmh && (
              <>
                <div className="h-px bg-gray-100" />
                <InlineSection label="Past Medical History" value={patient.pmh} />
              </>
            )}
            {patient.family_social_history && (
              <>
                <div className="h-px bg-gray-100" />
                <InlineSection label="Family / Social History" value={patient.family_social_history} />
              </>
            )}
        </div>

        {/* Card footer — pinned */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/40 shrink-0">
          <Button
            className="font-mono text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 h-7 whitespace-nowrap"
            onClick={handleAccept}
          >
            Accept → Waiting Room
          </Button>
          <Button
            variant="outline"
            className="font-mono text-[11px] border-gray-200 text-muted-foreground hover:text-foreground h-7"
            onClick={onBack}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}

function InlineSection({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-[10px] font-mono font-bold text-foreground/50 uppercase tracking-wider block mb-2">{label}</span>
      {value ? (
        <p className="text-[12px] leading-relaxed text-foreground/80">{value}</p>
      ) : (
        <p className="text-[12px] text-muted-foreground/25 italic">Pending</p>
      )}
    </div>
  );
}
