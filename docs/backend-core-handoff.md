# Backend Core Handoff (Person B)

You're building the **FastAPI server** — the foundation everything else plugs into. Your deliverable: a running server with simulation engine, WebSocket broadcasts, Supabase integration, and REST API.

---

## Setup (B1)

### Project Init

```bash
cd backend/
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn supabase python-dotenv pydantic websockets
pip freeze > requirements.txt
```

### `.env.example`

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### `main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from api import router as api_router
from discharge_api import router as discharge_router  # Person C will create this
from websocket import router as ws_router
from simulation import sim_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    await sim_engine.stop()

app = FastAPI(title="DocBox Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)
app.include_router(api_router, prefix="/api")
# Uncomment when Person C delivers discharge_api.py:
# app.include_router(discharge_router, prefix="/api")
```

Start with: `uvicorn backend.main:app --reload`

---

## Supabase Schema (B2)

Run `docs/supabase-schema.sql` in Supabase SQL Editor. This creates:
- `patients` — full patient records with status, color, lab results, discharge fields
- `simulation_config` — singleton row for tick counter, speed, mode, running state

---

## DB Client + Models (B3)

### `db.py`

```python
import os
from supabase import create_client, Client

_client: Client | None = None

def get_db() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"]
        )
    return _client
```

### `models.py`

```python
from pydantic import BaseModel
from typing import Optional
from datetime import date
from uuid import UUID

class LabResult(BaseModel):
    test: str               # e.g. "CBC", "BMP", "Troponin"
    result: str             # e.g. "Normal", "Elevated WBC 14k"
    is_surprising: bool     # True = turns patient red
    arrives_at_tick: int    # Global tick when result becomes available

class Patient(BaseModel):
    pid: UUID
    name: str
    sex: Optional[str] = None
    age: Optional[int] = None
    dob: Optional[date] = None
    chief_complaint: Optional[str] = None
    hpi: Optional[str] = None
    pmh: Optional[str] = None
    family_social_history: Optional[str] = None
    review_of_systems: Optional[str] = None
    objective: Optional[str] = None
    primary_diagnoses: Optional[str] = None
    justification: Optional[str] = None
    plan: Optional[str] = None
    esi_score: Optional[int] = None
    triage_notes: Optional[str] = None
    color: str = "grey"
    status: str = "called_in"
    bed_number: Optional[int] = None
    is_simulated: bool = True
    version: int = 0
    lab_results: Optional[list[LabResult]] = None
    time_to_discharge: Optional[int] = None
    discharge_blocked_reason: Optional[str] = None
    discharge_papers: Optional[dict] = None
    entered_current_status_tick: int = 0

class SimState(BaseModel):
    current_tick: int
    speed_multiplier: float
    mode: str          # "manual" | "auto"
    is_running: bool

class SpeedRequest(BaseModel):
    speed: float

class ModeRequest(BaseModel):
    mode: str  # "manual" | "auto"

class BedAssignRequest(BaseModel):
    bed_number: int
```

---

## WebSocket Server (B4)

### `websocket.py`

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, message: dict):
        data = json.dumps(message)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; we only broadcast server→client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

### Message types to broadcast:

```python
# Patient state changed
await manager.broadcast({
    "type": "patient_update",
    "patient_id": str(pid),
    "changes": {"status": "er_bed", "color": "grey", "bed_number": 5},
    "version": new_version
})

# New patient added
await manager.broadcast({
    "type": "patient_added",
    "patient": patient_dict
})

# Sim state changed
await manager.broadcast({
    "type": "sim_state",
    "current_tick": tick,
    "speed": speed,
    "mode": mode,
    "is_running": running
})

# Lab result arrived
await manager.broadcast({
    "type": "lab_arrived",
    "patient_id": str(pid),
    "test": "CBC",
    "is_surprising": False
})
```

---

## Simulation Engine (B5)

### `simulation.py`

The simulation runs on a global tick clock. Each tick:
1. Increment `current_tick` in `simulation_config`
2. Check for lab results that should arrive this tick
3. Auto-progress patients based on rules (if mode=auto) or wait for manual gates
4. Broadcast all changes

### Patient Status Flow

```
called_in → waiting_room → er_bed → (or | discharge | icu) → done
```

### Core Logic

```python
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

    def load_dataset(self):
        with open("backend/data/patients.json") as f:
            self.dataset = json.load(f)

    async def start(self):
        if self.task and not self.task.done():
            return
        if not self.dataset:
            self.load_dataset()
        # Mark running in DB
        get_db().table("simulation_config").update({"is_running": True}).eq("id", 1).execute()
        self.task = asyncio.create_task(self._tick_loop())

    async def stop(self):
        if self.task:
            self.task.cancel()
            self.task = None
        get_db().table("simulation_config").update({"is_running": False}).eq("id", 1).execute()

    async def _tick_loop(self):
        try:
            while True:
                config = get_db().table("simulation_config").select("*").eq("id", 1).execute().data[0]
                speed = config["speed_multiplier"]
                mode = config["mode"]
                tick = config["current_tick"] + 1

                # Update tick
                get_db().table("simulation_config").update({"current_tick": tick}).eq("id", 1).execute()

                # Check lab results
                await self._check_labs(tick)

                # Auto-progress patients (only in auto mode)
                if mode == "auto":
                    await self._auto_progress(tick)

                # Auto-inject in auto mode (every ~5 ticks)
                if mode == "auto" and tick % 5 == 0:
                    await self.inject_patient(tick)

                # Broadcast sim state
                await manager.broadcast({
                    "type": "sim_state",
                    "current_tick": tick,
                    "speed": speed,
                    "mode": mode,
                    "is_running": True
                })

                await asyncio.sleep(1.0 / speed)
        except asyncio.CancelledError:
            pass

    async def _check_labs(self, tick: int):
        """Check for lab results arriving this tick."""
        patients = get_db().table("patients").select("*").eq("status", "er_bed").execute().data
        for p in patients:
            if not p.get("lab_results"):
                continue
            for lab in p["lab_results"]:
                if lab.get("arrives_at_tick") == tick:
                    # Lab arrived
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
        """Auto-progress patients through states."""
        STATUS_ORDER = ["called_in", "waiting_room", "er_bed", "discharge", "done"]

        patients = get_db().table("patients").select("*").neq("status", "done").execute().data
        for p in patients:
            current = p["status"]
            if current not in STATUS_ORDER:
                continue
            idx = STATUS_ORDER.index(current)
            if idx >= len(STATUS_ORDER) - 1:
                continue

            # Time in current status
            ticks_in_status = tick - p.get("entered_current_status_tick", 0)

            # Random chance to progress (increases with time)
            threshold = max(3, 8 - ticks_in_status)
            if random.randint(0, threshold) != 0:
                continue

            next_status = STATUS_ORDER[idx + 1]

            # Special: from er_bed, randomly pick discharge/or/icu
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

            # Auto-assign bed for er_bed
            if next_status == "er_bed":
                used_beds = {
                    pt["bed_number"]
                    for pt in get_db().table("patients").select("bed_number").eq("status", "er_bed").execute().data
                    if pt.get("bed_number")
                }
                available = [b for b in range(1, 17) if b not in used_beds]
                if available:
                    changes["bed_number"] = random.choice(available)

            # Green color on discharge
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
        """Inject next patient from dataset into the simulation."""
        if self.inject_index >= len(self.dataset):
            self.inject_index = 0  # Loop

        if tick is None:
            config = get_db().table("simulation_config").select("current_tick").eq("id", 1).execute().data[0]
            tick = config["current_tick"]

        patient_data = self.dataset[self.inject_index].copy()
        self.inject_index += 1

        # Offset lab arrival ticks relative to current tick
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
```

---

## Patient Dataset (B6)

### `backend/data/patients.json`

Create ~20 patients. Each patient should have realistic ER data. **Do NOT include `pid`** — Supabase generates it. Lab `arrives_at_tick` values are **relative** (offset from injection tick).

Example structure:

```json
[
  {
    "name": "Maria Santos",
    "sex": "F",
    "age": 34,
    "chief_complaint": "Severe abdominal pain, 6 hours",
    "hpi": "34F presents with acute onset RLQ abdominal pain radiating to back. Pain 8/10. Associated nausea, one episode vomiting. No fever. LMP 2 weeks ago.",
    "pmh": "No significant PMH. No prior surgeries.",
    "objective": "T 99.1 HR 92 BP 128/78 RR 18. Tenderness RLQ with guarding. Positive McBurney's point. No rebound.",
    "primary_diagnoses": "Acute appendicitis",
    "esi_score": 3,
    "triage_notes": "34F, acute RLQ pain 8/10, nausea/vomiting, guarding on exam. Concern for appendicitis. ESI 3.",
    "lab_results": [
      {"test": "CBC", "result": "WBC 14.2k (elevated)", "is_surprising": false, "arrives_at_tick": 8},
      {"test": "CMP", "result": "Normal", "is_surprising": false, "arrives_at_tick": 10},
      {"test": "CT Abdomen", "result": "Inflamed appendix, no perforation", "is_surprising": false, "arrives_at_tick": 15}
    ]
  }
]
```

Create 20 patients with a mix of:
- ESI 2-5 scores (no ESI 1 for simulated patients — keep it simple)
- Different chief complaints: chest pain, fracture, laceration, asthma exacerbation, UTI, migraine, allergic reaction, syncope, etc.
- Some with surprising lab results (`is_surprising: true`) — these patients turn red
- Varied lab arrival ticks (5-20 range)
- 2-3 patients should have surprising results

---

## REST API (B7)

### `api.py`

```python
from fastapi import APIRouter, HTTPException
from db import get_db
from models import SpeedRequest, ModeRequest, BedAssignRequest
from simulation import sim_engine
from websocket import manager

router = APIRouter()

# ---- Simulation Control ----

@router.post("/sim/start")
async def sim_start():
    await sim_engine.start()
    return {"status": "running"}

@router.post("/sim/stop")
async def sim_stop():
    await sim_engine.stop()
    return {"status": "stopped"}

@router.post("/sim/speed")
async def sim_speed(req: SpeedRequest):
    get_db().table("simulation_config").update(
        {"speed_multiplier": req.speed}
    ).eq("id", 1).execute()
    return {"speed": req.speed}

@router.post("/sim/inject")
async def sim_inject():
    patient = await sim_engine.inject_patient()
    return {"patient": patient}

@router.post("/sim/mode")
async def sim_mode(req: ModeRequest):
    if req.mode not in ("manual", "auto"):
        raise HTTPException(400, "Mode must be 'manual' or 'auto'")
    get_db().table("simulation_config").update(
        {"mode": req.mode}
    ).eq("id", 1).execute()
    return {"mode": req.mode}

@router.get("/sim/state")
async def sim_state():
    config = get_db().table("simulation_config").select("*").eq("id", 1).execute().data[0]
    return config

# ---- Patient Management ----

@router.get("/patients")
async def get_patients():
    result = get_db().table("patients").select("*").order("created_at").execute()
    return result.data

@router.get("/patients/{pid}")
async def get_patient(pid: str):
    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")
    return result.data[0]

@router.post("/patients/{pid}/advance")
async def advance_patient(pid: str):
    """Manually advance a patient to the next status."""
    STATUS_ORDER = ["called_in", "waiting_room", "er_bed", "discharge", "done"]

    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")

    patient = result.data[0]
    current = patient["status"]

    if current == "er_bed":
        next_status = "discharge"  # Default; discharge API handles or/icu
    elif current in STATUS_ORDER:
        idx = STATUS_ORDER.index(current)
        if idx >= len(STATUS_ORDER) - 1:
            raise HTTPException(400, "Patient already at final status")
        next_status = STATUS_ORDER[idx + 1]
    else:
        next_status = "done"

    config = get_db().table("simulation_config").select("current_tick").eq("id", 1).execute().data[0]

    changes = {
        "status": next_status,
        "version": patient["version"] + 1,
        "entered_current_status_tick": config["current_tick"]
    }
    if next_status == "discharge":
        changes["color"] = "green"

    get_db().table("patients").update(changes).eq("pid", pid).execute()
    await manager.broadcast({
        "type": "patient_update",
        "patient_id": pid,
        "changes": {k: v for k, v in changes.items() if k != "version"},
        "version": changes["version"]
    })
    return {"status": next_status}

@router.post("/patients/{pid}/assign-bed")
async def assign_bed(pid: str, req: BedAssignRequest):
    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")

    patient = result.data[0]
    changes = {
        "bed_number": req.bed_number,
        "status": "er_bed",
        "version": patient["version"] + 1
    }
    get_db().table("patients").update(changes).eq("pid", pid).execute()
    await manager.broadcast({
        "type": "patient_update",
        "patient_id": pid,
        "changes": {"bed_number": req.bed_number, "status": "er_bed"},
        "version": changes["version"]
    })
    return {"bed_number": req.bed_number}

@router.post("/patients/{pid}/accept")
async def accept_patient(pid: str):
    """Accept a called-in patient → waiting_room."""
    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")

    patient = result.data[0]
    if patient["status"] != "called_in":
        raise HTTPException(400, "Patient is not in called_in status")

    config = get_db().table("simulation_config").select("current_tick").eq("id", 1).execute().data[0]

    changes = {
        "status": "waiting_room",
        "version": patient["version"] + 1,
        "entered_current_status_tick": config["current_tick"]
    }
    get_db().table("patients").update(changes).eq("pid", pid).execute()
    await manager.broadcast({
        "type": "patient_update",
        "patient_id": pid,
        "changes": {"status": "waiting_room"},
        "version": changes["version"]
    })
    return {"status": "waiting_room"}
```

---

## Integration Testing (B8)

### Test checklist

1. **Start server**: `uvicorn backend.main:app --reload` — should start without errors
2. **WebSocket**: Open browser console → `new WebSocket("ws://localhost:8000/ws")` — should connect
3. **Inject patient**: `POST /api/sim/inject` — should return patient object AND broadcast `patient_added` over WS
4. **Advance patient**: `POST /api/patients/{pid}/advance` — should update status AND broadcast `patient_update`
5. **Start sim**: `POST /api/sim/start` — tick counter increments, lab results arrive, patients auto-progress
6. **Speed control**: `POST /api/sim/speed {"speed": 3.0}` — ticks should speed up
7. **Mode toggle**: `POST /api/sim/mode {"mode": "auto"}` — patients should auto-progress without manual calls
8. **Lab arrival**: When tick matches a lab's `arrives_at_tick`, `lab_arrived` + `patient_update` broadcasts fire
9. **Bed assignment**: `POST /api/patients/{pid}/assign-bed {"bed_number": 5}` — should move to er_bed

### Quick test script

```bash
# Terminal 1: Start server
uvicorn backend.main:app --reload

# Terminal 2: Test
curl -X POST http://localhost:8000/api/sim/inject | jq
# Copy the pid from response

curl -X POST http://localhost:8000/api/patients/{PID}/accept | jq
curl -X POST http://localhost:8000/api/patients/{PID}/assign-bed -H "Content-Type: application/json" -d '{"bed_number": 3}' | jq
curl -X POST http://localhost:8000/api/sim/start | jq
curl http://localhost:8000/api/sim/state | jq

# Watch WebSocket in browser console:
# ws = new WebSocket("ws://localhost:8000/ws")
# ws.onmessage = (e) => console.log(JSON.parse(e.data))
```

---

## Files You Create

```
backend/
  main.py              # FastAPI app entry
  api.py               # REST endpoints (sim + patients)
  websocket.py         # WebSocket manager + broadcast
  simulation.py        # Simulation engine + tick loop
  db.py                # Supabase client
  models.py            # Pydantic models
  requirements.txt     # Dependencies
  .env                 # Your actual keys (don't commit)
  .env.example         # Template
  data/
    patients.json      # 20 patient records
```

## Stub files for Person C

Create empty stubs so imports don't break:

**`discharge_api.py`**:
```python
from fastapi import APIRouter
router = APIRouter()
# Person C fills this in
```

**`discharge_agent.py`**:
```python
# Person C fills this in
pass
```

**`paperwork.py`**:
```python
# Person C fills this in
pass
```

---

## Key Reminders

- **Person C will import** `from websocket import manager` and `from db import get_db` — make sure these are clean imports
- **Never call 911** — ESI 1-2 just logs "911 recommended" as a note
- Lab `arrives_at_tick` in the JSON is **relative** — your inject function adds the current tick
- The simulation engine is a singleton: `sim_engine = SimulationEngine()` — imported by api.py
- Beds are numbered 1-16
- Patient colors: grey (default), yellow (real caller), green (discharge ready), red (surprising lab)
