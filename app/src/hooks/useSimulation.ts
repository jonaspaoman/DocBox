"use client";

import { useState, useCallback } from "react";
import { SimState } from "@/lib/types";
import * as api from "@/lib/api";

const INITIAL_STATE: SimState = {
  current_tick: 0,
  speed_multiplier: 1.0,
  mode: "doctor-manual",
  is_running: false,
};

export function useSimulation() {
  const [simState, setSimState] = useState<SimState>(INITIAL_STATE);

  const start = useCallback(async () => {
    await api.startSim();
    setSimState((s) => ({ ...s, is_running: true }));
  }, []);

  const stop = useCallback(async () => {
    await api.stopSim();
    setSimState((s) => ({ ...s, is_running: false }));
  }, []);

  const setSpeed = useCallback(async (speed: number) => {
    await api.setSimSpeed(speed);
    setSimState((s) => ({ ...s, speed_multiplier: speed }));
  }, []);

  const setMode = useCallback(async (mode: SimState["mode"]) => {
    await api.setSimMode(mode);
    setSimState((s) => ({ ...s, mode }));
  }, []);

  const tick = useCallback(() => {
    setSimState((s) => ({ ...s, current_tick: s.current_tick + 1 }));
  }, []);

  return { simState, setSimState, start, stop, setSpeed, setMode, tick };
}
