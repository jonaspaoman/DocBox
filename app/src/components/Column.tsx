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
}

export function Column({ title, patients, onPatientClick, className = "", accentColor = "border-l-muted-foreground/20", compact = false, waitTimes, showEsi = false }: ColumnProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-2 px-3">
        <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
        <span className="text-[10px] font-mono text-emerald-600 tabular-nums bg-emerald-50 px-1.5 py-0.5 rounded">
          {patients.length}
        </span>
      </div>
      <div className={`flex flex-col gap-1 px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50 overflow-y-auto border-l-2 ${compact ? "h-[100px]" : "h-[280px]"} ${accentColor}`}>
        {[...patients]
          .sort((a, b) => (a.color === "red" ? -1 : b.color === "red" ? 1 : 0))
          .map((p) => (
            <PatientDot key={p.pid} patient={p} onClick={() => onPatientClick(p)} waitSince={waitTimes?.get(p.pid)} showEsi={showEsi} />
          ))}
      </div>
    </div>
  );
}
