# Frontend Handoff

The entire app is a **Next.js application** in `/app`. There is no separate backend — simulation runs client-side, and server-side logic lives in Next.js API routes.

---

## Tech Stack

- **Next.js 16** (App Router) with TypeScript
- **Tailwind CSS v4** + **shadcn/ui** for components
- **Framer Motion** for animations
- **OpenAI SDK** (server-side, in API routes)
- Deploy to **Vercel**

---

## Running Locally

```bash
cd app
npm install
npm run dev
```

The app works without any backend or env vars — it falls back to mock data from `src/lib/mock-data.ts`.

---

## Architecture

```
app/src/
├── app/
│   ├── page.tsx              # Main kanban board
│   ├── layout.tsx            # Root layout, wraps everything in PatientProvider
│   ├── doctor/page.tsx       # Doctor inbox (mobile-optimized)
│   ├── nurse/page.tsx        # Nurse inbox (mobile-optimized)
│   └── api/
│       ├── reject/route.ts       # GPT-4o: process doctor rejection notes
│       └── vapi-patient/route.ts # Poll Vapi + GPT-4o: extract patient from call
├── context/
│   └── PatientContext.tsx    # Global state + client-side simulation engine
├── hooks/
│   ├── usePatients.ts        # Patient CRUD (React state)
│   ├── useSimulation.ts      # Sim controls (start/stop/speed/mode)
│   └── useWebSocket.ts       # Optional WebSocket to external backend
├── components/
│   ├── Board.tsx             # Main kanban layout
│   ├── Column.tsx            # Single column (Called In, Waiting Room, etc.)
│   ├── BedGrid.tsx           # 4x4 ER bed grid
│   ├── PatientDot.tsx        # Individual patient dot with animations
│   ├── PatientModal.tsx      # Detail modal on click
│   ├── PatientRow.tsx        # Patient list row
│   ├── ControlPanel.tsx      # Simulation controls (start/stop/speed/mode/inject/reset)
│   ├── NavBar.tsx            # Top navigation bar with route links
│   ├── MetricsBar.tsx        # Stats display
│   ├── EventLog.tsx          # Event log entries
│   ├── LogPanel.tsx          # Log panel container
│   └── ElapsedTime.tsx       # Live elapsed time display
└── lib/
    ├── api.ts                # REST helpers (falls back to mock when backend unreachable)
    ├── types.ts              # TypeScript interfaces (Patient, SimState, etc.)
    ├── mock-data.ts          # Fallback mock patients
    ├── patients.json         # Patient dataset for injection
    └── utils.ts              # cn() utility
```

---

## State Management

All state lives in `PatientContext.tsx`:

- **Patient list** — array of `Patient` objects in React state
- **Simulation state** — `{ current_tick, speed_multiplier, mode, is_running }`
- **Event log** — array of `LogEntry` for the activity feed
- **Discharge timers** — per-patient timers tracking when to flag for discharge

The context is provided at the layout level, so all pages (`/`, `/doctor`, `/nurse`) share the same patient state.

---

## Simulation Engine

The simulation runs entirely client-side in `PatientContext.tsx`:

- **Tick interval**: `1500ms / speed_multiplier`
- **Each tick**: picks one random advanceable action from all patients and executes it
- **~25% chance** of injecting a new patient from the dataset per tick
- **Lab results**: checked each tick; if `arrives_at_tick <= currentTick` and `is_surprising`, patient turns red
- **Discharge timers**: random delay (4-12 ticks for grey, 8-18 for red), or `time_to_discharge` from LLM rejection

### Three Modes

| Mode | Behavior |
|------|----------|
| `manual` | Simulation interval does NOT run. User advances manually. |
| `semi-auto` | Auto-progresses patients through pipeline. Doctor must approve discharges via `/doctor`. |
| `full-auto` | Like semi-auto + auto-discharges green patients + auto-marks OR/ICU done. |

---

## Board Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         DOCBOX ER FLOW BOARD                            │
├──────────┬───────────┬────────────────────┬────────────┬────────────────┤
│ CALLED   │ WAITING   │    ER BEDS         │ DISPOSITION│    DONE        │
│ IN       │ ROOM      │    (4x4 bed grid)  │ OR/DC/ICU  │               │
│  ● ●     │  ● ● ●   │  [1][2][3][4]      │  ● DC      │  ● (fading)   │
│  ●       │  ●       │  [5][6][7][8]      │  ● OR      │               │
│          │           │  [9][10][11][12]   │  ● ICU     │               │
│          │           │  [13][14][15][16]  │            │               │
├──────────┴───────────┴────────────────────┴────────────┴────────────────┤
│  CONTROL: [▶ Start] [⏸ Stop] [Reset] [Inject] [Speed] [Mode: semi]    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Patient Data Shape

See `src/lib/types.ts` for the canonical interfaces:

```typescript
interface Patient {
  pid: string;
  name: string;
  sex?: string;
  age?: number;
  dob?: string;
  chief_complaint?: string;
  hpi?: string;
  pmh?: string;
  family_social_history?: string;
  review_of_systems?: string;
  objective?: string;
  primary_diagnoses?: string;
  justification?: string;
  plan?: string;
  esi_score?: number;           // 1-5
  triage_notes?: string;
  color: PatientColor;          // grey | yellow | green | red
  status: PatientStatus;        // called_in | waiting_room | er_bed | or | discharge | icu | done
  bed_number?: number;          // 1-16
  is_simulated: boolean;
  version: number;
  lab_results?: LabResult[];
  time_to_discharge?: number;
  discharge_blocked_reason?: string;
  rejection_notes?: string[];
  discharge_papers?: Record<string, string>;
  entered_current_status_tick?: number;
}
```

---

## API Routes (Server-Side)

### `POST /api/reject`
- Input: `{ patient, rejectionNote, currentTick }`
- Uses GPT-4o to determine additional wait time and new labs after a doctor rejects a discharge
- Returns: `{ time_to_discharge, additional_labs[], reasoning }`

### `GET /api/vapi-patient`
- Polls Vapi API for recently completed calls
- Extracts structured patient data from transcripts via GPT-4o
- Returns: `Patient[]` (pending patients to be added to the board)

### `POST /api/vapi-patient`
- Manual patient injection (useful for testing with curl)
- Input: `Patient` JSON body

---

## Vapi Integration Flow

1. Someone calls the Vapi phone number → Vapi triage assistant collects patient info
2. `PatientContext.tsx` polls `GET /api/vapi-patient` every 3 seconds
3. API route checks Vapi for new completed calls, extracts patient data via GPT-4o
4. Returns new patients → context adds them to state as yellow dots in "Called In"

---

## Doctor Page (`/doctor`)

- Shows inbox of ER bed patients that are green (discharge-ready) or red (surprising lab)
- **Review Discharge**: generates paperwork client-side using template matching on chief complaint keywords (chest pain, abdominal pain, migraine, laceration, etc.)
- **Approve & Discharge**: saves paperwork and moves patient to done
- **Reject & Note**: sends rejection note to `/api/reject` GPT-4o endpoint, resets patient to grey with new timer and optional additional labs

---

## Nurse Page (`/nurse`)

- Shows inbox of patients in `called_in` status
- Nurse can review/edit patient info (name, age, sex, ESI, chief complaint, triage notes)
- "Accept → Waiting Room" moves patient to waiting_room status

---

## Key Reminders

- **Framer Motion `layoutId`** on patient dots enables animated transitions between columns
- **Version field** on patients resolves conflicts (always use latest version)
- The app works without any backend — mock data fills in when API calls fail
- ER beds are numbered 1-16 in a 4x4 grid
- Patient colors: grey (default), yellow (real caller), green (discharge ready), red (surprising lab)
