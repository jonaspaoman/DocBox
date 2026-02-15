"use client";

import { Patient } from "@/lib/types";
import { PatientDot } from "./PatientDot";
import { usePatientContext } from "@/context/PatientContext";

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
  icon?: React.ReactNode;
  titleColor?: string;
}

export function Column({ title, patients, onPatientClick, className = "", accentColor = "border-l-muted-foreground/20", compact = false, waitTimes, showEsi = false, overduePids, icon, titleColor }: ColumnProps) {
  const { appMode } = usePatientContext();
  const isBaseline = appMode === "baseline";
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-1 px-2">
        <h3 className={`text-[11px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 ${titleColor ?? "text-foreground/70"}`}>
          {icon}
          {title}
        </h3>
        <span className="text-[11px] font-mono font-semibold text-emerald-600 tabular-nums bg-emerald-50 px-1.5 py-0.5 rounded-full">
          {patients.length}
        </span>
      </div>
      <div className={`flex flex-col gap-1 px-2.5 py-2 rounded-lg border border-gray-200 bg-white/80 overflow-y-auto border-l-[3px] ${compact ? "h-[56px]" : "h-[260px]"} ${accentColor}`}>
        {[...patients]
          .sort((a, b) => {
            if (!isBaseline) {
              // Overdue patients first
              const aOver = overduePids?.has(a.pid) ? 0 : 1;
              const bOver = overduePids?.has(b.pid) ? 0 : 1;
              if (aOver !== bOver) return aOver - bOver;
              // Red patients next
              if (a.color === "red" && b.color !== "red") return -1;
              if (b.color === "red" && a.color !== "red") return 1;
            }
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
