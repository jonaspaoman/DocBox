"use client";

import { useRef, useEffect } from "react";
import { LogEntry, LogEventType } from "@/lib/types";

const EVENT_LABELS: Record<LogEventType, string> = {
  called_in: "Called in",
  accepted: "Accepted → Waiting Room",
  assigned_bed: "Assigned bed",
  flagged_discharge: "Flagged for discharge",
  discharged: "Discharged",
  marked_done: "Marked done",
  lab_arrived: "Lab results arrived",
  turned_red: "Surprising lab result",
};

const EVENT_COLORS: Record<LogEventType, string> = {
  called_in: "text-yellow-400",
  accepted: "text-blue-400",
  assigned_bed: "text-blue-400",
  flagged_discharge: "text-emerald-400",
  discharged: "text-emerald-400",
  marked_done: "text-emerald-400",
  lab_arrived: "text-orange-400",
  turned_red: "text-red-400",
};

interface EventLogProps {
  entries: LogEntry[];
  open: boolean;
  onToggle: () => void;
}

export function EventLog({ entries, open, onToggle }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries.length, open]);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded-sm border transition-colors ${
          open
            ? "bg-emerald-600 text-white border-emerald-600"
            : "border-border/40 text-muted-foreground/60 hover:text-foreground"
        }`}
      >
        LOG
        {entries.length > 0 && (
          <span className="ml-1 text-[9px] opacity-70">{entries.length}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-[420px] max-h-[320px] overflow-y-auto rounded-md border border-white/[0.08] bg-[oklch(0.14_0_0)] shadow-lg z-50">
          <div className="sticky top-0 bg-[oklch(0.14_0_0)] border-b border-white/[0.08] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Event Log
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/40">
              {entries.length} events
            </span>
          </div>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-xs font-mono py-6 text-center">
              No events yet.
            </p>
          ) : (
            <div className="p-1.5 space-y-px">
              {[...entries].reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-baseline gap-2 px-2 py-1 rounded hover:bg-white/[0.04] text-xs font-mono"
                >
                  <span className="text-muted-foreground/40 shrink-0 text-[10px]">
                    {entry.timestamp.toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className="text-muted-foreground/30 shrink-0 text-[10px]">
                    #{String(entry.tick).padStart(4, "0")}
                  </span>
                  <span className="text-foreground/80 truncate shrink-0 max-w-[120px]">
                    {entry.patientName}
                  </span>
                  <span className={`${EVENT_COLORS[entry.event]} truncate`}>
                    {EVENT_LABELS[entry.event]}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
