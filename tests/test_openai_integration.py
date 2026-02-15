# """Integration tests for OpenAI API — verifies the key works and GPT-4o returns expected formats."""

# import os
# import json
# import pytest
# from openai import OpenAI


# @pytest.fixture
# def client():
#     api_key = os.environ.get("OPENAI_API_KEY")
#     assert api_key, "OPENAI_API_KEY environment variable must be set"
#     return OpenAI(api_key=api_key)


# SAMPLE_PATIENT = {
#     "pid": "00000000-0000-0000-0000-000000000001",
#     "name": "Jane Doe",
#     "age": 34,
#     "sex": "F",
#     "chief_complaint": "Chest pain, substernal, started 2 hours ago",
#     "hpi": "34yo F presents with acute substernal chest pain radiating to left arm. Onset 2 hours ago at rest. Denies prior episodes.",
#     "pmh": "Hypertension, hyperlipidemia",
#     "review_of_systems": "Positive for chest pain and mild dyspnea. Negative for fever, cough, nausea.",
#     "objective": "BP 142/88, HR 96, RR 18, SpO2 98%. Lungs CTA bilaterally. Heart RRR, no murmurs.",
#     "primary_diagnoses": "Acute chest pain, rule out ACS",
#     "plan": "Serial troponins, 12-lead ECG, aspirin 325mg, monitor on telemetry",
#     "lab_results": [
#         {"test": "Troponin I", "result": "0.02 ng/mL (normal)", "is_surprising": False, "arrives_at_tick": 5},
#         {"test": "CBC", "result": "WBC 7.2, Hgb 13.8, Plt 245", "is_surprising": False, "arrives_at_tick": 3},
#         {"test": "BMP", "result": "Na 140, K 4.1, Cr 0.9, Gluc 102", "is_surprising": False, "arrives_at_tick": 3},
#     ],
#     "version": 1,
# }


# def test_openai_api_key_valid(client):
#     """Verify the API key is valid by listing models."""
#     models = client.models.list()
#     model_ids = [m.id for m in models.data]
#     assert "gpt-4o" in model_ids, "gpt-4o model not available for this API key"


# def test_discharge_evaluation_format(client):
#     """Test that GPT-4o returns valid JSON in the expected discharge format."""
#     prompt = f"""You are an ER discharge assessment AI. Based on the patient data below, determine if this patient is ready for discharge.

# Patient: {SAMPLE_PATIENT['name']}, {SAMPLE_PATIENT['age']}yo {SAMPLE_PATIENT['sex']}
# Chief Complaint: {SAMPLE_PATIENT['chief_complaint']}
# HPI: {SAMPLE_PATIENT['hpi']}
# PMH: {SAMPLE_PATIENT['pmh']}
# Diagnoses: {SAMPLE_PATIENT['primary_diagnoses']}
# Plan: {SAMPLE_PATIENT['plan']}

# Lab Results:
# {json.dumps(SAMPLE_PATIENT['lab_results'], indent=2)}

# Respond in JSON:
# {{
#   "ready": true/false,
#   "reasoning": "1-2 sentence explanation",
#   "time_to_discharge_minutes": <estimated minutes from now, 0 if ready now>,
#   "summary": "2-3 sentence discharge summary for doctor notification"
# }}"""

#     response = client.chat.completions.create(
#         model="gpt-4o",
#         messages=[{"role": "user", "content": prompt}],
#         response_format={"type": "json_object"},
#         temperature=0.3,
#     )

#     content = response.choices[0].message.content
#     print(content)
#     result = json.loads(content)

#     assert "ready" in result, "Missing 'ready' field"
#     assert "reasoning" in result, "Missing 'reasoning' field"
#     assert "time_to_discharge_minutes" in result, "Missing 'time_to_discharge_minutes' field"
#     assert "summary" in result, "Missing 'summary' field"
#     assert isinstance(result["ready"], bool), "'ready' should be a boolean"
#     assert isinstance(result["reasoning"], str), "'reasoning' should be a string"


# def test_soap_note_generation(client):
#     """Test that GPT-4o generates a SOAP note with all four sections."""
#     prompt = f"""Generate an ED SOAP note for this patient. Use standard ED SOAP format:
# - Subjective (chief complaint, HPI, PMH, ROS, medications, allergies)
# - Objective (vitals, physical exam)
# - Assessment (diagnoses with reasoning)
# - Plan (treatment provided, disposition, follow-up)

# Patient Data:
# Name: {SAMPLE_PATIENT['name']}
# Age/Sex: {SAMPLE_PATIENT['age']} {SAMPLE_PATIENT['sex']}
# Chief Complaint: {SAMPLE_PATIENT['chief_complaint']}
# HPI: {SAMPLE_PATIENT['hpi']}
# PMH: {SAMPLE_PATIENT['pmh']}
# Review of Systems: {SAMPLE_PATIENT['review_of_systems']}
# Objective/Exam: {SAMPLE_PATIENT['objective']}
# Diagnoses: {SAMPLE_PATIENT['primary_diagnoses']}
# Plan: {SAMPLE_PATIENT['plan']}
# Lab Results: {json.dumps(SAMPLE_PATIENT['lab_results'])}

# Write a professional, concise SOAP note as would appear in an EMR."""

#     response = client.chat.completions.create(
#         model="gpt-4o",
#         messages=[{"role": "user", "content": prompt}],
#         temperature=0.3,
#     )

#     note = response.choices[0].message.content
#     assert len(note) > 100, "SOAP note seems too short"
#     note_lower = note.lower()
#     assert "subjective" in note_lower or "s:" in note_lower, "Missing Subjective section"
#     assert "objective" in note_lower or "o:" in note_lower, "Missing Objective section"
#     assert "assessment" in note_lower or "a:" in note_lower, "Missing Assessment section"
#     assert "plan" in note_lower or "p:" in note_lower, "Missing Plan section"


# def test_avs_generation(client):
#     """Test that GPT-4o generates a patient-friendly After Visit Summary."""
#     prompt = f"""Generate an After Visit Summary (AVS) for this ER patient. The AVS should be written in patient-friendly language and include:
# - What brought you in today
# - What we found
# - What we did
# - Discharge instructions (medications, activity restrictions, warning signs to return)
# - Follow-up recommendations

# Patient: {SAMPLE_PATIENT['name']}, {SAMPLE_PATIENT['age']} {SAMPLE_PATIENT['sex']}
# Diagnosis: {SAMPLE_PATIENT['primary_diagnoses']}
# Plan: {SAMPLE_PATIENT['plan']}
# Labs: {json.dumps(SAMPLE_PATIENT['lab_results'])}

# Keep it clear, warm, and under 300 words."""

#     response = client.chat.completions.create(
#         model="gpt-4o",
#         messages=[{"role": "user", "content": prompt}],
#         temperature=0.4,
#     )

#     avs = response.choices[0].message.content
#     assert len(avs) > 50, "AVS seems too short"
#     # Should be patient-friendly, not overly technical
#     assert "follow" in avs.lower() or "return" in avs.lower(), "AVS should mention follow-up or return instructions"


