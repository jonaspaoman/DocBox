"use client";

import { useMemo, useState } from "react";
import { Patient, LogEntry } from "@/lib/types";

interface MetricsBarProps {
  patients: Patient[];
  eventLog: LogEntry[];
  currentTick: number;
}

// CMS average ER reimbursement by ESI acuity level
const ESI_RATES: Record<number, number> = {
  1: 2500,
  2: 1800,
  3: 1200,
  4: 600,
  5: 300,
};

// National average ER length of stay: ~4.5 hours
const NATIONAL_AVG_MINUTES = 270;
// Each simulation tick represents 3 real-world minutes
const MINUTES_PER_TICK = 3;

const METHODOLOGY: Record<string, string> = {
  Revenue:
    "Total CMS reimbursement for discharged patients based on ESI acuity. ESI 1: $2,500 · 2: $1,800 · 3: $1,200 · 4: $600 · 5: $300.",
  "Rev / Hr":
    "Total revenue ÷ simulated hours elapsed (current tick × 3 min per tick ÷ 60).",
  Discharged:
    "Number of patients fully discharged through the ER pipeline.",
  "Avg Stay":
    "Average simulated length of stay from call-in to discharge (tick delta × 3 min/tick).",
  "Saved / Pt":
    "Minutes saved per patient vs. national avg ER visit of 270 min (4.5 hrs). = 270 − avg stay.",
  "Bed Util":
    "Percentage of the 16 hospital beds currently occupied.",
};

export function MetricsBar({ patients, eventLog, currentTick }: MetricsBarProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const donePatients = patients.filter((p) => p.status === "done");
    const discharged = donePatients.length;

    // Revenue: sum CMS rate by ESI for all discharged patients
    const totalRevenue = donePatients.reduce((sum, p) => {
      return sum + (ESI_RATES[p.esi_score ?? 3] ?? 1200);
    }, 0);

    // Revenue per simulated hour
    const simMinutes = currentTick * MINUTES_PER_TICK;
    const simHours = simMinutes / 60;
    const revenuePerHour = simHours > 0 ? totalRevenue / simHours : 0;

    // Average length of stay: first event tick → discharged/marked_done tick
    const patientTicks = new Map<string, { first?: number; completed?: number }>();
    for (const entry of eventLog) {
      if (!patientTicks.has(entry.pid)) {
        patientTicks.set(entry.pid, { first: entry.tick });
      }
      if (entry.event === "discharged" || entry.event === "marked_done") {
        patientTicks.get(entry.pid)!.completed = entry.tick;
      }
    }

    let totalStayMin = 0;
    let completedCount = 0;

    for (const [, rec] of patientTicks) {
      if (rec.first != null && rec.completed != null) {
        totalStayMin += (rec.completed - rec.first) * MINUTES_PER_TICK;
        completedCount++;
      }
    }

    const avgStayMin = completedCount > 0 ? totalStayMin / completedCount : 0;
    const savedPerPatient = completedCount > 0
      ? Math.max(0, NATIONAL_AVG_MINUTES - avgStayMin)
      : 0;

    // Bed utilization
    const occupiedBeds = patients.filter((p) => p.bed_number != null && p.status === "er_bed").length;
    const bedUtil = occupiedBeds / 16;

    return { totalRevenue, revenuePerHour, discharged, avgStayMin, savedPerPatient, bedUtil };
  }, [patients, eventLog, currentTick]);

  const cards: { label: string; value: string }[] = [
    { label: "Revenue", value: `$${metrics.totalRevenue.toLocaleString()}` },
    { label: "Rev / Hr", value: `$${Math.round(metrics.revenuePerHour).toLocaleString()}` },
    { label: "Discharged", value: String(metrics.discharged) },
    { label: "Avg Stay", value: `${Math.round(metrics.avgStayMin)}m` },
    { label: "Saved / Pt", value: `${Math.round(metrics.savedPerPatient)}m` },
    { label: "Bed Util", value: `${Math.round(metrics.bedUtil * 100)}%` },
  ];

  return (
    <div className="bg-white px-3 pt-3 pb-3 shrink-0">
      <div className="flex items-center gap-2 mb-2.5">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" className="text-emerald-600" strokeWidth="1.5" strokeLinecap="round">
          <rect x="1" y="8" width="3" height="7" rx="0.5" />
          <rect x="6.5" y="4" width="3" height="11" rx="0.5" />
          <rect x="12" y="1" width="3" height="14" rx="0.5" />
        </svg>
        <span className="text-[11px] font-mono font-bold text-gray-900 uppercase tracking-widest">
          Metrics
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="flex flex-col items-center rounded-md border border-border/40 bg-emerald-50 px-1.5 py-2 relative cursor-default transition-colors hover:border-emerald-500/30"
            onMouseEnter={() => setHoveredCard(c.label)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider leading-none mb-1">
              {c.label}
            </span>
            <span className="text-[14px] font-mono tabular-nums font-bold text-emerald-600 leading-none">
              {c.value}
            </span>
            {hoveredCard === c.label && METHODOLOGY[c.label] && (
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 w-56 px-3 py-2 rounded-md border border-gray-200 bg-white text-[10px] font-mono text-gray-700 leading-relaxed z-50 shadow-lg pointer-events-none">
                <span className="font-bold text-emerald-600">{c.label}:</span>{" "}
                {METHODOLOGY[c.label]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
