"use client";

import { useState, useEffect, useRef } from "react";
import { usePatientContext } from "@/context/PatientContext";

// 1 real second = 5 simulated minutes
const SIM_MINUTES_PER_REAL_SEC = 5;

function formatElapsed(ms: number): string {
  const realSec = ms / 1000;
  const simMinutes = Math.floor(realSec * SIM_MINUTES_PER_REAL_SEC);
  if (simMinutes < 60) return `${simMinutes}m`;
  const hrs = Math.floor(simMinutes / 60);
  const mins = simMinutes % 60;
  return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
}

interface ElapsedTimeProps {
  since: Date;
  label?: string;
  className?: string;
}

export function ElapsedTime({ since, label, className = "" }: ElapsedTimeProps) {
  const { simState } = usePatientContext();
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    // Reset when `since` changes
    setAccumulatedMs(0);
    lastTickRef.current = since.getTime();
  }, [since]);

  useEffect(() => {
    if (!simState.is_running) {
      // Paused — snapshot the current time so we don't lose progress
      lastTickRef.current = Date.now();
      return;
    }
    // Running — tick every second and add the delta
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      setAccumulatedMs((prev) => prev + (now - lastTickRef.current));
      lastTickRef.current = now;
    }, 1000);
    return () => clearInterval(id);
  }, [simState.is_running]);

  const elapsed = formatElapsed(accumulatedMs);

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {label && <span className="text-muted-foreground/50 uppercase mr-1">{label}</span>}
      {elapsed}
    </span>
  );
}
