"use client";

import { Patient } from "@/lib/types";
import { PatientDot } from "./PatientDot";

interface ColumnProps {
  title: string;
  patients: Patient[];
  onPatientClick: (patient: Patient) => void;
  className?: string;
  accentColor?: string;
  compact?: boolean;
  waitTimes?: Map<string, Date>;
  showEsi?: boolean;
  overduePids?: Set<string>;
}

export function Column({ title, patients, onPatientClick, className = "", accentColor = "border-l-muted-foreground/20", compact = false, waitTimes, showEsi = false, overduePids }: ColumnProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-2.5 px-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground/70">
          {title}
        </h3>
        <span className="text-xs font-mono font-semibold text-emerald-600 tabular-nums bg-emerald-50 px-2 py-0.5 rounded-full">
          {patients.length}
        </span>
      </div>
      <div className={`flex flex-col gap-1.5 px-3 py-3 rounded-lg border border-gray-200 bg-white/80 overflow-y-auto border-l-[3px] ${compact ? "h-[120px]" : "h-[320px]"} ${accentColor}`}>
        {[...patients]
          .sort((a, b) => {
            // Overdue patients first
            const aOver = overduePids?.has(a.pid) ? 0 : 1;
            const bOver = overduePids?.has(b.pid) ? 0 : 1;
            if (aOver !== bOver) return aOver - bOver;
            // Red patients next
            if (a.color === "red" && b.color !== "red") return -1;
            if (b.color === "red" && a.color !== "red") return 1;
            // Then by ESI score (lowest = most urgent first)
            const esiA = a.esi_score ?? 5;
            const esiB = b.esi_score ?? 5;
            if (esiA !== esiB) return esiA - esiB;
            return 0;
          })
          .map((p) => (
            <PatientDot key={p.pid} patient={p} onClick={() => onPatientClick(p)} waitSince={waitTimes?.get(p.pid)} showEsi={showEsi} overdue={overduePids?.has(p.pid)} />
          ))}
      </div>
    </div>
  );
}
