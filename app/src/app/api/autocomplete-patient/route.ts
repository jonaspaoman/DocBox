import { NextRequest, NextResponse } from "next/server";
import { Patient } from "@/lib/types";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const AUTOCOMPLETE_PROMPT = `You are a clinical data generator for an ER simulation. Given partial patient triage data, generate realistic missing clinical fields.

Return ONLY valid JSON with these fields:
{
  "age": <integer, derive from dob if provided, otherwise estimate from context>,
  "family_social_history": "1-2 sentence family and social history",
  "objective": "Vitals and brief physical exam findings (e.g. BP, HR, RR, Temp, SpO2, pertinent positives/negatives)",
  "primary_diagnoses": "Assessment / working diagnosis",
  "justification": "1-2 sentence clinical reasoning linking complaints to diagnosis",
  "plan": "Treatment plan (labs ordered, meds, interventions)",
  "lab_results": [
    {
      "test": "Lab test name",
      "result": "Result value with units",
      "is_surprising": false,
      "arrives_at_tick": 8
    }
  ],
  "time_to_discharge": <integer 8-20>
}

Rules:
- Generate 2-4 lab results
- arrives_at_tick should be integers spread across range 5-15
- Approximately 15-20% chance ONE lab result should have is_surprising: true (abnormal/unexpected finding that would flag the patient)
- Make clinical data consistent with the chief complaint and ESI score
- Keep all text fields concise (2-4 sentences max)
- time_to_discharge should correlate with ESI severity (lower ESI = longer stay)`;

export async function autocompletePatient(patient: Patient): Promise<Partial<Patient>> {
  const patientContext = [
    patient.name && `Name: ${patient.name}`,
    patient.sex && `Sex: ${patient.sex}`,
    patient.dob && `DOB: ${patient.dob}`,
    patient.age && `Age: ${patient.age}`,
    patient.chief_complaint && `Chief Complaint: ${patient.chief_complaint}`,
    patient.hpi && `HPI: ${patient.hpi}`,
    patient.pmh && `PMH: ${patient.pmh}`,
    patient.review_of_systems && `Review of Systems: ${patient.review_of_systems}`,
    patient.esi_score && `ESI Score: ${patient.esi_score}`,
    patient.triage_notes && `Triage Notes: ${patient.triage_notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: AUTOCOMPLETE_PROMPT },
      { role: "user", content: `Patient triage data:\n\n${patientContext}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });

  const result = JSON.parse(response.choices[0].message.content ?? "{}");

  // Derive age from dob if not returned by GPT
  if (!result.age && patient.dob) {
    const birthDate = new Date(patient.dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    result.age = age;
  }

  return {
    age: result.age,
    family_social_history: result.family_social_history,
    objective: result.objective,
    primary_diagnoses: result.primary_diagnoses,
    justification: result.justification,
    plan: result.plan,
    lab_results: result.lab_results,
    time_to_discharge: result.time_to_discharge,
  };
}

// POST — manual testing endpoint
export async function POST(req: NextRequest) {
  const { patient } = await req.json();
  const result = await autocompletePatient(patient);
  return NextResponse.json(result);
}
