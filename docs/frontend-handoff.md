# Frontend Handoff (Person A)

You're building the **Next.js animated flow board UI** — the main visual that everyone sees during the demo. Patients appear as colored dots/cards flowing through a hospital-themed kanban pipeline.

---

## Tech Stack

- **Next.js** (App Router)
- **Tailwind CSS** + **shadcn/ui** for components
- **Framer Motion** for animations
- **WebSocket** for real-time updates
- Deploy to **Vercel**

---

## Setup

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir
cd frontend
npx shadcn@latest init
npm install framer-motion
```

---

## Architecture

```
Frontend (Next.js)
  ├── WebSocket connection to backend /ws
  ├── REST calls to backend /api/*
  ├── Main board view (/)
  └── Doctor page (/doctor) — Person C may provide specs
```

### Backend Connection

- **WebSocket**: `ws://BACKEND_URL/ws` — receives all real-time updates
- **REST API**: `http://BACKEND_URL/api/*` — for initial data load + user actions
- Set `NEXT_PUBLIC_API_URL` env var for the backend URL

---

## Board Layout

The board is a **horizontal kanban** with these columns representing the patient lifecycle:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DOCBOX ER FLOW BOARD                            │
├──────────┬───────────┬────────────────────┬────────────┬───────────────┤
│ CALLED   │ WAITING   │    ER BEDS         │ DISPOSITION│    DONE       │
│ IN       │ ROOM      │    (bed grid)      │ OR/DC/ICU  │               │
│          │           │                    │            │               │
│  ● ●     │  ● ● ●   │  [1][2][3][4]      │  ● DC      │  ● (fading)  │
│  ●       │  ●       │  [5][6][7][8]      │  ● OR      │               │
│          │           │  [9][10][11][12]   │  ● ICU     │               │
│          │           │  [13][14][15][16]  │            │               │
├──────────┴───────────┴────────────────────┴────────────┴───────────────┤
│  CONTROL PANEL: [▶ Start] [⏸ Stop] [💉 Inject] [Speed: ■■■□□] [Auto] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Columns

| Column | Status Values | Description |
|--------|--------------|-------------|
| Called In | `called_in` | Patients who just called/arrived. Dots pulse gently. |
| Waiting Room | `waiting_room` | Accepted patients waiting for a bed. Dots idle-bob. |
| ER Beds | `er_bed` | 4x4 grid of 16 beds. Occupied beds show patient dot with bed number. |
| Disposition | `or`, `discharge`, `icu` | Three sub-lanes: OR, Discharge, ICU. Dots move to appropriate lane. |
| Done | `done` | Patients fade out and dissolve after a few seconds. |

### Hospital Boundary

Draw a subtle border/background around the ER Beds and Disposition columns to represent "inside the hospital." Called In and Waiting Room are "outside" (lighter background). This creates a visual sense of entering the hospital.

Optional: Show small icons for EMS entrance (ambulance) and walk-in entrance (door) feeding into Called In.

---

## Patient Dots

Each patient is represented as a **colored circle/dot** (~24-32px) that moves between columns with animated transitions.

### Colors

| Color | CSS | Meaning |
|-------|-----|---------|
| Grey | `#9CA3AF` | Default simulated patient |
| Yellow | `#EAB308` | Real person who called in via phone |
| Green | `#22C55E` | Ready to discharge |
| Red | `#EF4444` | Flagged — surprising test result |

### Animations

| State | Animation |
|-------|-----------|
| Called In | Gentle pulse (scale 1.0 → 1.1 → 1.0, 2s loop) |
| Waiting Room | Subtle idle bob (translateY 0 → -3px → 0, 3s loop) |
| ER Bed | Static, slight glow |
| Disposition (OR) | Quick pulse |
| Disposition (Discharge) | Gentle green glow |
| Disposition (ICU) | Slow red pulse |
| Done | Fade out + scale down over 2s, then remove |
| Transition between columns | Smooth slide using Framer Motion `layoutId` or `animate` (300-500ms) |

### PENDING Gates

Between columns, show a **PENDING overlay** when a patient needs manual action:

- **Called In → Waiting Room**: "PENDING: Nurse Accept" — click dot or accept button to advance
- **Waiting Room → ER Bed**: "PENDING: Bed Assignment" — click to assign a bed
- **ER Bed → Disposition**: "PENDING: Discharge/Transfer Decision"

In **auto mode**, these gates resolve automatically. In **manual mode**, they require clicking.

---

## Patient Detail Modal

Clicking a patient dot opens a **modal/drawer** showing:

```
┌──────────────────────────────────┐
│  Maria Santos           ESI: 3   │
│  34F | Bed #5                    │
│  ──────────────────────────────  │
│  Chief Complaint:                │
│  Severe abdominal pain, 6 hours │
│                                  │
│  Triage Notes:                   │
│  34F, acute RLQ pain 8/10...    │
│                                  │
│  Lab Results:                    │
│  ✓ CBC — WBC 14.2k (elevated)  │
│  ✓ CMP — Normal                │
│  ⏳ CT Abdomen — pending         │
│                                  │
│  [Advance] [Assign Bed]         │
└──────────────────────────────────┘
```

- Show checkmark for arrived labs, spinner for pending
- Color the lab row red if `is_surprising: true`
- Action buttons depend on current status:
  - `called_in`: [Accept Patient]
  - `waiting_room`: [Assign Bed] (shows bed picker)
  - `er_bed`: [Advance] (moves to discharge/or/icu)
  - `discharge`/`or`/`icu`: [Mark Done]

---

## Control Panel

Bottom bar (or top bar) with simulation controls:

| Control | Action | API Call |
|---------|--------|----------|
| Start ▶ | Start simulation clock | `POST /api/sim/start` |
| Stop ⏸ | Pause simulation | `POST /api/sim/stop` |
| Inject 💉 | Add next patient from dataset | `POST /api/sim/inject` |
| Speed slider | 0.5x — 5x speed | `POST /api/sim/speed {speed: N}` |
| Mode toggle | Manual / Auto | `POST /api/sim/mode {mode: "manual"|"auto"}` |
| Tick counter | Shows current tick | From WebSocket `sim_state` |

---

## WebSocket Integration

### Connect on mount

```typescript
useEffect(() => {
  const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/ws`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case 'patient_added':
        // Add new patient to state
        addPatient(msg.patient);
        break;
      case 'patient_update':
        // Update existing patient with changes
        updatePatient(msg.patient_id, msg.changes, msg.version);
        break;
      case 'sim_state':
        // Update simulation display (tick, speed, mode)
        setSimState(msg);
        break;
      case 'lab_arrived':
        // Could show a brief toast/indicator
        break;
      case 'discharge_ready':
        // Only relevant for /doctor page
        break;
    }
  };

  return () => ws.close();
}, []);
```

### Initial data load

On page mount, also fetch current patients:
```typescript
const res = await fetch(`${API_URL}/api/patients`);
const patients = await res.json();
```

---

## REST API Reference

### Simulation

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/sim/start` | — | `{status: "running"}` |
| POST | `/api/sim/stop` | — | `{status: "stopped"}` |
| POST | `/api/sim/speed` | `{speed: 2.0}` | `{speed: 2.0}` |
| POST | `/api/sim/inject` | — | `{patient: {...}}` |
| POST | `/api/sim/mode` | `{mode: "auto"}` | `{mode: "auto"}` |
| GET | `/api/sim/state` | — | `{current_tick, speed_multiplier, mode, is_running}` |

### Patients

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/patients` | — | `[{pid, name, status, color, ...}]` |
| GET | `/api/patients/{pid}` | — | `{full patient object}` |
| POST | `/api/patients/{pid}/advance` | — | `{status: "next_status"}` |
| POST | `/api/patients/{pid}/assign-bed` | `{bed_number: 5}` | `{bed_number: 5}` |
| POST | `/api/patients/{pid}/accept` | — | `{status: "waiting_room"}` |

---

## Patient Data Shape

```typescript
interface Patient {
  pid: string;              // UUID
  name: string;
  sex?: string;
  age?: number;
  chief_complaint?: string;
  hpi?: string;
  pmh?: string;
  triage_notes?: string;
  esi_score?: number;       // 1-5
  color: string;            // grey | yellow | green | red
  status: string;           // called_in | waiting_room | er_bed | or | discharge | icu | done
  bed_number?: number;      // 1-16
  is_simulated: boolean;
  version: number;
  lab_results?: LabResult[];
  time_to_discharge?: number;
}

interface LabResult {
  test: string;
  result: string;
  is_surprising: boolean;
  arrives_at_tick: number;
}

interface SimState {
  current_tick: number;
  speed_multiplier: number;
  mode: string;             // "manual" | "auto"
  is_running: boolean;
}
```

---

## Styling Guidelines

- **Light, clean, medical** aesthetic
- White/light grey backgrounds, subtle shadows
- Use a monospace or clean sans-serif font for data
- Color accents only from patient colors (grey, yellow, green, red)
- Hospital boundary: subtle blue-grey tinted background for ER area
- Responsive but optimized for **wide desktop** display (demo will be on a large screen)
- shadcn/ui for modals, buttons, sliders, toggles

---

## Suggested Component Structure

```
app/
  page.tsx                  # Main board
  doctor/page.tsx           # Doctor mobile page (Person C provides spec)
  layout.tsx

components/
  Board.tsx                 # Main kanban layout
  Column.tsx                # Single column (Called In, Waiting Room, etc.)
  BedGrid.tsx               # 4x4 ER bed grid
  PatientDot.tsx            # Individual patient dot with animations
  PatientModal.tsx          # Detail modal on click
  ControlPanel.tsx          # Simulation controls
  PendingGate.tsx           # PENDING overlay between columns

hooks/
  useWebSocket.ts           # WebSocket connection + message handling
  usePatients.ts            # Patient state management
  useSimulation.ts          # Sim state + control actions

lib/
  api.ts                    # REST API helper functions
  types.ts                  # TypeScript interfaces
```

---

## Demo Flow (What the Audience Sees)

1. Board starts empty
2. Presenter clicks "Start" — simulation begins
3. Patients appear in "Called In" column, pulse gently
4. In auto mode: patients flow through the pipeline automatically
5. In manual mode: presenter clicks to accept, assign beds, advance
6. A real person calls the Vapi number — a **yellow dot** appears in Called In
7. Lab results arrive — one patient turns **red** (surprising result)
8. Patients in ER beds turn **green** when discharge-ready
9. On the doctor's phone: discharge notifications appear, doctor approves
10. Approved patients flow to "Done" and dissolve
11. Full cycle in 2-3 minutes

---

## Key Reminders

- **Framer Motion `layoutId`** on patient dots enables automatic animated transitions between columns
- Use **optimistic updates** — apply WebSocket changes immediately to state
- **Version field** on patients helps resolve conflicts (always use latest version)
- The board should work even if WebSocket disconnects — show a reconnecting indicator
- Don't poll — all updates come via WebSocket
- ER beds are numbered 1-16 in a 4x4 grid
