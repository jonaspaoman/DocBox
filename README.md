# DocBox

**Real-time ER management system that optimizes patient intake and discharge flow using AI.**

Built at TreeHacks 2026 by Jonas Pao, Connor Lee, Kevin Zhu, and Jacob Goldberg.

## Inspiration

Emergency departments lose hours to inefficient patient tracking, slow discharge decisions, and manual paperwork. We built DocBox to show what an AI-augmented ER command center could look like — where clinicians stay in control, but AI handles the busywork.

## What It Does

DocBox is a live simulation of an emergency department with three views:

- **Operations Board** — A kanban-style dashboard showing every patient as a color-coded dot flowing through the ER pipeline: `called_in → waiting_room → er_bed → discharge → done`. Includes a 4x4 bed grid, real-time metrics (revenue, avg stay, bed utilization), and an event log.

- **Nurse Inbox** — Triage interface for incoming patients. Nurses review chief complaints, edit ESI scores, and accept patients into the waiting room.

- **Doctor Inbox** — Notification feed for patients flagged for discharge (green) or with surprising lab results (red). Doctors can:
  - **Approve discharge** — review and edit auto-generated paperwork (SOAP note, AVS, work/school form), then release the patient.
  - **Reject & Note** — write a rejection note explaining why the patient isn't ready. GPT-4o analyzes the note and returns a re-evaluation delay + any additional labs to order.

### Patient Colors

| Color | Meaning |
|-------|---------|
| Grey | Default simulated patient |
| Yellow | Real caller (via Vapi voice agent) |
| Green | Ready for discharge |
| Red | Surprising lab result — needs attention |

## How We Built It

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, shadcn/ui |
| AI | OpenAI GPT-4o (discharge rejection analysis, clinical decision support) |
| Voice | Vapi (phone-based triage nurse agent) |
| Simulation | Client-side tick engine with three modes (Manual, Semi-Auto, Full-Auto) |

### Simulation Engine

The app runs a tick-based simulation (1.5s per tick, adjustable 0.5x–5x speed) that drives patient flow:

- **Semi-auto**: Patients automatically progress through the pipeline; discharge requires doctor approval.
- **Full-auto**: Everything is automated, including discharge and OR/ICU resolution.
- **Manual**: All transitions require explicit user action.

Each tick, the engine checks for arriving lab results, manages discharge timers, and occasionally injects new patients.

### AI-Powered Discharge Rejection

When a doctor rejects a discharge, the rejection note and full patient context are sent to GPT-4o via a Next.js API route (`/api/reject`). The model returns:

1. **Time to discharge** — how many ticks before re-evaluating (based on clinical severity)
2. **Additional labs** — any tests the patient should take, with expected arrival times and whether the result might be surprising

These outputs feed directly back into the simulation: the patient's discharge timer resets to the LLM-specified delay, and new labs appear on schedule — potentially turning the patient red if results are unexpected.

## Challenges

- Designing a simulation that feels realistic in a 2-3 minute demo window
- Making the LLM output structured, clinically reasonable decisions that integrate smoothly with the tick system
- Balancing automation levels — too much feels fake, too little is boring to watch

## What We Learned

- How ESI triage scoring works in real emergency departments
- Prompt engineering for structured medical JSON output from GPT-4o
- Building real-time animated UIs with Framer Motion and React state

## Running Locally

```bash
# Install dependencies
cd app && npm install

# Add your API keys
cat > app/.env.local << EOF
OPENAI_API_KEY=sk-...
VAPI_API_KEY=...
VAPI_ASSISTANT_ID=...
EOF

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the Operations board, `/nurse` for the Nurse inbox, and `/doctor` for the Doctor inbox.
