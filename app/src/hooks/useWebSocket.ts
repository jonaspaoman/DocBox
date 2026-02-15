"use client";

import { useEffect, useRef } from "react";
import { Patient, SimState, WSMessage } from "@/lib/types";

interface UseWebSocketOptions {
  addPatient: (patient: Patient) => void;
  updatePatient: (pid: string, changes: Partial<Patient>, version?: number) => void;
  setSimState: (state: SimState) => void;
}

export function useWebSocket({ addPatient, updatePatient, setSimState }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      console.log("WebSocket not connected — using mock mode");
      return;
    }

    try {
      const ws = new WebSocket(`${wsUrl}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        const msg: WSMessage = JSON.parse(event.data);
        switch (msg.type) {
          case "patient_added":
            if (msg.patient) addPatient(msg.patient);
            break;
          case "patient_update":
            if (msg.patient_id && msg.changes) {
              updatePatient(msg.patient_id, msg.changes, msg.version);
            }
            break;
          case "sim_state":
            setSimState({
              current_tick: msg.current_tick ?? 0,
              speed_multiplier: msg.speed_multiplier ?? 1,
              mode: (msg.mode as SimState["mode"]) ?? "doctor-manual",
              is_running: msg.is_running ?? false,
            });
            break;
          case "lab_arrived":
            // Lab results handled via patient_update
            break;
          case "discharge_ready":
            // Handled by /doctor page
            break;
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      return () => {
        ws.close();
        wsRef.current = null;
      };
    } catch {
      console.log("WebSocket not connected — using mock mode");
    }
  }, [addPatient, updatePatient, setSimState]);

  return wsRef;
}
