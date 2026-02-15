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
    <div className="flex flex-col w-[300px]">
      <div className="flex items-center justify-between mb-1 px-1">
        <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></svg>
          Hospital Beds
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
            className="text-[11px] font-mono font-semibold tabular-nums"
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
      <div className="grid grid-cols-4 gap-2 p-1.5 rounded-lg bg-white/80 border border-gray-200 border-l-[3px] border-l-blue-500/40">
        {Array.from({ length: 16 }, (_, i) => {
          const bedNum = i + 1;
          const patient = bedMap.get(bedNum);
          const occupied = !!patient;
          return (
            <div
              key={bedNum}
              className={`relative flex flex-col items-center transition-all ${
                occupied
                  ? "cursor-pointer hover:scale-105"
                  : ""
              }`}
              onClick={patient ? () => onPatientClick(patient) : undefined}
            >
              {/* Bed SVG — top-down view: headboard on top, mattress body below */}
              <svg
                width="60"
                height="60"
                viewBox="0 0 60 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Headboard */}
                <rect
                  x="6" y="2" width="48" height="10" rx="2.5"
                  stroke={occupied ? "#d1d5db" : "#e5e7eb"}
                  strokeWidth="1"
                  strokeDasharray={occupied ? "none" : "3 2"}
                  fill={occupied ? "#f3f4f6" : "none"}
                />
                {/* Mattress / body */}
                <rect
                  x="6" y="14" width="48" height="44" rx="2.5"
                  stroke={occupied ? "#d1d5db" : "#e5e7eb"}
                  strokeWidth="1"
                  strokeDasharray={occupied ? "none" : "3 2"}
                  fill={occupied ? "#f9fafb" : "none"}
                />
              </svg>
              {/* Patient dot — centered in the mattress area */}
              {patient && (
                <div className="absolute z-10 group/bed" style={{ top: 34, left: '50%', transform: 'translate(-50%, -50%) scale(0.85)' }}>
                  <PatientDot
                    patient={patient}
                    onClick={() => onPatientClick(patient)}
                    showLabel={false}
                    waitSince={waitTimes?.get(patient.pid)}
                  />
                  {/* Hover tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 rounded bg-gray-800 text-white text-[9px] font-mono whitespace-nowrap opacity-0 group-hover/bed:opacity-100 transition-opacity pointer-events-none z-50">
                    {patient.name}
                  </div>
                </div>
              )}
              {/* Bed number — below the bed */}
              <span className="text-[8px] font-mono font-medium text-muted-foreground/35 tabular-nums leading-none mt-0.5">
                {String(bedNum).padStart(2, "0")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
