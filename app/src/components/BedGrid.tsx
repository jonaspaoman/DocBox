"use client";

import { Patient } from "@/lib/types";
import { PatientDot } from "./PatientDot";

interface BedGridProps {
  patients: Patient[];
  onPatientClick: (patient: Patient) => void;
  waitTimes?: Map<string, Date>;
}

export function BedGrid({ patients, onPatientClick, waitTimes }: BedGridProps) {
  const bedMap = new Map<number, Patient>();
  patients.forEach((p) => {
    if (p.bed_number) bedMap.set(p.bed_number, p);
  });

  const occupancy = patients.length;
  const pct = Math.round((occupancy / 16) * 100);

  return (
    <div className="flex flex-col w-[340px]">
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
          Hospital Beds
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: occupancy <= 8
                  ? `oklch(0.7 0.15 160)` // green
                  : occupancy <= 12
                    ? `oklch(0.75 0.15 ${160 - ((occupancy - 8) / 4) * 75})` // green → yellow
                    : `oklch(0.65 0.2 ${85 - ((occupancy - 12) / 4) * 60})`, // yellow → red
              }}
            />
          </div>
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{
              color: occupancy <= 8
                ? `oklch(0.7 0.15 160)`
                : occupancy <= 12
                  ? `oklch(0.75 0.15 ${160 - ((occupancy - 8) / 4) * 75})`
                  : `oklch(0.65 0.2 ${85 - ((occupancy - 12) / 4) * 60})`,
            }}
          >
            {occupancy}/16
          </span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 px-1.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
        {Array.from({ length: 16 }, (_, i) => {
          const bedNum = i + 1;
          const patient = bedMap.get(bedNum);
          return (
            <div
              key={bedNum}
              className={`relative aspect-square flex items-center justify-center rounded transition-colors border ${
                patient
                  ? "border-white/[0.1] bg-white/[0.04]"
                  : "border-dashed border-white/[0.06] bg-transparent"
              }`}
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-mono text-muted-foreground/40 tabular-nums leading-none z-0">
                {String(bedNum).padStart(2, "0")}
              </span>
              {patient ? (
                <PatientDot
                  patient={patient}
                  onClick={() => onPatientClick(patient)}
                  showLabel={false}
                  waitSince={waitTimes?.get(patient.pid)}
                />
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground/15">---</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
