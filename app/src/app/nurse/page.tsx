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

export default function NursePage() {
  const { patients, updatePatient, acceptPatient, eventLog } = usePatientContext();

  const arrivalTimes = useMemo(() => {
    const map = new Map<string, Date>();
    for (const entry of eventLog) {
      if (entry.event === "called_in" && !map.has(entry.pid)) {
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-52px)] grid-bg">
      {/* Sticky header */}
      <div className="sticky top-[52px] z-10 px-5 pt-4 pb-3 bg-[oklch(0.13_0_0)]/95 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-base font-mono font-bold text-foreground/90 tracking-wide">Nurse Inbox</h1>
            <span className="text-[11px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {calledIn.length}
            </span>
          </div>
          <Input
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm font-mono border border-white/[0.08] rounded-lg bg-white/[0.03] placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      {/* Patient list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 max-w-xl mx-auto w-full">
        <div className="space-y-2.5">
          {calledIn.length === 0 && (
            <p className="text-muted-foreground/50 text-sm font-mono py-12 text-center">
              No incoming patients.
            </p>
          )}
          {calledIn.map((p) => (
            <button
              key={p.pid}
              type="button"
              className={cn(
                "w-full rounded-lg border-l-[3px] border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left px-5 py-3.5",
                COLOR_BORDER[p.color] || "border-l-gray-500"
              )}
              onClick={() => setSelectedPid(p.pid)}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium font-mono text-[15px] truncate text-foreground/90">{p.name}</span>
                {p.age != null && p.sex && (
                  <span className="text-muted-foreground/50 text-sm font-mono shrink-0">
                    {p.age} {p.sex.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex-1" />
                {p.esi_score != null && (
                  <Badge variant={ESI_VARIANT[p.esi_score] ?? "outline"} className="shrink-0 font-mono text-[10px]">
                    ESI {p.esi_score}
                  </Badge>
                )}
                {arrivalTimes.get(p.pid) && (
                  <ElapsedTime since={arrivalTimes.get(p.pid)!} className="text-yellow-400/60 text-[11px] font-mono shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Patient modal */}
      {selectedPid && selectedPatient && (
        <NurseModal
          patient={selectedPatient}
          arrivalTime={arrivalTimes.get(selectedPid)}
          onClose={() => setSelectedPid(null)}
          onAccept={() => {
            acceptPatient(selectedPid);
            setSelectedPid(null);
          }}
          onSave={(changes) => {
            api.updatePatient(selectedPid, changes);
            updatePatient(selectedPid, changes);
          }}
        />
      )}
    </div>
  );
}

function NurseModal({
  patient,
  arrivalTime,
  onClose,
  onAccept,
  onSave,
}: {
  patient: Patient;
  arrivalTime?: Date;
  onClose: () => void;
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl flex flex-col border-x border-white/[0.06] bg-[oklch(0.13_0_0)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-mono font-bold text-white">{patient.name}</span>
            {arrivalTime && (
              <ElapsedTime since={arrivalTime} className="text-yellow-400/60 text-[11px] font-mono" />
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground/40 hover:text-white transition-colors p-1.5 -mr-1.5">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {/* Demographics */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
              <div className="grid grid-cols-[100px_1fr] gap-y-3 text-sm font-mono">
                <span className="text-[11px] text-muted-foreground/40 uppercase tracking-wider self-center">Name</span>
                <input
                  className="bg-transparent border-b border-white/[0.12] text-foreground/85 outline-none text-sm font-mono focus:border-emerald-500/40 pb-1"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <span className="text-[11px] text-muted-foreground/40 uppercase tracking-wider self-center">Age</span>
                <input
                  type="number"
                  className="bg-transparent border-b border-white/[0.12] text-foreground/85 outline-none text-sm font-mono w-20 focus:border-emerald-500/40 pb-1"
                  value={draft.age}
                  onChange={(e) => setDraft({ ...draft, age: parseInt(e.target.value) || 0 })}
                />
                <span className="text-[11px] text-muted-foreground/40 uppercase tracking-wider self-center">Sex</span>
                <select
                  className="bg-transparent border-b border-white/[0.12] text-foreground/85 outline-none text-sm font-mono focus:border-emerald-500/40 pb-1 w-20"
                  value={draft.sex}
                  onChange={(e) => setDraft({ ...draft, sex: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
                <span className="text-[11px] text-muted-foreground/40 uppercase tracking-wider self-center">ESI</span>
                <select
                  className="bg-transparent border-b border-white/[0.12] text-foreground/85 outline-none text-sm font-mono focus:border-emerald-500/40 pb-1"
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

            {/* Chief Complaint */}
            <Section label="Chief Complaint">
              <input
                className="w-full bg-transparent border-b border-white/[0.12] text-sm text-foreground/85 outline-none font-mono focus:border-emerald-500/40 pb-1"
                value={draft.chief_complaint}
                onChange={(e) => setDraft({ ...draft, chief_complaint: e.target.value })}
              />
            </Section>

            {/* Triage Notes */}
            <Section label="Triage Notes">
              <textarea
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm font-mono min-h-[80px] resize-y text-foreground/85 outline-none focus:border-emerald-500/40 leading-relaxed"
                value={draft.triage_notes}
                onChange={(e) => setDraft({ ...draft, triage_notes: e.target.value })}
              />
            </Section>

            {/* Read-only sections */}
            <ReadOnlySection label="Past Medical History" value={patient.pmh} />
            <ReadOnlySection label="Family / Social History" value={patient.family_social_history} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/[0.06] bg-[oklch(0.13_0_0)] shrink-0">
          <Button
            className="font-mono text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-9"
            onClick={handleAccept}
          >
            Accept → Waiting Room
          </Button>
          <Button
            variant="outline"
            className="font-mono text-sm border-white/[0.1] text-muted-foreground hover:text-foreground h-9"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
      <span className="text-[11px] font-mono font-semibold text-muted-foreground/40 uppercase tracking-wider block mb-2">{label}</span>
      {children}
    </div>
  );
}

function ReadOnlySection({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
      <span className="text-[11px] font-mono font-semibold text-muted-foreground/40 uppercase tracking-wider block mb-1.5">{label}</span>
      {value ? (
        <p className="text-sm leading-relaxed text-foreground/80">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground/25 italic">Pending</p>
      )}
    </div>
  );
}
