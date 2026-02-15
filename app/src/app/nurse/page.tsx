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
      <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-2 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2.5 mb-3">
          <h1 className="text-lg font-mono font-bold text-foreground/90 tracking-wide">Nurse Inbox</h1>
          <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {calledIn.length}
          </span>
        </div>
        {calledIn.length === 0 && (
          <p className="text-muted-foreground text-xs font-mono py-8 text-center">
            No notifications right now.
          </p>
        )}
        {calledIn.map((p) => (
          <button
            key={p.pid}
            type="button"
            className={cn(
              "w-full rounded-md border-l-2 border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left px-4 py-3",
              COLOR_BORDER[p.color] || "border-l-gray-500"
            )}
            onClick={() => setSelectedPid(p.pid)}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium font-mono text-sm truncate text-foreground/90">{p.name}</span>
              {p.age != null && p.sex && (
                <span className="text-muted-foreground text-xs font-mono shrink-0">
                  {p.age}{p.sex.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-muted-foreground text-xs font-mono truncate flex-1 text-right">
                {p.chief_complaint ?? "—"}
              </span>
              {p.esi_score != null && (
                <Badge variant={ESI_VARIANT[p.esi_score] ?? "outline"} className="shrink-0 font-mono text-[10px]">
                  ESI {p.esi_score}
                </Badge>
              )}
              {arrivalTimes.get(p.pid) && (
                <ElapsedTime since={arrivalTimes.get(p.pid)!} className="text-yellow-400 text-[10px] shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="fixed bottom-4 left-0 right-0 px-4 z-10">
        <div className="max-w-2xl mx-auto">
          <Input
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 text-sm font-mono shadow-lg border border-border/40 rounded-lg bg-[#1a1a1a]"
          />
        </div>
      </div>

      {/* ===== Patient Modal (edit mode) ===== */}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-8 mb-8 w-full max-w-2xl max-h-[calc(100vh-64px)] flex flex-col rounded-xl border border-border/40 bg-[oklch(0.13_0_0)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-white">{patient.name}</span>
            {arrivalTime && (
              <ElapsedTime since={arrivalTime} className="text-yellow-400/70 text-[10px]" />
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-white transition-colors p-1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {/* Editable demographics */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs font-mono rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
            <span className="text-muted-foreground/50 uppercase">Name</span>
            <input
              className="bg-transparent border-b border-white/20 text-foreground/80 outline-none text-xs font-mono focus:border-emerald-500/40 pb-0.5"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <span className="text-muted-foreground/50 uppercase">Age</span>
            <input
              type="number"
              className="bg-transparent border-b border-white/20 text-foreground/80 outline-none text-xs font-mono w-16 focus:border-emerald-500/40 pb-0.5"
              value={draft.age}
              onChange={(e) => setDraft({ ...draft, age: parseInt(e.target.value) || 0 })}
            />
            <span className="text-muted-foreground/50 uppercase">Sex</span>
            <select
              className="bg-transparent border-b border-white/20 text-foreground/80 outline-none text-xs font-mono focus:border-emerald-500/40"
              value={draft.sex}
              onChange={(e) => setDraft({ ...draft, sex: e.target.value })}
            >
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
            <span className="text-muted-foreground/50 uppercase">ESI</span>
            <select
              className="bg-transparent border-b border-white/20 text-foreground/80 outline-none text-xs font-mono focus:border-emerald-500/40"
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

          {/* Chief Complaint */}
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">Chief Complaint</span>
            <input
              className="w-full mt-1 bg-transparent border-b border-white/20 text-sm text-foreground/80 outline-none font-mono focus:border-emerald-500/40 pb-0.5"
              value={draft.chief_complaint}
              onChange={(e) => setDraft({ ...draft, chief_complaint: e.target.value })}
            />
          </div>

          {/* Triage Notes */}
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">Triage Notes</span>
            <textarea
              className="w-full mt-1 rounded-md border border-white/[0.15] bg-white/[0.04] px-2 py-1.5 text-sm font-mono min-h-[60px] resize-y text-foreground/80 outline-none focus:border-emerald-500/40"
              value={draft.triage_notes}
              onChange={(e) => setDraft({ ...draft, triage_notes: e.target.value })}
            />
          </div>

          {patient.pmh && <ReadOnlySection label="Past Medical History" value={patient.pmh} />}
          {patient.family_social_history && <ReadOnlySection label="Family / Social Hx" value={patient.family_social_history} />}
        </div>

        {/* Modal footer — sticky at bottom */}
        <div className="flex gap-2 px-4 py-2.5 border-t border-border/30 bg-[oklch(0.13_0_0)] shrink-0">
          <Button
            size="sm"
            className="font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleAccept}
          >
            Accept → Waiting Room
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="font-mono text-xs border-border/40"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReadOnlySection({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
      <span className="text-[10px] font-mono font-semibold text-muted-foreground/50 uppercase tracking-widest">{label}</span>
      <p className="text-[13px] mt-0.5 leading-snug text-foreground/80">{value}</p>
    </div>
  );
}
