"use client";

import { useRef, useEffect } from "react";
import { LogEntry, LogEventType } from "@/lib/types";

const EVENT_LABELS: Record<LogEventType, string> = {
  called_in: "Called in",
  accepted: "Accepted → Waiting",
  assigned_bed: "Assigned bed",
  flagged_discharge: "Flagged discharge",
  discharged: "Discharged",
  marked_done: "Marked done",
  lab_arrived: "Lab arrived",
  turned_red: "Surprising lab",
};

const EVENT_COLORS: Record<LogEventType, string> = {
  called_in: "text-yellow-600",
  accepted: "text-blue-600",
  assigned_bed: "text-blue-600",
  flagged_discharge: "text-emerald-600",
  discharged: "text-emerald-600",
  marked_done: "text-emerald-600",
  lab_arrived: "text-orange-600",
  turned_red: "text-red-600",
};

const EVENT_DOTS: Record<LogEventType, string> = {
  called_in: "bg-yellow-500",
  accepted: "bg-blue-500",
  assigned_bed: "bg-blue-500",
  flagged_discharge: "bg-emerald-500",
  discharged: "bg-emerald-500",
  marked_done: "bg-emerald-500",
  lab_arrived: "bg-orange-500",
  turned_red: "bg-red-500",
};

interface LogPanelProps {
  entries: LogEntry[];
}

export function LogPanel({ entries }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-2.5 border-y border-border/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-mono font-bold text-foreground/90 uppercase tracking-widest">
            Live Log
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums bg-black/[0.04] px-1.5 py-0.5 rounded">
          {entries.length}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {entries.length === 0 ? (
          <p className="text-muted-foreground/30 text-[11px] font-mono py-8 text-center">
            Waiting for events...
          </p>
        ) : (
          <div className="py-1">
            {[...entries].reverse().map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 px-3 py-1.5 hover:bg-gray-100 transition-colors"
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-[5px] shrink-0 ${EVENT_DOTS[entry.event]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-mono text-foreground/80 truncate max-w-[100px]">
                      {entry.patientName}
                    </span>
                    <span className={`text-[11px] font-mono truncate ${EVENT_COLORS[entry.event]}`}>
                      {EVENT_LABELS[entry.event]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/30">
                    <span>{entry.timestamp.toLocaleTimeString("en-US", { hour12: false })}</span>
                    <span>tick #{String(entry.tick).padStart(4, "0")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
