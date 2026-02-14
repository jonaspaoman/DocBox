# AI + Integrations Handoff (Person C)

You're building the **AI brain and external integrations** — Vapi voice agents, discharge AI, paperwork generation, and the doctor's mobile web page. You depend on Person B's foundation (db.py, models.py, websocket.py) being ready first for tasks C2+.

---

## Overview

| Task | What | Depends On |
|------|------|------------|
| C1 | Vapi triage assistant setup | Nothing (do first) |
| C2 | Vapi webhook endpoint | B1-B3 (db.py, models.py) |
| C3 | Discharge agent | B4-B5 (websocket, simulation) |
| C4 | Paperwork generation | Models only |
| C5 | Discharge REST API | B4 (websocket) |
| C6 | Vapi dispute assistant | C5 |
| C7 | Doctor mobile web page | C5 |
| C8 | Integration testing | Everything |

---

## C1: Vapi Triage Assistant Setup

### What to do

Configure a Vapi assistant that acts as a triage nurse via phone call. This is done in the [Vapi Dashboard](https://dashboard.vapi.ai/).

### System Prompt for the Vapi Assistant

```
You are a triage nurse at an emergency department. Your job is to quickly and compassionately assess the caller's condition over the phone. You need to collect:

1. Full name
2. Age, sex, and date of birth
3. Chief complaint (why they're coming in, in their own words)
4. History of present illness (when it started, severity 1-10, what makes it better/worse, associated symptoms)
5. Past medical history (chronic conditions, surgeries, current medications, allergies)
6. Brief review of systems (any other symptoms: fever, nausea, dizziness, shortness of breath, etc.)

Be warm, professional, and efficient. Ask one question at a time. If the caller describes symptoms suggesting ESI 1-2 (cardiac arrest, severe trauma, stroke symptoms, severe respiratory distress), calmly tell them: "Based on what you're describing, I strongly recommend calling 911 immediately. Would you like me to help you with that?" Do NOT actually call 911.

After collecting all information, say: "Thank you. I've created your chart. When you arrive, check in at the front desk and mention your name — the team will already have your information."

At the end of the call, output structured data in this exact JSON format:
{
  "name": "...",
  "sex": "...",
  "age": ...,
  "chief_complaint": "...",
  "hpi": "...",
  "pmh": "...",
  "review_of_systems": "...",
  "esi_score": 3,
  "triage_notes": "2-3 sentence summary"
}
```

### Vapi Configuration

1. Create a new assistant in Vapi Dashboard
2. Set the system prompt above
3. Use GPT-4o as the model
4. Enable structured output / function calling to extract the JSON
5. Set up a **Server URL** (webhook) pointing to your backend: `https://your-backend.com/api/vapi/webhook`
6. Configure the Vapi phone number
7. Set end-of-call webhook to POST the structured data to your backend

### Alternative: Vapi Function Calling

Instead of parsing the end-of-call transcript, you can define a Vapi function/tool called `submit_triage` that the assistant calls at the end:

```json
{
  "name": "submit_triage",
  "description": "Submit the completed triage assessment to the hospital system",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {"type": "string"},
      "sex": {"type": "string"},
      "age": {"type": "integer"},
      "chief_complaint": {"type": "string"},
      "hpi": {"type": "string"},
      "pmh": {"type": "string"},
      "review_of_systems": {"type": "string"},
      "esi_score": {"type": "integer", "minimum": 1, "maximum": 5},
      "triage_notes": {"type": "string"}
    },
    "required": ["name", "chief_complaint", "esi_score", "triage_notes"]
  }
}
```

The function call triggers a webhook to your server.

---

## C2: Vapi Webhook Endpoint

### `discharge_api.py` (add to the router)

```python
from fastapi import APIRouter, Request
from db import get_db
from websocket import manager

router = APIRouter()

@router.post("/vapi/webhook")
async def vapi_webhook(request: Request):
    """Receive triage data from Vapi after call ends."""
    body = await request.json()

    # Vapi sends different event types — handle the relevant ones
    # The exact payload depends on your Vapi config (end-of-call report vs function call)
    # Adapt this to match your Vapi setup:

    # Option A: Function call payload
    if "message" in body and body["message"].get("type") == "function-call":
        args = body["message"]["functionCall"]["parameters"]
        patient_data = {
            "name": args["name"],
            "sex": args.get("sex"),
            "age": args.get("age"),
            "chief_complaint": args["chief_complaint"],
            "hpi": args.get("hpi"),
            "pmh": args.get("pmh"),
            "review_of_systems": args.get("review_of_systems"),
            "esi_score": args["esi_score"],
            "triage_notes": args["triage_notes"],
            "color": "yellow",        # Real caller = yellow
            "status": "called_in",
            "is_simulated": False,
        }

        result = get_db().table("patients").insert(patient_data).execute()
        patient = result.data[0]

        await manager.broadcast({
            "type": "patient_added",
            "patient": patient
        })

        return {"status": "ok", "pid": patient["pid"]}

    # Option B: End-of-call report (parse transcript or structured output)
    # Implement based on your Vapi configuration

    return {"status": "ignored"}
```

### ESI 1-2 Handling

If `esi_score` is 1 or 2, add to the triage notes: `"⚠️ ESI {score} — 911 recommended (simulated)"`. Never actually call 911.

---

## C3: Discharge Agent

### `discharge_agent.py`

The discharge agent evaluates patients in ER beds and determines when they're ready for discharge.

```python
import os
import json
from openai import OpenAI
from db import get_db
from websocket import manager

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

async def evaluate_discharge(patient: dict, current_tick: int) -> dict | None:
    """
    Evaluate if a patient is ready for discharge.
    Returns discharge recommendation or None if not ready.
    Called by the simulation engine when:
      - A patient enters an ER bed
      - A lab result arrives
      - A blocked condition may have resolved
    """
    # Check if all labs have arrived
    labs = patient.get("lab_results") or []
    pending_labs = [l for l in labs if l.get("arrives_at_tick", 0) > current_tick]
    if pending_labs:
        return None  # Still waiting for labs

    # Check if discharge is blocked
    if patient.get("discharge_blocked_reason"):
        return None  # Doctor disputed, waiting for condition

    # Build context for GPT-4o
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
}}
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    result = json.loads(response.choices[0].message.content)

    if result.get("ready"):
        # Flag patient as discharge-ready
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
            "version": changes["version"]
        })

        await manager.broadcast({
            "type": "discharge_ready",
            "patient_id": patient["pid"],
            "name": patient["name"],
            "summary": result["summary"]
        })

        return result

    return None


async def check_blocked_resolution(patient: dict, current_tick: int):
    """Re-evaluate a patient whose discharge was previously blocked."""
    blocked_reason = patient.get("discharge_blocked_reason")
    if not blocked_reason:
        return

    # Clear the block and re-evaluate
    get_db().table("patients").update(
        {"discharge_blocked_reason": None}
    ).eq("pid", patient["pid"]).execute()

    patient["discharge_blocked_reason"] = None
    await evaluate_discharge(patient, current_tick)
```

### Integration with Simulation Engine

Person B's simulation engine should call your discharge agent. Ask Person B to add this hook in `simulation.py` `_check_labs`:

```python
# After a lab arrives for a patient in er_bed:
from discharge_agent import evaluate_discharge
await evaluate_discharge(patient, tick)
```

And when a patient first enters `er_bed`:
```python
# In _auto_progress, after moving patient to er_bed:
if next_status == "er_bed":
    from discharge_agent import evaluate_discharge
    await evaluate_discharge(patient_updated, tick)
```

---

## C4: Paperwork Generation

### `paperwork.py`

```python
import os
import json
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

async def generate_discharge_papers(patient: dict) -> dict:
    """Generate all discharge paperwork for a patient."""

    soap_note = await _generate_soap_note(patient)
    avs = await _generate_avs(patient)
    work_school_form = await _generate_work_school_form(patient)

    papers = {
        "soap_note": soap_note,
        "avs": avs,
        "work_school_form": work_school_form,
    }

    # Save to DB
    from db import get_db
    get_db().table("patients").update(
        {"discharge_papers": papers}
    ).eq("pid", patient["pid"]).execute()

    return papers


async def _generate_soap_note(patient: dict) -> str:
    prompt = f"""Generate an ED SOAP note for this patient. Use standard ED SOAP format:
- Subjective (chief complaint, HPI, PMH, ROS, medications, allergies)
- Objective (vitals, physical exam)
- Assessment (diagnoses with reasoning)
- Plan (treatment provided, disposition, follow-up)

Patient Data:
Name: {patient['name']}
Age/Sex: {patient.get('age', '')} {patient.get('sex', '')}
Chief Complaint: {patient.get('chief_complaint', 'N/A')}
HPI: {patient.get('hpi', 'N/A')}
PMH: {patient.get('pmh', 'N/A')}
Review of Systems: {patient.get('review_of_systems', 'N/A')}
Objective/Exam: {patient.get('objective', 'N/A')}
Diagnoses: {patient.get('primary_diagnoses', 'N/A')}
Plan: {patient.get('plan', 'N/A')}
Lab Results: {json.dumps(patient.get('lab_results', []))}

Write a professional, concise SOAP note as would appear in an EMR."""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return response.choices[0].message.content


async def _generate_avs(patient: dict) -> str:
    prompt = f"""Generate an After Visit Summary (AVS) for this ER patient. The AVS should be written in patient-friendly language and include:
- What brought you in today
- What we found
- What we did
- Discharge instructions (medications, activity restrictions, warning signs to return)
- Follow-up recommendations

Patient: {patient['name']}, {patient.get('age', '')} {patient.get('sex', '')}
Diagnosis: {patient.get('primary_diagnoses', 'N/A')}
Plan: {patient.get('plan', 'N/A')}
Labs: {json.dumps(patient.get('lab_results', []))}

Keep it clear, warm, and under 300 words."""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )
    return response.choices[0].message.content


async def _generate_work_school_form(patient: dict) -> dict:
    """Generate pre-filled work/school excuse form data."""
    return {
        "patient_name": patient["name"],
        "date_of_visit": str(patient.get("created_at", "")),
        "diagnosis": patient.get("primary_diagnoses", ""),
        "restrictions": "As discussed with your provider",
        "return_date": "Follow up with primary care within 3-5 days",
        "provider_signature": "[Electronic Signature Pending]",
    }
```

---

## C5: Discharge REST API

### Add to `discharge_api.py`

```python
from fastapi import HTTPException
from paperwork import generate_discharge_papers
from discharge_agent import evaluate_discharge

# ---- Discharge Endpoints ----

@router.get("/discharge/pending")
async def get_pending_discharges():
    """Get all patients flagged as discharge-ready (green)."""
    result = get_db().table("patients").select("*").eq("color", "green").execute()
    return result.data

@router.post("/discharge/{pid}/approve")
async def approve_discharge(pid: str):
    """Doctor approves discharge — generate paperwork."""
    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")

    patient = result.data[0]

    # Generate paperwork
    papers = await generate_discharge_papers(patient)

    # Update patient status
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
        "version": changes["version"]
    })

    return {"status": "approved", "papers": papers}

@router.post("/discharge/{pid}/dispute")
async def dispute_discharge(pid: str, request: Request):
    """Doctor disputes discharge — log blocking reason."""
    body = await request.json()
    reason = body.get("reason", "Doctor disagrees with discharge readiness")

    result = get_db().table("patients").select("*").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")

    patient = result.data[0]
    changes = {
        "color": "grey",  # Back to default
        "discharge_blocked_reason": reason,
        "time_to_discharge": None,
        "version": patient["version"] + 1,
    }
    get_db().table("patients").update(changes).eq("pid", pid).execute()

    await manager.broadcast({
        "type": "patient_update",
        "patient_id": pid,
        "changes": {"color": "grey"},
        "version": changes["version"]
    })

    return {"status": "disputed", "reason": reason}

@router.get("/discharge/{pid}/paperwork")
async def get_paperwork(pid: str):
    """Get generated discharge paperwork."""
    result = get_db().table("patients").select("discharge_papers").eq("pid", pid).execute()
    if not result.data:
        raise HTTPException(404, "Patient not found")
    papers = result.data[0].get("discharge_papers")
    if not papers:
        raise HTTPException(404, "No paperwork generated yet")
    return papers
```

---

## C6: Vapi Dispute Assistant

### Setup in Vapi Dashboard

Create a **second** Vapi assistant for discharge disputes.

**System Prompt:**

```
You are a clinical support agent at an emergency department. A doctor has received a discharge recommendation for a patient but disagrees. Your job is to understand what the doctor is waiting for before they'll approve discharge.

Ask the doctor:
1. What specific concern do they have about discharging this patient?
2. What test result, observation, or condition would need to be met before they'd approve?
3. Is there a specific timeframe they want to wait?

Be professional and brief. Once you understand the blocking condition, confirm it back to the doctor and tell them the system will notify them again once the condition is met.

Output structured JSON:
{
  "blocking_condition": "description of what the doctor is waiting for",
  "estimated_wait": "timeframe if provided",
  "notes": "any additional context"
}
```

Configure this assistant with:
- A function/tool `submit_dispute` that POSTs to `POST /api/discharge/{pid}/dispute`
- Pass the patient ID as context when initiating the call (via Vapi's `assistantOverrides` or `metadata`)

### Triggering the Dispute Call

On the doctor mobile page (C7), the "Dispute" button either:
1. Initiates a Vapi outbound call to the doctor (fancy) — use Vapi's `POST /call/phone` API
2. Opens a Vapi web widget for an in-browser voice chat (simpler for demo)
3. Falls back to a text input form that POSTs to `/api/discharge/{pid}/dispute` (simplest)

**Recommendation for hackathon:** Start with option 3 (text form), upgrade to option 2 (web widget) if time allows.

---

## C7: Doctor Mobile Web Page

This is a mobile-optimized web page served at the `/doctor` route. **Build this as part of the Next.js frontend** (coordinate with Person A) or as a standalone HTML page served by FastAPI.

### Option A: Next.js Route (Recommended)

Tell Person A to create `app/doctor/page.tsx`. Provide them this spec:

### Option B: FastAPI-served HTML (Simpler, no coordination needed)

Serve a simple HTML page from FastAPI. Add to `main.py`:

```python
from fastapi.responses import HTMLResponse

@app.get("/doctor", response_class=HTMLResponse)
async def doctor_page():
    return open("backend/doctor.html").read()
```

### Doctor Page Spec

**Layout:** Mobile-first, single column, clean medical styling.

**Sections:**

1. **Notification Inbox** (top)
   - List of patients flagged for discharge
   - Each card shows: patient name, summary, ESI score
   - Cards appear in real-time via WebSocket (`discharge_ready` messages)

2. **Action Buttons** (per patient card)
   - **Approve** → calls `POST /api/discharge/{pid}/approve`, then shows paperwork
   - **Dispute** → shows text input for reason, calls `POST /api/discharge/{pid}/dispute`

3. **Paperwork View** (after approve)
   - Scrollable view of SOAP note, AVS, work/school form
   - "Accept & Sign" button at bottom
   - "Edit" option (simple text editing)

### Minimal HTML Implementation

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DocBox - Doctor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 16px; }
    .header { font-size: 20px; font-weight: 600; padding: 12px 0; color: #1a1a1a; }
    .card { background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h3 { font-size: 16px; margin-bottom: 4px; }
    .card .summary { font-size: 14px; color: #666; margin-bottom: 12px; }
    .card .esi { font-size: 12px; color: #888; margin-bottom: 8px; }
    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; margin-right: 8px; }
    .btn-approve { background: #22c55e; color: white; }
    .btn-dispute { background: #ef4444; color: white; }
    .paperwork { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin-top: 12px; white-space: pre-wrap; font-size: 13px; max-height: 400px; overflow-y: auto; }
    .empty { text-align: center; color: #999; padding: 40px; }
    .dispute-input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">DocBox — Discharge Notifications</div>
  <div id="inbox"><div class="empty">Waiting for discharge notifications...</div></div>

  <script>
    const API = window.location.origin + '/api';
    const inbox = document.getElementById('inbox');
    const patients = {};

    // Connect WebSocket
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'discharge_ready') {
        addNotification(msg);
      }
    };

    function addNotification(msg) {
      if (patients[msg.patient_id]) return;
      patients[msg.patient_id] = msg;

      inbox.querySelector('.empty')?.remove();

      const card = document.createElement('div');
      card.className = 'card';
      card.id = `card-${msg.patient_id}`;
      card.innerHTML = `
        <h3>${msg.name}</h3>
        <div class="summary">${msg.summary}</div>
        <button class="btn btn-approve" onclick="approve('${msg.patient_id}')">Approve Discharge</button>
        <button class="btn btn-dispute" onclick="showDispute('${msg.patient_id}')">Dispute</button>
        <div id="dispute-${msg.patient_id}" style="display:none">
          <input class="dispute-input" id="reason-${msg.patient_id}" placeholder="What are you waiting for?">
          <button class="btn" style="margin-top:8px;background:#333;color:white" onclick="dispute('${msg.patient_id}')">Submit</button>
        </div>
        <div id="papers-${msg.patient_id}"></div>
      `;
      inbox.appendChild(card);
    }

    async function approve(pid) {
      const res = await fetch(`${API}/discharge/${pid}/approve`, { method: 'POST' });
      const data = await res.json();
      const papersDiv = document.getElementById(`papers-${pid}`);
      papersDiv.innerHTML = `
        <div class="paperwork"><strong>SOAP Note:</strong>\n${data.papers.soap_note}</div>
        <div class="paperwork"><strong>After Visit Summary:</strong>\n${data.papers.avs}</div>
        <div class="paperwork"><strong>Work/School Form:</strong>\n${JSON.stringify(data.papers.work_school_form, null, 2)}</div>
        <button class="btn btn-approve" style="margin-top:12px" onclick="sign('${pid}')">Accept & Sign</button>
      `;
    }

    function showDispute(pid) {
      document.getElementById(`dispute-${pid}`).style.display = 'block';
    }

    async function dispute(pid) {
      const reason = document.getElementById(`reason-${pid}`).value;
      await fetch(`${API}/discharge/${pid}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      document.getElementById(`card-${pid}`).remove();
      delete patients[pid];
    }

    async function sign(pid) {
      // Advance to done
      await fetch(`${API}/patients/${pid}/advance`, { method: 'POST' });
      document.getElementById(`card-${pid}`).innerHTML = '<div class="summary" style="color:green">✓ Discharged</div>';
    }

    // Load existing pending discharges
    fetch(`${API}/discharge/pending`).then(r => r.json()).then(list => {
      list.forEach(p => addNotification({
        patient_id: p.pid,
        name: p.name,
        summary: p.triage_notes || 'Ready for discharge review'
      }));
    });
  </script>
</body>
</html>
```

---

## C8: Integration Testing

### Test Checklist

1. **Vapi webhook**: Send a mock POST to `/api/vapi/webhook` with triage data → patient appears as yellow on the board
2. **Discharge evaluation**: Put a patient in `er_bed` with all labs arrived → discharge agent flags them green
3. **Doctor notification**: WebSocket receives `discharge_ready` message → doctor page shows card
4. **Approve flow**: Click approve → paperwork generates → SOAP note + AVS appear → sign works
5. **Dispute flow**: Click dispute → enter reason → patient goes back to grey → reason logged in DB
6. **Paperwork content**: SOAP note follows proper format, AVS is patient-friendly, work form is pre-filled

### Mock Vapi Webhook Test

```bash
curl -X POST http://localhost:8000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "function-call",
      "functionCall": {
        "name": "submit_triage",
        "parameters": {
          "name": "Demo Patient",
          "sex": "M",
          "age": 45,
          "chief_complaint": "Chest pain, 2 hours",
          "hpi": "45M with sudden onset substernal chest pain, 7/10, radiating to left arm. Associated diaphoresis. No prior episodes.",
          "pmh": "Hypertension, smoker",
          "review_of_systems": "Positive for diaphoresis, chest pain. Negative for SOB, fever.",
          "esi_score": 2,
          "triage_notes": "45M chest pain radiating to left arm with diaphoresis. Hx HTN, smoker. ESI 2 — 911 recommended (simulated)."
        }
      }
    }
  }'
```

---

## Files You Create

```
backend/
  discharge_api.py     # Vapi webhook + discharge REST endpoints
  discharge_agent.py   # GPT-4o discharge evaluation logic
  paperwork.py         # SOAP note, AVS, work/school form generation
  doctor.html          # Doctor mobile web page (if not using Next.js)
```

## Environment Variables You Need

Add to `.env`:
```
OPENAI_API_KEY=sk-...
VAPI_API_KEY=...          # Only if using Vapi outbound calls
```

---

## Key Reminders

- **Import from Person B's files**: `from db import get_db`, `from websocket import manager`, `from models import Patient`
- **Never call 911** — ESI 1-2 just logs a recommendation
- **Patient colors**: grey=default, yellow=real caller (you set this in webhook), green=discharge ready (you set this in discharge agent), red=surprising lab (Person B sets this)
- **Paperwork is only generated on doctor approval**, not when flagged
- **GPT-4o** for all LLM calls (discharge reasoning + paperwork generation)
- **Keep summaries to 2-4 sentences** per the project constraints
