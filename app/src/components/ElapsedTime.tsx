"use client";

import { useState, useEffect } from "react";

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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(now - since.getTime());

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {label && <span className="text-muted-foreground/50 uppercase mr-1">{label}</span>}
      {elapsed}
    </span>
  );
}
