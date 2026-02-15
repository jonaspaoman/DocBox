"use client";

import { Board } from "@/components/Board";
import { ControlPanel } from "@/components/ControlPanel";
import { MetricsBar } from "@/components/MetricsBar";
import { SidebarPanel } from "@/components/SidebarPanel";
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
    overdueWaitPids,
  } = usePatientContext();

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-hidden">
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
            overdueWaitPids={overdueWaitPids}
          />
        </div>
        {/* Floating metrics box */}
        <div className="absolute top-5 left-5 z-30">
          <MetricsBar patients={patients} eventLog={eventLog} currentTick={simState.current_tick} />
        </div>
        <div className="hidden xl:flex w-[420px] shrink-0 flex-col border-l border-border/30 overflow-hidden min-h-0">
          <SidebarPanel entries={eventLog} />
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
