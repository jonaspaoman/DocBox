"""Discharge paperwork generation — SOAP note, AVS, work/school form via GPT-4o."""

import os
import json
from openai import OpenAI
from backend.db import get_db

_client = None


def _get_openai_client():
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return _client


async def generate_discharge_papers(patient: dict) -> dict:
    """Generate all discharge paperwork for a patient."""
    soap_note = await _generate_soap_note(patient)
    avs = await _generate_avs(patient)
    work_school_form = await _generate_work_school_form(patient)

    papers = {
        "soap_note": soap_note,
        "avs": avs,
        "work_school_form": work_school_form,
    }

    get_db().table("patients").update(
        {"discharge_papers": papers}
    ).eq("pid", patient["pid"]).execute()

    return papers


async def _generate_soap_note(patient: dict) -> str:
    prompt = f"""Generate an ED SOAP note for this patient. Use standard ED SOAP format:
- Subjective (chief complaint, HPI, PMH, ROS, medications, allergies)
- Objective (vitals, physical exam)
- Assessment (diagnoses with reasoning)
- Plan (treatment provided, disposition, follow-up)

Patient Data:
Name: {patient['name']}
Age/Sex: {patient.get('age', '')} {patient.get('sex', '')}
Chief Complaint: {patient.get('chief_complaint', 'N/A')}
HPI: {patient.get('hpi', 'N/A')}
PMH: {patient.get('pmh', 'N/A')}
Review of Systems: {patient.get('review_of_systems', 'N/A')}
Objective/Exam: {patient.get('objective', 'N/A')}
Diagnoses: {patient.get('primary_diagnoses', 'N/A')}
Plan: {patient.get('plan', 'N/A')}
Lab Results: {json.dumps(patient.get('lab_results', []))}

Write a professional, concise SOAP note as would appear in an EMR."""

    response = _get_openai_client().chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return response.choices[0].message.content


async def _generate_avs(patient: dict) -> str:
    prompt = f"""Generate an After Visit Summary (AVS) for this ER patient. The AVS should be written in patient-friendly language and include:
- What brought you in today
- What we found
- What we did
- Discharge instructions (medications, activity restrictions, warning signs to return)
- Follow-up recommendations

Patient: {patient['name']}, {patient.get('age', '')} {patient.get('sex', '')}
Diagnosis: {patient.get('primary_diagnoses', 'N/A')}
Plan: {patient.get('plan', 'N/A')}
Labs: {json.dumps(patient.get('lab_results', []))}

Keep it clear, warm, and under 300 words."""

    response = _get_openai_client().chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )
    return response.choices[0].message.content


async def _generate_work_school_form(patient: dict) -> dict:
    """Generate pre-filled work/school excuse form data."""
    return {
        "patient_name": patient["name"],
        "date_of_visit": str(patient.get("created_at", "")),
        "diagnosis": patient.get("primary_diagnoses", ""),
        "restrictions": "As discussed with your provider",
        "return_date": "Follow up with primary care within 3-5 days",
        "provider_signature": "[Electronic Signature Pending]",
    }
