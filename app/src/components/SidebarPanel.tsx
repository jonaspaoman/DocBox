"use client";

import { useState, useMemo } from "react";
import { LogPanel } from "@/components/LogPanel";
import { SidebarNurse } from "@/components/SidebarNurse";
import { SidebarDoctor } from "@/components/SidebarDoctor";
import { usePatientContext } from "@/context/PatientContext";
import { LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type SidebarTab = "nurse" | "doctor";

interface SidebarPanelProps {
  entries: LogEntry[];
}

export function SidebarPanel({ entries }: SidebarPanelProps) {
  const [tab, setTab] = useState<SidebarTab>("nurse");
  const { patients } = usePatientContext();

  const nurseCount = useMemo(() => patients.filter((p) => p.status === "called_in").length, [patients]);
  const doctorCount = useMemo(() => patients.filter((p) => p.status === "er_bed" && (p.color === "green" || p.color === "red")).length, [patients]);

  const tabs: { key: SidebarTab; label: string; count: number }[] = [
    { key: "nurse", label: "Nurse", count: nurseCount },
    { key: "doctor", label: "Doctor", count: doctorCount },
  ];

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
