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
    <div className="flex flex-col w-[400px]">
      <div className="flex items-center justify-between mb-2.5 px-2">
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground/70">
          Hospital Beds
        </h3>
        <div className="flex items-center gap-2.5">
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: occupancy <= 8
                  ? `oklch(0.7 0.15 160)`
                  : occupancy <= 12
                    ? `oklch(0.75 0.15 ${160 - ((occupancy - 8) / 4) * 75})`
                    : `oklch(0.65 0.2 ${85 - ((occupancy - 12) / 4) * 60})`,
              }}
            />
          </div>
          <span
            className="text-xs font-mono font-semibold tabular-nums"
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
      <div className="grid grid-cols-4 gap-1.5 px-2 py-2 rounded-lg bg-white/80 border border-gray-200">
        {Array.from({ length: 16 }, (_, i) => {
          const bedNum = i + 1;
          const patient = bedMap.get(bedNum);
          return (
            <div
              key={bedNum}
              className={`relative aspect-square flex items-center justify-center rounded-md transition-colors border ${
                patient
                  ? "border-gray-200 bg-gray-50"
                  : "border-dashed border-gray-200 bg-transparent"
              }`}
            >
              <span className="absolute top-1.5 left-2 text-[10px] font-mono font-medium text-muted-foreground/40 tabular-nums leading-none z-0">
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
                <span className="text-xs font-mono text-muted-foreground/15">---</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
