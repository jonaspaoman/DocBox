"use client";

import { Board } from "@/components/Board";
import { ControlPanel } from "@/components/ControlPanel";
import { MetricsBar } from "@/components/MetricsBar";
import { LogPanel } from "@/components/LogPanel";
import { usePatientContext } from "@/context/PatientContext";

export default function Home() {
  const {
    patients,
    acceptPatient,
    assignBed,
    flagForDischarge,
    dischargePatient,
    markDone,
    simState,
    start,
    stop,
    resetSim,
    injectNewPatient,
    setSpeed,
    setMode,
    eventLog,
  } = usePatientContext();

  return (
    <div className="flex h-[calc(100vh-52px)]">
      <div className="flex flex-col flex-1 min-w-0">
        <Board
          patients={patients}
          currentTick={simState.current_tick}
          onAccept={acceptPatient}
          onAssignBed={assignBed}
          onFlagDischarge={flagForDischarge}
          onDischarge={dischargePatient}
          onMarkDone={markDone}
          eventLog={eventLog}
        />
        <ControlPanel
          simState={simState}
          onStart={start}
          onStop={stop}
          onReset={resetSim}
          onInject={injectNewPatient}
          onSpeedChange={setSpeed}
          onSetMode={setMode}
          eventLog={eventLog}
        />
      </div>
      <div className="w-[300px] shrink-0 flex flex-col border-l border-border/30">
        <MetricsBar patients={patients} eventLog={eventLog} currentTick={simState.current_tick} />
        <LogPanel entries={eventLog} />
      </div>
    </div>
  );
}
