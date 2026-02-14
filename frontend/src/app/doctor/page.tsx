"use client";

import { useState, useMemo } from "react";
import { Patient } from "@/lib/types";
import * as api from "@/lib/api";
import { usePatientContext } from "@/context/PatientContext";
import { PatientRow } from "@/components/PatientRow";
import { ElapsedTime } from "@/components/ElapsedTime";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DoctorPage() {
  const { patients, updatePatient, dischargePatient, eventLog } = usePatientContext();

  const dischargeFlagTimes = useMemo(() => {
    const map = new Map<string, Date>();
    for (const entry of eventLog) {
      if (entry.event === "flagged_discharge") {
        map.set(entry.pid, entry.timestamp);
      }
    }
    return map;
  }, [eventLog]);

  const [search, setSearch] = useState("");
  const [expandedPid, setExpandedPid] = useState<string | null>(null);
  const [editingPid, setEditingPid] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, any>>>({});

  const doctorEditableFields = useMemo(() => new Set(["chief_complaint", "primary_diagnoses", "plan", "triage_notes", "justification"]), []);

  const getDraft = (p: Patient) => drafts[p.pid] ?? {
    chief_complaint: p.chief_complaint ?? "",
    primary_diagnoses: p.primary_diagnoses ?? "",
    plan: p.plan ?? "",
    triage_notes: p.triage_notes ?? "",
    justification: p.justification ?? "",
  };

  const handleStartEdit = (pid: string, patient: Patient) => {
    setEditingPid(pid);
    setDrafts((prev) => ({
      ...prev,
      [pid]: {
        chief_complaint: patient.chief_complaint ?? "",
        primary_diagnoses: patient.primary_diagnoses ?? "",
        plan: patient.plan ?? "",
        triage_notes: patient.triage_notes ?? "",
        justification: patient.justification ?? "",
      },
    }));
  };

  const handleFieldChange = (pid: string, field: string, value: any) => {
    setDrafts((prev) => ({
      ...prev,
      [pid]: { ...prev[pid], [field]: value },
    }));
  };

  const readyForDischarge = useMemo(() => {
    const filtered = patients.filter(
      (p) => p.status === "er_bed" && p.color === "green"
    );
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, search]);

  const handleRejectAndSave = (pid: string, changes: Partial<Patient>) => {
    const allChanges = { ...changes, color: "grey" as const };
    api.updatePatient(pid, allChanges);
    updatePatient(pid, allChanges);
    setEditingPid(null);
  };

  const handleToggle = (pid: string) => {
    if (expandedPid === pid) {
      setExpandedPid(null);
      setEditingPid(null);
    } else {
      setExpandedPid(pid);
      setEditingPid(null);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-52px)] grid-bg">
      <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-2 max-w-2xl mx-auto w-full">
        <h2 className="text-sm font-mono font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          Ready for Discharge
          <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {readyForDischarge.length}
          </span>
        </h2>
        {readyForDischarge.length === 0 && (
          <p className="text-muted-foreground text-xs font-mono py-8 text-center">
            No patients ready for discharge.
          </p>
        )}
        {readyForDischarge.map((p) => (
          <PatientRow
            key={p.pid}
            patient={p}
            expanded={expandedPid === p.pid}
            onToggle={() => handleToggle(p.pid)}
            editableFields={editingPid === p.pid ? doctorEditableFields : undefined}
            draft={editingPid === p.pid ? getDraft(p) : undefined}
            onFieldChange={editingPid === p.pid ? (field, value) => handleFieldChange(p.pid, field, value) : undefined}
            headerExtra={dischargeFlagTimes.has(p.pid) ? <ElapsedTime since={dischargeFlagTimes.get(p.pid)!} className="text-emerald-400 text-[10px] shrink-0" /> : undefined}
          >
            {editingPid === p.pid ? (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="destructive" className="font-mono text-xs" onClick={() => handleRejectAndSave(p.pid, getDraft(p))}>
                  Reject
                </Button>
                <Button size="sm" variant="outline" className="font-mono text-xs border-border/40" onClick={() => setEditingPid(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => dischargePatient(p.pid)}>
                  Review Discharge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs border-border/40"
                  onClick={() => handleStartEdit(p.pid, p)}
                >
                  Reject & Edit
                </Button>
              </div>
            )}
          </PatientRow>
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

