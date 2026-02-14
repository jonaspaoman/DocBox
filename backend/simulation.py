import asyncio
import json
import random
from db import get_db
from websocket import manager


class SimulationEngine:
    def __init__(self):
        self.task: asyncio.Task | None = None
        self.dataset: list[dict] = []
        self.inject_index: int = 0
        self.current_tick: int = 0
        self.speed: float = 1.0
        self.mode: str = "manual"
        self.is_running: bool = False

    def load_dataset(self):
        import os
        path = os.path.join(os.path.dirname(__file__), "data", "patients.json")
        with open(path) as f:
            self.dataset = json.load(f)

    async def start(self):
        if self.task and not self.task.done():
            return
        if not self.dataset:
            self.load_dataset()
        self.is_running = True
        self.task = asyncio.create_task(self._tick_loop())

    async def stop(self):
        if self.task:
            self.task.cancel()
            self.task = None
        self.is_running = False

    async def _tick_loop(self):
        try:
            while True:
                self.current_tick += 1
                tick = self.current_tick

                await self._check_labs(tick)

                if self.mode == "auto":
                    await self._auto_progress(tick)

                if self.mode == "auto" and tick % 5 == 0:
                    await self.inject_patient(tick)

                await manager.broadcast({
                    "type": "sim_state",
                    "current_tick": tick,
                    "speed": self.speed,
                    "mode": self.mode,
                    "is_running": True
                })

                await asyncio.sleep(1.0 / self.speed)
        except asyncio.CancelledError:
            pass

    async def _check_labs(self, tick: int):
        patients = get_db().table("patients").select("*").eq("status", "er_bed").execute().data
        for p in patients:
            if not p.get("lab_results"):
                continue
            for lab in p["lab_results"]:
                if lab.get("arrives_at_tick") == tick:
                    color = "red" if lab.get("is_surprising") else p["color"]
                    changes = {"color": color, "version": p["version"] + 1}
                    get_db().table("patients").update(changes).eq("pid", p["pid"]).execute()
                    await manager.broadcast({
                        "type": "lab_arrived",
                        "patient_id": p["pid"],
                        "test": lab["test"],
                        "is_surprising": lab.get("is_surprising", False)
                    })
                    await manager.broadcast({
                        "type": "patient_update",
                        "patient_id": p["pid"],
                        "changes": {"color": color},
                        "version": p["version"] + 1
                    })

    async def _auto_progress(self, tick: int):
        STATUS_ORDER = ["called_in", "waiting_room", "er_bed", "discharge", "done"]

        patients = get_db().table("patients").select("*").neq("status", "done").execute().data
        for p in patients:
            current = p["status"]
            if current not in STATUS_ORDER:
                continue
            idx = STATUS_ORDER.index(current)
            if idx >= len(STATUS_ORDER) - 1:
                continue

            ticks_in_status = tick - p.get("entered_current_status_tick", 0)
            threshold = max(3, 8 - ticks_in_status)
            if random.randint(0, threshold) != 0:
                continue

            next_status = STATUS_ORDER[idx + 1]

            if current == "er_bed":
                next_status = random.choices(
                    ["discharge", "or", "icu"],
                    weights=[0.7, 0.15, 0.15]
                )[0]

            changes = {
                "status": next_status,
                "version": p["version"] + 1,
                "entered_current_status_tick": tick
            }

            if next_status == "er_bed":
                used_beds = {
                    pt["bed_number"]
                    for pt in get_db().table("patients").select("bed_number").eq("status", "er_bed").execute().data
                    if pt.get("bed_number")
                }
                available = [b for b in range(1, 17) if b not in used_beds]
                if available:
                    changes["bed_number"] = random.choice(available)

            if next_status == "discharge":
                changes["color"] = "green"

            get_db().table("patients").update(changes).eq("pid", p["pid"]).execute()
            await manager.broadcast({
                "type": "patient_update",
                "patient_id": p["pid"],
                "changes": {k: v for k, v in changes.items() if k != "version"},
                "version": changes["version"]
            })

    async def inject_patient(self, tick: int = None):
        if not self.dataset:
            self.load_dataset()
        if self.inject_index >= len(self.dataset):
            self.inject_index = 0

        if tick is None:
            tick = self.current_tick

        patient_data = self.dataset[self.inject_index].copy()
        self.inject_index += 1

        if patient_data.get("lab_results"):
            for lab in patient_data["lab_results"]:
                lab["arrives_at_tick"] = tick + lab.get("arrives_at_tick", 10)

        patient_data["entered_current_status_tick"] = tick
        patient_data["status"] = "called_in"
        patient_data["color"] = "grey"
        patient_data["is_simulated"] = True

        result = get_db().table("patients").insert(patient_data).execute()
        patient = result.data[0]

        await manager.broadcast({
            "type": "patient_added",
            "patient": patient
        })
        return patient


sim_engine = SimulationEngine()
