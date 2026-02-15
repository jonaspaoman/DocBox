"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SimState, LogEntry } from "@/lib/types";
import { EventLog } from "@/components/EventLog";

interface ControlPanelProps {
  simState: SimState;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onInject: () => void;
  onSpeedChange: (speed: number) => void;
  onSetMode: (mode: SimState["mode"]) => void;
  eventLog?: LogEntry[];
}

const MODES: { value: SimState["mode"]; label: string; tooltip: string }[] = [
  { value: "manual", label: "MANUAL", tooltip: "Nurse accepts patients, doctor approves discharge" },
  { value: "nurse-manual", label: "NURSE MANUAL", tooltip: "Nurse must accept call-ins; discharge is automatic" },
  { value: "doctor-manual", label: "DOCTOR MANUAL", tooltip: "Call-ins auto-accepted; doctor must approve discharge" },
  { value: "auto", label: "AUTO", tooltip: "Everything runs automatically" },
];

export function ControlPanel({
  simState,
  onStart,
  onStop,
  onReset,
  onInject,
  onSpeedChange,
  onSetMode,
  eventLog = [],
}: ControlPanelProps) {
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="border-t border-border/50 bg-white px-5 py-2.5 flex items-center gap-5 shrink-0 overflow-x-auto">
      {/* Start / Pause / Resume / Reset / Add Patient */}
      <div className="flex gap-2 shrink-0">
        {simState.is_running ? (
          <Button variant="outline" size="sm" className="font-mono text-xs h-9 border-yellow-500/50 text-yellow-600 hover:bg-yellow-50 gap-2 px-3.5" onClick={onStop}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8" rx="0.5" /><rect x="6" y="1" width="3" height="8" rx="0.5" /></svg>
            PAUSE
          </Button>
        ) : simState.current_tick > 0 ? (
          <Button size="sm" className="font-mono text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-3.5" onClick={onStart}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9" /></svg>
            RESUME
          </Button>
        ) : (
          <Button size="sm" className="font-mono text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-3.5" onClick={onStart}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9" /></svg>
            START
          </Button>
        )}
        <Button variant="outline" size="sm" className="font-mono text-xs h-9 border-border/50 gap-2 px-3.5" onClick={onReset}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 3.5A4 4 0 0 1 8.5 3M9 6.5A4 4 0 0 1 1.5 7" /><polyline points="1,1 1,4 4,4" /><polyline points="9,9 9,6 6,6" /></svg>
          RESET
        </Button>
        <Button variant="outline" size="sm" className="font-mono text-xs h-9 border-border/50 gap-2 px-3" onClick={onInject}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" /></svg>
          Patient
        </Button>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-2.5 min-w-[150px] shrink-0">
        <span className="text-[10px] font-mono font-medium text-muted-foreground/60 uppercase tracking-wider">Spd</span>
        <Slider
          value={[simState.speed_multiplier]}
          min={0.5}
          max={5}
          step={0.5}
          onValueChange={([v]) => onSpeedChange(v)}
          className="flex-1"
        />
        <span className="text-xs font-mono font-semibold tabular-nums text-emerald-600 w-7 text-right">
          {simState.speed_multiplier}x
        </span>
      </div>

      {/* Mode Selector — segmented control with sliding highlight */}
      <div className="flex rounded-lg border border-border/40 bg-muted/20 p-1 gap-1 shrink-0">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onSetMode(m.value)}
            title={m.tooltip}
            className={`py-1.5 px-4 text-[11px] font-mono font-medium rounded-md transition-colors text-center whitespace-nowrap ${
              simState.mode === m.value
                ? "bg-emerald-600 text-white"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-black/[0.04]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Live indicator + Tick + Log */}
      <div className="ml-auto flex items-center gap-4 shrink-0">
        <EventLog entries={eventLog} open={logOpen} onToggle={() => setLogOpen(!logOpen)} />
        {simState.is_running ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold text-emerald-500 uppercase tracking-widest">
              Live
            </span>
          </div>
        ) : simState.current_tick > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-[11px] font-mono font-bold text-yellow-500 uppercase tracking-widest">
              Paused
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-md border border-border/30">
          <span className="text-[10px] font-mono font-medium text-muted-foreground/50 uppercase">Tick</span>
          <span className="text-sm font-mono tabular-nums text-emerald-600 font-bold">
            {String(simState.current_tick).padStart(4, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
