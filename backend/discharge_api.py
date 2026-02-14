"""Discharge REST API — Vapi webhook + discharge management endpoints."""

from fastapi import APIRouter, Request, HTTPException
from backend.db import get_db
from backend.websocket import manager
from backend.paperwork import generate_discharge_papers

router = APIRouter()


@router.post("/vapi/webhook")
async def vapi_webhook(request: Request):
    """Receive triage data from Vapi after call ends (function-call format)."""
    body = await request.json()

    if "message" in body and body["message"].get("type") == "function-call":
        args = body["message"]["functionCall"]["parameters"]

        esi_score = args.get("esi_score")
        triage_notes = args.get("triage_notes", "")

        # ESI 1-2: prepend 911 recommendation (never actually call 911)
        if esi_score is not None and esi_score <= 2:
            triage_notes = f"\u26a0\ufe0f ESI {esi_score} \u2014 911 recommended (simulated). {triage_notes}"

        patient_data = {
            "name": args["name"],
            "sex": args.get("sex"),
            "age": args.get("age"),
            "chief_complaint": args.get("chief_complaint"),
            "hpi": args.get("hpi"),
            "pmh": args.get("pmh"),
            "review_of_systems": args.get("review_of_systems"),
            "esi_score": esi_score,
            "triage_notes": triage_notes,
            "color": "yellow",
            "status": "called_in",
            "is_simulated": False,
        }

        result = get_db().table("patients").insert(patient_data).execute()
        patient = result.data[0]

        await manager.broadcast({
            "type": "patient_added",
            "patient": patient,
        })

        return {"status": "ok", "pid": patient["pid"]}

    return {"status": "ignored"}


@router.get("/discharge/pending")
async def get_pending_discharges():
    """Get all patients flagged as discharge-ready (green)."""
    result = get_db().table("patients").select("*").eq("color", "green").execute()
    return result.data


@router.post("/discharge/{pid}/approve")
async def approve_discharge(pid: str):
    """Doctor approves discharge — generate paperwork and update status."""
    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient = result.data[0]
    papers = await generate_discharge_papers(patient)

    changes = {
        "status": "discharge",
        "color": "green",
        "discharge_papers": papers,
        "version": patient["version"] + 1,
    }
    get_db().table("patients").update(changes).eq("pid", pid).execute()

    await manager.broadcast({
        "type": "patient_update",
        "patient_id": pid,
        "changes": {"status": "discharge", "color": "green"},
        "version": changes["version"],
    })

    return {"status": "approved", "papers": papers}


@router.post("/discharge/{pid}/dispute")
async def dispute_discharge(pid: str, request: Request):
    """Doctor disputes discharge — log blocking reason."""
    body = await request.json()
    reason = body.get("reason", "Doctor disagrees with discharge readiness")

    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient = result.data[0]
    changes = {
        "color": "grey",
        "discharge_blocked_reason": reason,
        "time_to_discharge": None,
        "version": patient["version"] + 1,
    }
    get_db().table("patients").update(changes).eq("pid", pid).execute()

    await manager.broadcast({
        "type": "patient_update",
        "patient_id": pid,
        "changes": {"color": "grey"},
        "version": changes["version"],
    })

    return {"status": "disputed", "reason": reason}


@router.get("/discharge/{pid}/paperwork")
async def get_paperwork(pid: str):
    """Get generated discharge paperwork for a patient."""
    result = get_db().table("patients").select("discharge_papers").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Patient not found")
    papers = result.data[0].get("discharge_papers")
    if not papers:
        raise HTTPException(status_code=404, detail="No paperwork generated yet")
    return papers
