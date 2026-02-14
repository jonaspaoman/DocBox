# DocBox

ER management system for hackathon demo — optimizes patient intake and discharge flow. Mixes real callers with simulated patients for a live-feeling board.

## Tech Stack

| Area | Technology |
|------|-----------|
| Frontend | Next.js + Tailwind + shadcn/ui + Framer Motion |
| Backend | Python FastAPI |
| Database | Supabase (Postgres only, FastAPI handles WebSockets) |
| Voice agent | Vapi (phone number for triage + discharge dispute) |
| LLM | GPT-4o (discharge reasoning, SOAP notes, paperwork) |
| Doctor view | Mobile web fallback at `/doctor` route |
| Auth | None |
| Hosting | Vercel (UI), local/cloud (backend) |

## Architecture

```
Next.js UI ◄──WebSocket──► FastAPI Backend ◄──► Supabase (Postgres)
                                  ▲
Doctor /doctor ◄──REST──►         │
                            Vapi Voice ──► OpenAI GPT-4o
```

- **Intake**: Vapi voice agent acts as triage nurse. Collects vitals, history, chief complaint. Outputs: triage notes, ESI score (1-5), patient record in DB. ESI 1-2 simulates "Call 911 recommended" — never actually calls 911.
- **Outtake**: AI agent monitors ER beds, computes `time_to_discharge` via GPT-4o, waits for lab results, then notifies doctor. Doctor can accept (gets auto-filled discharge paperwork: ED SOAP note, AVS, work/school form) or dispute.
- **Observability**: Backend broadcasts patient state deltas via WebSockets on a clock cycle. Frontend animates changes.
- **UI**: Kanban board — patients as colored dots moving through pipeline. Hospital boundary visual around ER beds.

## Patient Data Model

```
Patient
├── pid (UUID)
├── demographics: { name, sex, dob, address }
├── medical_history: "paragraph of prior conditions"
├── ed_session
│   ├── triage: { chief_complaint_summary, hpi_narrative, esi_score, time_admitted }
│   ├── doctor_notes: { subjective, objective, assessment, plan }  ← SOAP format
│   ├── labs: [{ test, result, is_surprising, arrives_at_tick }]
│   └── discharge_papers: { disposition, diagnosis, discharge_justification,
│                           admitting_attending, follow_up,
│                           follow_up_instructions, warning_instructions,
│                           soap_note, avs, work_school_form }
├── color, status, bed_number (flat system fields)
├── is_simulated, version, entered_current_status_tick
├── time_to_discharge, discharge_blocked_reason
└── created_at, updated_at
```

- `demographics`, `medical_history`, and `ed_session` are JSONB columns in Supabase
- System fields (`color`, `status`, `bed_number`, etc.) remain flat columns
- `age` is derived from `dob` — not stored

## Patient Lifecycle

```
called_in → waiting_room → er_bed → (or | discharge | icu) → done
```

Each transition has PENDING gates in manual mode. Each patient has individual transition probabilities.

## Patient Colors

| Color | Meaning |
|-------|---------|
| `grey` | Default simulated patient |
| `yellow` | Real person who called in via Vapi |
| `green` | Ready to discharge |
| `red` | Flagged — surprising test result |

## Key Constraints

- **Safety**: Decision support only — clinicians own all decisions. ESI and discharge suggestions require human confirmation.
- **Never call 911** — only simulate the recommendation.
- **One caller at a time** for real intake; simulated patients stream in parallel.
- **Patient summaries**: 2-4 sentences max.
- **Realtime updates**: WebSocket events/deltas, not polling/refreshes.
- **ER beds**: 16 beds in a 4x4 grid.
- **Demo duration**: 2-3 minutes.

## Team Split

- **Person A (Frontend)**: Next.js animated kanban board → `docs/frontend-handoff.md`
- **Person B (Backend Core)**: FastAPI server, Supabase, simulation engine, WebSocket, REST API → `docs/backend-core-handoff.md`
- **Person C (AI + Integrations)**: Vapi, discharge agent, paperwork generation, doctor mobile page → `docs/ai-integrations-handoff.md`

## File Structure

```
/backend
  main.py, api.py, websocket.py, simulation.py    # Person B
  discharge_api.py, discharge_agent.py, paperwork.py  # Person C
  db.py, models.py                                  # Person B (shared)
  /data/patients.json                               # Person B
/docs
  frontend-handoff.md, backend-core-handoff.md, ai-integrations-handoff.md
  supabase-schema.sql
/frontend                                           # Person A
```

## Services

- UI: Vercel
- Voice agent (triage nurse): Vapi
- Database: Supabase
