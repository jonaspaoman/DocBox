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
    sim_engine.speed = req.speed
    return {"speed": req.speed}


@router.post("/sim/inject")
async def sim_inject():
    patient = await sim_engine.inject_patient()
    return {"patient": patient}


@router.post("/sim/mode")
async def sim_mode(req: ModeRequest):
    if req.mode not in ("manual", "auto"):
        raise HTTPException(400, "Mode must be 'manual' or 'auto'")
    sim_engine.mode = req.mode
    return {"mode": req.mode}


@router.get("/sim/state")
async def sim_state():
    return {
        "current_tick": sim_engine.current_tick,
        "speed_multiplier": sim_engine.speed,
        "mode": sim_engine.mode,
        "is_running": sim_engine.is_running,
    }


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
    STATUS_ORDER = ["called_in", "waiting_room", "er_bed", "discharge", "done"]

    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")

    patient = result.data[0]
    current = patient["status"]

    if current == "er_bed":
        next_status = "discharge"
    elif current in STATUS_ORDER:
        idx = STATUS_ORDER.index(current)
        if idx >= len(STATUS_ORDER) - 1:
            raise HTTPException(400, "Patient already at final status")
        next_status = STATUS_ORDER[idx + 1]
    else:
        next_status = "done"

    changes = {
        "status": next_status,
        "version": patient["version"] + 1,
        "entered_current_status_tick": sim_engine.current_tick
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
    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")

    patient = result.data[0]
    if patient["status"] != "called_in":
        raise HTTPException(400, "Patient is not in called_in status")

    changes = {
        "status": "waiting_room",
        "version": patient["version"] + 1,
        "entered_current_status_tick": sim_engine.current_tick
    }
    get_db().table("patients").update(changes).eq("pid", pid).execute()
    await manager.broadcast({
        "type": "patient_update",
        "patient_id": pid,
        "changes": {"status": "waiting_room"},
        "version": changes["version"]
    })
    return {"status": "waiting_room"}
