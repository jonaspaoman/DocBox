import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { patient, rejectionNote, currentTick } = await req.json();

    const labSummary =
      patient.lab_results && patient.lab_results.length > 0
        ? patient.lab_results
            .map(
              (l: { test: string; result: string; is_surprising: boolean }) =>
                `${l.test}: ${l.result}${l.is_surprising ? " (SURPRISING)" : ""}`
            )
            .join("\n")
        : "No labs ordered yet.";

    const prompt = `You are an ER clinical decision support AI. A doctor has REJECTED a discharge recommendation for the following patient and provided a note explaining why.

Based on the doctor's rejection note and the patient's clinical data, determine:
1. How many additional time steps (each ~1.5 seconds in simulation) this patient should remain in the ER bed before being re-evaluated for discharge. Use clinical judgment: minor concerns → 4-8 steps, moderate → 8-15, serious → 15-25.
2. Any additional lab tests that should be ordered based on the doctor's concern. Each lab should have a name, whether the result might be surprising, and how many time steps until the result arrives (typically 3-8 steps).

Patient Data:
- Name: ${patient.name}, ${patient.age ?? "unknown"}yo ${patient.sex ?? "unknown"}
- Chief Complaint: ${patient.chief_complaint ?? "unknown"}
- HPI: ${patient.hpi ?? "N/A"}
- PMH: ${patient.pmh ?? "N/A"}
- Primary Diagnoses: ${patient.primary_diagnoses ?? "N/A"}
- Current Plan: ${patient.plan ?? "N/A"}
- ESI Score: ${patient.esi_score ?? "N/A"}
- Triage Notes: ${patient.triage_notes ?? "N/A"}

Current Lab Results:
${labSummary}

Previous Rejection Notes: ${
      patient.rejection_notes && patient.rejection_notes.length > 0
        ? patient.rejection_notes.join(" | ")
        : "None"
    }

Doctor's Rejection Note: "${rejectionNote}"

Respond in JSON:
{
  "time_to_discharge": <number of time steps, integer between 4 and 25>,
  "additional_labs": [
    {
      "test": "<lab test name>",
      "result": "<expected result or 'pending'>",
      "is_surprising": <true if the result could change management, false otherwise>,
      "arrives_in_ticks": <number of time steps until result arrives, integer between 3 and 8>
    }
  ],
  "reasoning": "<1-2 sentence explanation of your clinical reasoning>"
}

If no additional labs are needed based on the doctor's note, return an empty array for additional_labs. Always return at least time_to_discharge.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return NextResponse.json({ error: "Empty LLM response" }, { status: 500 });
    }

    const result = JSON.parse(content);

    // Normalize additional_labs: convert relative arrives_in_ticks to absolute arrives_at_tick
    const additionalLabs = (result.additional_labs ?? []).map(
      (lab: { test: string; result: string; is_surprising: boolean; arrives_in_ticks: number }) => ({
        test: lab.test,
        result: lab.result ?? "pending",
        is_surprising: lab.is_surprising ?? false,
        arrives_at_tick: currentTick + (lab.arrives_in_ticks ?? 5),
      })
    );

    return NextResponse.json({
      time_to_discharge: result.time_to_discharge ?? 8,
      additional_labs: additionalLabs,
      reasoning: result.reasoning ?? "",
    });
  } catch (err) {
    console.error("Reject API error:", err);
    return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
  }
}
