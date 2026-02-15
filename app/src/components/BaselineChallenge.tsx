"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { usePatientContext } from "@/context/PatientContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function BaselineChallenge() {
  const {
    baselineChallengeState,
    baselineStartTime,
    baselineFinalTime,
    startBaselineChallenge,
    patients,
    appMode,
    setAppMode,
    baselineScores,
  } = usePatientContext();

  const isBaseline = appMode === "baseline";

  // Live stopwatch
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (baselineChallengeState !== "running" || !baselineStartTime) {
      setElapsed(0);
      return;
    }
    let running = true;
    const update = () => {
      if (!running) return;
      setElapsed(Date.now() - baselineStartTime);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [baselineChallengeState, baselineStartTime]);

  // Compute aggregate correctness
  const { pct, totalScore, totalMax } = useMemo(() => {
    let s = 0, m = 0;
    for (const entry of baselineScores) {
      s += entry.score;
      m += entry.max;
    }
    return { pct: m > 0 ? Math.round((s / m) * 100) : 0, totalScore: s, totalMax: m };
  }, [baselineScores]);

  if (baselineChallengeState === null) return null;

  const doneCount = patients.filter((p) => p.status === "done").length;

  // Instructions popup (baseline only)
  if (isBaseline && baselineChallengeState === "instructions") {
    return (
      <Dialog open onOpenChange={() => {}} modal={false}>
        <DialogContent
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-mono">{isBaseline ? "Baseline Challenge" : "DocBox Challenge"}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground mt-2 space-y-2">
                <p>
                  Experience the current ER workflow — no DocBox automation. Just you, doing what doctors and nurses do every day.
                </p>
                <p>
                  Intake and discharge <strong>5 patients</strong> by hand. Your speed and accuracy are tracked.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              size="lg"
              className="w-full font-mono bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={startBaselineChallenge}
            >
              Start Challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Completion popup (baseline only)
  if (isBaseline && baselineChallengeState === "completed" && baselineFinalTime !== null) {
    return (
      <Dialog open onOpenChange={() => {}} modal={false}>
        <DialogContent
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-mono">Challenge Complete!</DialogTitle>
            <DialogDescription asChild>
              <div className="mt-4 text-center space-y-4">
                <div className="flex items-center justify-center gap-6">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">Time</div>
                    <div className="text-3xl font-mono font-bold text-emerald-600 tabular-nums">
                      {formatTime(baselineFinalTime)}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-border/40" />
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">Accuracy</div>
                    <div className="text-3xl font-mono font-bold tabular-nums" style={{ color: totalMax > 0 ? (pct >= 80 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#dc2626") : "#6b7280" }}>
                      {totalMax > 0 ? `${pct}%` : "—%"}
                    </div>
                  </div>
                </div>
                {totalMax > 0 && (
                  <p className="text-xs font-mono text-muted-foreground">
                    {totalScore} / {totalMax} points across {doneCount} patients
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 font-mono"
              onClick={() => setAppMode(appMode)}
            >
              Try Again
            </Button>
            <Button
              className="flex-1 font-mono bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setAppMode(isBaseline ? "docbox" : "baseline")}
            >
              {isBaseline ? "Switch to DocBox" : "Switch to Baseline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Running: progress tracker (floating, centered) — baseline only
  if (isBaseline && baselineChallengeState === "running") {
    return (
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-5 bg-white/95 backdrop-blur border border-border/40 rounded-xl px-6 py-3.5 shadow-md">
        <div className="text-3xl font-mono font-bold text-emerald-600 tabular-nums">
          {formatTime(elapsed)}
        </div>
        <div className="h-8 w-px bg-border/40" />
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold tabular-nums" style={{ color: totalMax > 0 ? (pct >= 80 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#dc2626") : "#6b7280" }}>
            {totalMax > 0 ? `${pct}%` : "—%"}
          </span>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground/60">accuracy</span>
        </div>
        <div className="h-8 w-px bg-border/40" />
        <div className="text-base font-mono">
          <span className="font-bold tabular-nums">{doneCount}</span>
          <span className="text-muted-foreground">{isBaseline ? " / 5" : ""} discharged</span>
        </div>
      </div>
      </div>
    );
  }

  return null;
}
