# DocBox

ER management system for hackathon demo — optimizes patient intake and discharge flow. Mixes real callers with simulated patients for a live-feeling board.

## Tech Stack

| Area | Technology |
|------|-----------|
| App | Next.js (App Router) + Tailwind + shadcn/ui + Framer Motion |
| API Routes | Next.js API routes (`/api/reject`, `/api/vapi-patient`) |
| Voice agent | Vapi (phone number for triage) |
| LLM | GPT-4o via OpenAI SDK (rejection reasoning, patient data extraction) |
| Doctor view | `/doctor` route (mobile-optimized) |
| Nurse view | `/nurse` route (mobile-optimized) |
| Auth | None |
| Hosting | Vercel |

## Architecture

```
Next.js App (Vercel)
├── Main board (/)           ← kanban view, simulation engine runs client-side
├── Doctor inbox (/doctor)   ← discharge review, reject/approve, paperwork
├── Nurse inbox (/nurse)     ← accept called-in patients to waiting room
├── API: /api/vapi-patient   ← polls Vapi for completed calls, extracts patient via GPT-4o
└── API: /api/reject         ← GPT-4o processes doctor rejection notes
         ▲
         │
    Vapi Voice Agent ──► OpenAI GPT-4o
```

- **No separate backend server** — simulation runs client-side in `PatientContext.tsx`.
- **No database** — patient state lives in React state (shared across pages via context). Mock data loaded from `patients.json`.
- **Vapi integration** — API route polls Vapi for completed calls every 3 seconds, extracts structured patient data from transcripts via GPT-4o, queues patients for the frontend to pick up.
- **Discharge paperwork** — generated client-side in `doctor/page.tsx` using template matching on chief complaint keywords. No LLM call for paperwork generation.
- **Rejection flow** — calls `/api/reject` which uses GPT-4o to determine additional wait time and labs.

## Patient Data Model

```
Patient (flat — all fields at top level)
├── pid: string
├── name, sex, age, dob
├── chief_complaint, hpi, pmh, family_social_history, review_of_systems
├── objective, primary_diagnoses, justification, plan
├── esi_score (1-5), triage_notes
├── color: "grey" | "yellow" | "green" | "red"
├── status: "called_in" | "waiting_room" | "er_bed" | "or" | "discharge" | "icu" | "done"
├── bed_number (1-16)
├── is_simulated, version
├── lab_results: [{ test, result, is_surprising, arrives_at_tick }]
├── time_to_discharge, discharge_blocked_reason
├── rejection_notes: string[]
├── discharge_papers: Record<string, string>
├── entered_current_status_tick
└── created_at, updated_at
```

## Patient Lifecycle

```
called_in → waiting_room → er_bed → (or | discharge | icu) → done
```

## Simulation Modes

| Mode | Behavior |
|------|----------|
| `manual` | No auto-progression. User must manually advance patients. |
| `semi-auto` | Patients auto-flow through pipeline (one action per tick, randomly chosen). Doctor must approve discharges. |
| `full-auto` | Like semi-auto but also auto-discharges green patients and marks OR/ICU patients done. |

Simulation tick interval: `1500ms / speed_multiplier`. Each tick, one random advanceable patient action fires. ~25% chance of injecting a new patient per tick.

## Patient Colors

| Color | Meaning |
|-------|---------|
| `grey` | Default simulated patient |
| `yellow` | Real person who called in via Vapi |
| `green` | Ready to discharge (flagged by timer expiry) |
| `red` | Flagged — surprising lab result arrived |

## Key Constraints

- **Safety**: Decision support only — clinicians own all decisions. ESI and discharge suggestions require human confirmation.
- **Never call 911** — only simulate the recommendation.
- **One caller at a time** for real intake; simulated patients stream in parallel.
- **Patient summaries**: 2-4 sentences max.
- **ER beds**: 16 beds in a 4x4 grid.
- **Demo duration**: 2-3 minutes.

## File Structure

```
/app                          # Next.js app
  /src
    /app
      page.tsx                # Main kanban board
      layout.tsx              # Root layout with PatientProvider
      /doctor/page.tsx        # Doctor inbox + discharge paperwork
      /nurse/page.tsx         # Nurse inbox + accept patients
      /api/reject/route.ts    # GPT-4o rejection processing
      /api/vapi-patient/route.ts  # Vapi call polling + GPT-4o extraction
    /components
      Board.tsx, Column.tsx, BedGrid.tsx, PatientDot.tsx
      PatientModal.tsx, PatientRow.tsx
      ControlPanel.tsx, NavBar.tsx, MetricsBar.tsx
      EventLog.tsx, LogPanel.tsx, ElapsedTime.tsx
      /ui (shadcn components)
    /context
      PatientContext.tsx       # Global state + simulation engine
    /hooks
      usePatients.ts           # Patient CRUD state
      useSimulation.ts         # Sim state + controls
      useWebSocket.ts          # WebSocket connection (optional, for external backend)
    /lib
      api.ts                   # REST helpers (falls back to mock data)
      types.ts                 # TypeScript interfaces
      mock-data.ts             # Fallback mock patients
      patients.json            # Patient dataset for injection
      utils.ts
/data
  patients.json                # Patient dataset (root copy)
/docs
  frontend-handoff.md, backend-core-handoff.md, ai-integrations-handoff.md
  supabase-schema.sql
/tests                         # Python test stubs (legacy)
```

## Environment Variables

```
# app/.env.local
VAPI_API_KEY=...              # For polling Vapi calls
VAPI_ASSISTANT_ID=...         # Vapi triage assistant ID
OPENAI_API_KEY=...            # For GPT-4o (rejection + extraction)
NEXT_PUBLIC_API_URL=...       # Optional external backend URL
NEXT_PUBLIC_WS_URL=...        # Optional WebSocket URL
```

## Services

- UI + API routes: Vercel
- Voice agent (triage nurse): Vapi
