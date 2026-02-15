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

const MODES: { value: SimState["mode"]; label: string }[] = [
  { value: "manual", label: "MANUAL" },
  { value: "semi-auto", label: "SEMI" },
  { value: "full-auto", label: "AUTO" },
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
    <div className="border-t border-border/50 bg-[oklch(0.1_0_0)] px-6 py-2.5 flex items-center gap-6 flex-wrap">
      {/* Start / Pause / Resume / Reset / Add Patient */}
      <div className="flex gap-1.5">
        {simState.is_running ? (
          <Button variant="outline" size="sm" className="font-mono text-xs h-7 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 gap-1.5" onClick={onStop}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8" rx="0.5" /><rect x="6" y="1" width="3" height="8" rx="0.5" /></svg>
            PAUSE
          </Button>
        ) : simState.current_tick > 0 ? (
          <Button size="sm" className="font-mono text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={onStart}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9" /></svg>
            RESUME
          </Button>
        ) : (
          <Button size="sm" className="font-mono text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={onStart}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9" /></svg>
            START
          </Button>
        )}
        <Button variant="outline" size="sm" className="font-mono text-xs h-7 border-border/50 gap-1.5" onClick={onReset}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 3.5A4 4 0 0 1 8.5 3M9 6.5A4 4 0 0 1 1.5 7" /><polyline points="1,1 1,4 4,4" /><polyline points="9,9 9,6 6,6" /></svg>
          RESET
        </Button>
        <Button variant="outline" size="sm" className="font-mono text-xs h-7 border-border/50 gap-1.5" onClick={onInject}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" /></svg>
          PATIENT
        </Button>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Spd</span>
        <Slider
          value={[simState.speed_multiplier]}
          min={0.5}
          max={5}
          step={0.5}
          onValueChange={([v]) => onSpeedChange(v)}
          className="flex-1"
        />
        <span className="text-xs font-mono tabular-nums text-emerald-400 w-8 text-right">
          {simState.speed_multiplier}x
        </span>
      </div>

      {/* Mode Selector — segmented control with sliding highlight */}
      <div className="relative grid grid-cols-3 rounded-md border border-border/40 bg-muted/20 p-0.5" style={{ width: 200 }}>
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-emerald-600 transition-all duration-200 ease-in-out"
          style={{
            width: `calc(${100 / MODES.length}% - 2px)`,
            transform: `translateX(calc(${MODES.findIndex((m) => m.value === simState.mode)} * 100% + 1px))`,
          }}
        />
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onSetMode(m.value)}
            className={`relative z-10 py-1 text-[10px] font-mono font-medium rounded-sm transition-colors text-center ${
              simState.mode === m.value
                ? "text-white"
                : "text-muted-foreground/60 hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Live indicator + Tick + Log */}
      <div className="ml-auto flex items-center gap-3">
        <EventLog entries={eventLog} open={logOpen} onToggle={() => setLogOpen(!logOpen)} />
        {simState.is_running ? (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-widest">
              Live
            </span>
          </div>
        ) : simState.current_tick > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span className="text-[9px] font-mono font-bold text-yellow-500 uppercase tracking-widest">
              Paused
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-1.5 bg-muted/20 px-2.5 py-1 rounded border border-border/30">
          <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">Tick</span>
          <span className="text-sm font-mono tabular-nums text-emerald-400 font-bold">
            {String(simState.current_tick).padStart(4, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
