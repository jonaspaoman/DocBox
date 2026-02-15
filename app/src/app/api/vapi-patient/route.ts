import { NextRequest, NextResponse } from "next/server";
import { Patient } from "@/lib/types";
import OpenAI from "openai";

const VAPI_API_KEY = process.env.VAPI_API_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID ?? "";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Module-level state (persists across requests in the same server process)
let lastSeenCallId: string | null = null;
let initialized = false;
const pendingPatients: Patient[] = [];

const EXTRACTION_PROMPT = `You are a medical data extractor. Given a triage nurse phone call transcript, extract structured patient data.

Return ONLY valid JSON with these fields:
{
  "name": "Patient full name",
  "sex": "Male or Female",
  "dob": "YYYY-MM-DD",
  "chief_complaint": "Brief chief complaint summary",
  "hpi": "History of present illness narrative (2-4 sentences)",
  "pmh": "Past medical history paragraph",
  "review_of_systems": "Relevant review of systems findings",
  "esi_score": 3,
  "triage_notes": "2-3 sentence triage summary"
}

Rules:
- esi_score must be an integer 1-5 (1=most urgent, 5=least urgent)
- If information is not mentioned in the transcript, use reasonable defaults
- dob should be a plausible date; if age is mentioned, derive a dob from it
- Keep all text fields concise`;

interface VapiCall {
  id: string;
  status: string;
  transcript?: string;
  artifact?: {
    transcript?: string;
    messages?: Array<{ role?: string; content?: string; message?: string }>;
  };
  messages?: Array<{ role?: string; content?: string; message?: string }>;
}

async function fetchRecentCalls(): Promise<VapiCall[]> {
  const res = await fetch(
    `https://api.vapi.ai/call?assistantId=${VAPI_ASSISTANT_ID}&limit=5`,
    { headers: { Authorization: `Bearer ${VAPI_API_KEY}` } }
  );
  if (!res.ok) return [];
  return res.json();
}

function extractTranscript(call: VapiCall): string | null {
  if (typeof call.transcript === "string" && call.transcript.trim()) {
    return call.transcript.trim();
  }

  const artifact = call.artifact;
  if (artifact?.transcript && typeof artifact.transcript === "string") {
    return artifact.transcript.trim();
  }

  const messages = artifact?.messages ?? call.messages;
  if (messages && Array.isArray(messages)) {
    const lines = messages
      .map((m) => {
        const content = m.content || m.message || "";
        return content ? `${m.role ?? "unknown"}: ${content}` : "";
      })
      .filter(Boolean);
    if (lines.length) return lines.join("\n");
  }

  return null;
}

async function extractPatientData(transcript: string): Promise<Record<string, unknown>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: `Transcript:\n\n${transcript}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  return JSON.parse(response.choices[0].message.content ?? "{}");
}

function buildPatient(callId: string, data: Record<string, unknown>): Patient {
  return {
    pid: `vapi-${callId}`,
    name: (data.name as string) ?? "Unknown Caller",
    sex: data.sex as string | undefined,
    dob: data.dob as string | undefined,
    chief_complaint: data.chief_complaint as string | undefined,
    hpi: data.hpi as string | undefined,
    pmh: data.pmh as string | undefined,
    review_of_systems: data.review_of_systems as string | undefined,
    esi_score: (data.esi_score as number) ?? 3,
    triage_notes: data.triage_notes as string | undefined,
    color: "yellow",
    status: "called_in",
    is_simulated: false,
    version: 1,
  };
}

async function checkForNewCalls() {
  if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID) return;

  try {
    const calls = await fetchRecentCalls();
    if (!calls.length) return;

    // On first poll, seed the cursor so we don't replay old calls
    if (!initialized) {
      lastSeenCallId = calls[0].id;
      initialized = true;
      console.log(`[vapi] Initialized last_seen_call_id: ${lastSeenCallId}`);
      return;
    }

    const latest = calls[0];
    if (latest.id === lastSeenCallId || latest.status !== "ended") return;

    lastSeenCallId = latest.id;
    console.log(`[vapi] New completed call: ${latest.id}`);

    const transcript = extractTranscript(latest);
    if (!transcript) {
      console.log("[vapi] No transcript found, skipping.");
      return;
    }

    console.log(`[vapi] Extracting patient data via GPT-4o...`);
    const data = await extractPatientData(transcript);
    const patient = buildPatient(latest.id, data);
    console.log(`[vapi] Extracted: ${patient.name} (ESI ${patient.esi_score})`);

    pendingPatients.push(patient);
  } catch (e) {
    console.error("[vapi] Error checking calls:", e);
  }
}

// POST — manual injection (still useful for testing with curl)
export async function POST(req: NextRequest) {
  const patient: Patient = await req.json();
  pendingPatients.push(patient);
  return NextResponse.json({ ok: true, pid: patient.pid });
}

// GET — check Vapi for new calls, then drain the pending queue
export async function GET() {
  await checkForNewCalls();
  const batch = pendingPatients.splice(0, pendingPatients.length);
  return NextResponse.json(batch);
}
