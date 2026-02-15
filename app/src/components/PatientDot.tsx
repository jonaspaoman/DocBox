"use client";

import { useRef, useEffect } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Patient, PatientColor } from "@/lib/types";
import { ElapsedTime } from "@/components/ElapsedTime";

const COLOR_MAP: Record<PatientColor, string> = {
  grey: "#6B7280",
  yellow: "#EAB308",
  green: "#22C55E",
  red: "#EF4444",
};

const ESI_COLOR: Record<number, string> = {
  1: "text-red-600",
  2: "text-orange-600",
  3: "text-yellow-600",
  4: "text-green-600",
  5: "text-blue-600",
};

const GLOW_MAP: Record<PatientColor, string> = {
  grey: "",
  yellow: "glow-yellow",
  green: "glow-green",
  red: "glow-red",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface PatientDotProps {
  patient: Patient;
  onClick?: () => void;
  showLabel?: boolean;
  showEsi?: boolean;
  waitSince?: Date;
  overdue?: boolean;
}

export function PatientDot({ patient, onClick, showLabel = true, showEsi = false, waitSince, overdue = false }: PatientDotProps) {
  const bg = COLOR_MAP[patient.color] || COLOR_MAP.grey;
  const glow = GLOW_MAP[patient.color] || "";
  const initials = getInitials(patient.name);
  const isRed = patient.color === "red";

  const prevColorRef = useRef(patient.color);
  const shakeControls = useAnimationControls();

  useEffect(() => {
    if (patient.color === "green" && prevColorRef.current !== "green") {
      shakeControls.start({
        y: [0, -4, 4, -3, 3, -1, 1, 0],
        transition: { duration: 0.5, ease: "easeInOut" },
      });
    }
    prevColorRef.current = patient.color;
  }, [patient.color, shakeControls]);

  return (
    <motion.div
      className="flex items-center gap-2.5 cursor-pointer group py-0.5"
      onClick={onClick}
      animate={shakeControls}
    >
      <div
        className={`relative rounded-full shrink-0 flex items-center justify-center z-10 ${glow}`}
        style={{
          width: 34,
          height: 34,
          backgroundColor: bg,
          boxShadow: isRed ? "0 0 10px rgba(239,68,68,0.5)" : undefined,
        }}
        title={`${patient.name} — ESI ${patient.esi_score ?? "?"} — ${patient.chief_complaint ?? ""}`}
      >
        <span className="text-[11px] font-mono font-bold text-white/90 leading-none select-none">
          {initials}
        </span>
      </div>
      {showLabel && (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-mono text-foreground/80 truncate max-w-[130px] group-hover:text-foreground transition-colors">
            {patient.name.split(" ")[0]}
          </span>
          {overdue && (
            <span className="text-red-500 shrink-0 animate-pulse" title="Long wait time">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="8" cy="8" r="6.5" />
                <line x1="8" y1="4.5" x2="8" y2="8" />
                <line x1="8" y1="8" x2="10.5" y2="10" />
              </svg>
            </span>
          )}
          {showEsi && patient.esi_score != null && (
            <span className={`text-[11px] font-mono font-bold shrink-0 ${ESI_COLOR[patient.esi_score] ?? "text-muted-foreground"}`}>
              ESI {patient.esi_score}
            </span>
          )}
          {waitSince && (
            <ElapsedTime since={waitSince} className="text-[10px] text-muted-foreground/50 shrink-0" />
          )}
        </div>
      )}
    </motion.div>
  );
}
