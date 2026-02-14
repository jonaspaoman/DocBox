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
      {/* Start / Stop */}
      <div className="flex gap-1.5">
        {simState.is_running ? (
          <Button variant="outline" size="sm" className="font-mono text-xs h-7 border-border/50" onClick={onStop}>
            STOP
          </Button>
        ) : (
          <Button size="sm" className="font-mono text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onStart}>
            START
          </Button>
        )}
        <Button variant="outline" size="sm" className="font-mono text-xs h-7 border-border/50" onClick={onReset}>
          RST
        </Button>
        <Button variant="outline" size="sm" className="font-mono text-xs h-7 border-border/50" onClick={onInject}>
          +PT
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

      {/* Mode Selector */}
      <div className="flex items-center gap-px rounded-md border border-border/40 bg-muted/20 p-0.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onSetMode(m.value)}
            className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded-sm transition-colors ${
              simState.mode === m.value
                ? "bg-emerald-600 text-white"
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
