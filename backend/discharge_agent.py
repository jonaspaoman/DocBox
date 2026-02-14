"""Discharge evaluation agent — uses GPT-4o to assess discharge readiness."""

import os
import json
from openai import OpenAI
from backend.db import get_db
from backend.websocket import manager

_client = None


def _get_openai_client():
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return _client


async def evaluate_discharge(patient: dict, current_tick: int) -> dict | None:
    """
    Evaluate if a patient is ready for discharge.
    Returns discharge recommendation dict or None if not ready.
    Called by the simulation engine when labs arrive or conditions change.
    """
    labs = patient.get("lab_results") or []
    pending_labs = [l for l in labs if l.get("arrives_at_tick", 0) > current_tick]
    if pending_labs:
        return None

    if patient.get("discharge_blocked_reason"):
        return None

    prompt = f"""You are an ER discharge assessment AI. Based on the patient data below, determine if this patient is ready for discharge.

Patient: {patient['name']}, {patient.get('age', 'unknown')}yo {patient.get('sex', '')}
Chief Complaint: {patient.get('chief_complaint', 'N/A')}
HPI: {patient.get('hpi', 'N/A')}
PMH: {patient.get('pmh', 'N/A')}
Diagnoses: {patient.get('primary_diagnoses', 'N/A')}
Plan: {patient.get('plan', 'N/A')}

Lab Results:
{json.dumps(labs, indent=2) if labs else 'No labs ordered'}

Respond in JSON:
{{
  "ready": true/false,
  "reasoning": "1-2 sentence explanation",
  "time_to_discharge_minutes": <estimated minutes from now, 0 if ready now>,
  "summary": "2-3 sentence discharge summary for doctor notification"
}}"""

    response = _get_openai_client().chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)

    if result.get("ready"):
        changes = {
            "color": "green",
            "time_to_discharge": current_tick,
            "version": patient["version"] + 1,
        }
        get_db().table("patients").update(changes).eq("pid", patient["pid"]).execute()

        await manager.broadcast({
            "type": "patient_update",
            "patient_id": patient["pid"],
            "changes": {"color": "green", "time_to_discharge": current_tick},
            "version": changes["version"],
        })

        await manager.broadcast({
            "type": "discharge_ready",
            "patient_id": patient["pid"],
            "name": patient["name"],
            "summary": result["summary"],
        })

        return result

    return None


async def check_blocked_resolution(patient: dict, current_tick: int):
    """Re-evaluate a patient whose discharge was previously blocked."""
    if not patient.get("discharge_blocked_reason"):
        return

    get_db().table("patients").update(
        {"discharge_blocked_reason": None}
    ).eq("pid", patient["pid"]).execute()

    patient["discharge_blocked_reason"] = None
    await evaluate_discharge(patient, current_tick)
