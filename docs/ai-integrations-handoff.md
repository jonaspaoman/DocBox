# AI + Integrations Handoff

This document describes the AI and external integration layer — Vapi voice agent, GPT-4o processing, and discharge paperwork generation.

---

## Overview

| Feature | Implementation | Location |
|---------|---------------|----------|
| Vapi triage intake | Polls Vapi API, extracts patient data via GPT-4o | `app/src/app/api/vapi-patient/route.ts` |
| Rejection processing | GPT-4o determines wait time + additional labs | `app/src/app/api/reject/route.ts` |
| Discharge paperwork | Client-side template matching on chief complaint | `app/src/app/doctor/page.tsx` |
| Doctor inbox | Review/approve/reject discharge recommendations | `app/src/app/doctor/page.tsx` |
| Nurse inbox | Review/edit/accept called-in patients | `app/src/app/nurse/page.tsx` |

---

## Vapi Triage Integration

### How It Works

1. Patient calls the Vapi phone number
2. Vapi triage assistant (configured in Vapi Dashboard) collects patient info via voice
3. `PatientContext.tsx` polls `GET /api/vapi-patient` every 3 seconds
4. The API route (`vapi-patient/route.ts`):
   - Fetches recent calls from Vapi API (`GET https://api.vapi.ai/call`)
   - Tracks `lastSeenCallId` to detect new completed calls
   - Extracts transcript from the call (checks `call.transcript`, `call.artifact.transcript`, or reconstructs from messages)
   - Sends transcript to GPT-4o with extraction prompt → gets structured JSON
   - Builds a `Patient` object with `color: "yellow"`, `status: "called_in"`, `is_simulated: false`
   - Queues patient in `pendingPatients` array (module-level state)
5. Frontend picks up the patient and adds it to the board as a yellow dot

### Environment Variables

```
VAPI_API_KEY=...           # Bearer token for Vapi API
VAPI_ASSISTANT_ID=...      # ID of the triage assistant
OPENAI_API_KEY=...         # For GPT-4o extraction
```

### GPT-4o Extraction Prompt

Extracts: `name`, `sex`, `dob`, `chief_complaint`, `hpi`, `pmh`, `review_of_systems`, `esi_score`, `triage_notes`

Temperature: 0.2, response_format: json_object

---

## Rejection Processing (`/api/reject`)

When a doctor rejects a discharge recommendation:

1. Doctor writes a rejection note on the `/doctor` page
2. Frontend calls `POST /api/reject` with `{ patient, rejectionNote, currentTick }`
3. GPT-4o analyzes the patient data + rejection note and returns:
   - `time_to_discharge`: additional ticks to wait (4-25)
   - `additional_labs`: new lab tests to order (with `arrives_at_tick` computed as `currentTick + arrives_in_ticks`)
   - `reasoning`: 1-2 sentence explanation
4. Frontend updates the patient: color → grey, adds rejection note to `rejection_notes[]`, sets new `time_to_discharge`, appends any new labs

Temperature: 0.3, response_format: json_object

---

## Discharge Paperwork Generation

Paperwork is generated **client-side** in `doctor/page.tsx` using template matching:

### Template Matching

The `generateDischargePapers()` function matches the patient's chief complaint against keyword templates:

| Keywords | Template |
|----------|----------|
| chest pain, substernal | Non-cardiac chest pain with cardiology follow-up |
| abdominal pain, rlq, abdomen | Acute appendicitis with surgical admission |
| migraine, headache | Migraine with aura, neurology follow-up |
| laceration, cut | Simple laceration with wound repair |
| shortness of breath, dyspnea, breathing | CHF exacerbation, cardiology admission |
| ankle, sprain | Ankle sprain with RICE protocol |
| syncope, faint, passed out | Vasovagal syncope with incidental anemia |
| allergic, swelling, anaphylaxis | Anaphylaxis with EpiPen and allergist referral |
| wrist, foosh | Distal radius fracture with splint |

Falls back to a generic template if no keywords match.

### Paperwork Fields

Each template generates all 10 discharge paper fields:
- `disposition`, `diagnosis`, `discharge_justification`
- `admitting_attending` (randomly selected from 4 attending names)
- `follow_up`, `follow_up_instructions`, `warning_instructions`
- `soap_note` (full S/O/A/P), `avs` (After Visit Summary), `work_school_form`

### Doctor Review Flow

1. Doctor clicks "Review Discharge" on a green patient
2. Papers are generated and shown in editable fields
3. Doctor can modify any field
4. "Approve & Discharge" saves papers and moves patient to done

---

## Vapi Triage Assistant Configuration

Configure in the [Vapi Dashboard](https://dashboard.vapi.ai/):

### System Prompt

```
You are a triage nurse at an emergency department. Your job is to quickly and compassionately assess the caller's condition over the phone. You need to collect:

1. Full name
2. Age, sex, and date of birth
3. Chief complaint (why they're coming in, in their own words)
4. History of present illness (when it started, severity 1-10, what makes it better/worse, associated symptoms)
5. Past medical history (chronic conditions, surgeries, current medications, allergies)
6. Brief review of systems (any other symptoms: fever, nausea, dizziness, shortness of breath, etc.)

Be warm, professional, and efficient. Ask one question at a time. If the caller describes symptoms suggesting ESI 1-2, calmly tell them: "Based on what you're describing, I strongly recommend calling 911 immediately." Do NOT actually call 911.

After collecting all information, say: "Thank you. I've created your chart. When you arrive, check in at the front desk and mention your name."
```

### Configuration

- Model: GPT-4o
- Phone number configured in Vapi
- No webhook needed — the app polls Vapi for completed calls

---

## Key Reminders

- **Never call 911** — ESI 1-2 only simulates a recommendation
- **Patient colors**: grey=default, yellow=real caller (set in vapi-patient route), green=discharge ready (set by simulation timer), red=surprising lab (set by simulation tick)
- **Paperwork is template-based**, not LLM-generated — fast and deterministic for the demo
- **Rejection processing is the only live LLM call** during the demo flow (besides initial Vapi extraction)
- **Keep summaries to 2-4 sentences** per project constraints
