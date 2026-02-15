"use client";

import { useState, useEffect } from "react";

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec.toString().padStart(2, "0")}s`;
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
