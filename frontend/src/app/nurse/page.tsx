"use client";

import { useState, useMemo, useEffect } from "react";
import { Patient } from "@/lib/types";
import * as api from "@/lib/api";
import { usePatientContext } from "@/context/PatientContext";
import { PatientRow } from "@/components/PatientRow";
import { ElapsedTime } from "@/components/ElapsedTime";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [expandedPid, setExpandedPid] = useState<string | null>(null);

  const calledIn = useMemo(() => {
    let filtered = patients.filter((p) => p.status === "called_in");
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
    }
    // Most recent first
    filtered.sort((a, b) => {
      const ta = arrivalTimes.get(a.pid)?.getTime() ?? 0;
      const tb = arrivalTimes.get(b.pid)?.getTime() ?? 0;
      return tb - ta;
    });
    return filtered;
  }, [patients, search, arrivalTimes]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-52px)] grid-bg">
      <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-2 max-w-2xl mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-lg font-mono font-bold text-foreground/90 tracking-wide">Nurse Inbox</h1>
          <p className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">Review and triage incoming patients</p>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {calledIn.length} pending
          </span>
        </div>
        {calledIn.length === 0 && (
          <p className="text-muted-foreground text-xs font-mono py-8 text-center">
            No notifications right now.
          </p>
        )}
        {calledIn.map((p) => (
          <NursePatientRow
            key={p.pid}
            patient={p}
            arrivalTime={arrivalTimes.get(p.pid)}
            expanded={expandedPid === p.pid}
            onToggle={() => setExpandedPid(expandedPid === p.pid ? null : p.pid)}
            onAccept={() => acceptPatient(p.pid)}
            onSave={(changes) => {
              api.updatePatient(p.pid, changes);
              updatePatient(p.pid, changes);
            }}
          />
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
    </div>
  );
}

function NursePatientRow({
  patient,
  arrivalTime,
  expanded,
  onToggle,
  onAccept,
  onSave,
}: {
  patient: Patient;
  arrivalTime?: Date;
  expanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onSave: (changes: Partial<Patient>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({
    name: patient.name,
    age: patient.age ?? 0,
    sex: patient.sex ?? "",
    chief_complaint: patient.chief_complaint ?? "",
    triage_notes: patient.triage_notes ?? "",
    esi_score: patient.esi_score ?? 3,
  }));

  useEffect(() => {
    if (!editing) {
      setDraft({
        name: patient.name,
        age: patient.age ?? 0,
        sex: patient.sex ?? "",
        chief_complaint: patient.chief_complaint ?? "",
        triage_notes: patient.triage_notes ?? "",
        esi_score: patient.esi_score ?? 3,
      });
    }
  }, [patient, editing]);

  const handleSave = () => {
    onSave({
      name: draft.name,
      age: draft.age,
      sex: draft.sex,
      chief_complaint: draft.chief_complaint,
      triage_notes: draft.triage_notes,
      esi_score: draft.esi_score,
    });
    setEditing(false);
  };

  const nurseEditableFields = useMemo(() => new Set(["name", "age", "sex", "esi_score", "chief_complaint", "triage_notes"]), []);

  return (
    <PatientRow
      patient={patient}
      expanded={expanded}
      onToggle={onToggle}
      editableFields={editing ? nurseEditableFields : undefined}
      draft={editing ? draft : undefined}
      onFieldChange={editing ? (field, value) => setDraft({ ...draft, [field]: value }) : undefined}
      subject="Incoming Patient"
      subjectColor="text-yellow-400"
      headerExtra={arrivalTime ? <ElapsedTime since={arrivalTime} className="text-yellow-400 text-[10px] shrink-0" /> : undefined}
    >
      {editing ? (
        <div className="flex gap-2 mt-2">
          <Button size="sm" className="font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSave}>
            Save
          </Button>
          <Button size="sm" variant="outline" className="font-mono text-xs border-border/40" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="font-mono text-xs border-border/40" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" className="font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onAccept}>
            Accept → Waiting Room
          </Button>
        </div>
      )}
    </PatientRow>
  );
}
