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
    <div className="flex flex-col h-[calc(100vh-52px)]">
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <Board
            patients={patients}
            currentTick={simState.current_tick}
            isRunning={simState.is_running}
            onAccept={acceptPatient}
            onAssignBed={assignBed}
            onFlagDischarge={flagForDischarge}
            onDischarge={dischargePatient}
            onMarkDone={markDone}
            eventLog={eventLog}
          />
        </div>
        <div className="hidden xl:flex w-[300px] shrink-0 flex-col border-l border-border/30 overflow-hidden min-h-0">
          <MetricsBar patients={patients} eventLog={eventLog} currentTick={simState.current_tick} />
          <LogPanel entries={eventLog} />
        </div>
      </div>
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
  );
}
