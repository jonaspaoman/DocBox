# Backend Core Handoff

> **NOTE**: The original FastAPI + Supabase backend was never built. The app runs entirely as a Next.js application with client-side simulation and Next.js API routes. This document is kept for reference but describes a design that was superseded.

## Current Reality

- **Simulation engine** runs client-side in `app/src/context/PatientContext.tsx`
- **Patient state** lives in React state (no database)
- **Server-side logic** uses Next.js API routes:
  - `app/src/app/api/reject/route.ts` — GPT-4o rejection processing
  - `app/src/app/api/vapi-patient/route.ts` — Vapi call polling + GPT-4o extraction
- **WebSocket hook** exists (`useWebSocket.ts`) but only connects if `NEXT_PUBLIC_WS_URL` is set
- **REST API helpers** in `api.ts` fall back to mock data when backend is unreachable
- **Mock data** in `mock-data.ts` and `patients.json` provide patient datasets

## If Building a Separate Backend

The original plan called for a Python FastAPI server with:
- Supabase (Postgres) for persistence
- WebSocket broadcasts for real-time updates
- Server-side simulation engine with tick loop
- REST API for patient management and simulation control

The Supabase schema is still available at `docs/supabase-schema.sql` and the frontend's `api.ts` + `useWebSocket.ts` are already wired to connect to an external backend if the env vars are set.

### Relevant Env Vars

```
NEXT_PUBLIC_API_URL=http://localhost:8000   # External backend REST
NEXT_PUBLIC_WS_URL=ws://localhost:8000      # External backend WebSocket
```

### Expected REST Endpoints (from api.ts)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/patients` | List all patients |
| GET | `/api/patients/{pid}` | Get single patient |
| PATCH | `/api/patients/{pid}` | Update patient fields |
| POST | `/api/patients/{pid}/advance` | Advance to next status |
| POST | `/api/patients/{pid}/assign-bed` | Assign bed number |
| POST | `/api/patients/{pid}/accept` | Accept called-in → waiting_room |
| POST | `/api/sim/start` | Start simulation |
| POST | `/api/sim/stop` | Stop simulation |
| POST | `/api/sim/speed` | Set speed multiplier |
| POST | `/api/sim/inject` | Inject next patient from dataset |
| POST | `/api/sim/mode` | Set mode (manual/auto) |
| GET | `/api/sim/state` | Get current sim state |

### Expected WebSocket Messages

```typescript
type WSMessageType = "patient_added" | "patient_update" | "sim_state" | "lab_arrived" | "discharge_ready";
```
