"""Tests for paperwork.py — discharge paperwork generation with mocked GPT-4o."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from backend.paperwork import generate_discharge_papers, _generate_soap_note, _generate_avs, _generate_work_school_form
from backend.tests.conftest import SAMPLE_PATIENT


def _mock_openai_response(content: str):
    """Create a mock OpenAI chat completion response."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = content
    return mock_response


@pytest.mark.asyncio
async def test_generate_soap_note():
    """SOAP note generation calls GPT-4o and returns content."""
    soap_text = "S: 35F with RLQ pain...\nO: Vitals stable...\nA: Appendicitis\nP: Surgical consult"

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(soap_text)
    with patch("backend.paperwork._get_openai_client", return_value=mock_client):
        result = await _generate_soap_note(SAMPLE_PATIENT)

    assert result == soap_text
    mock_client.chat.completions.create.assert_called_once()
    call_kwargs = mock_client.chat.completions.create.call_args[1]
    assert call_kwargs["model"] == "gpt-4o"
    assert call_kwargs["temperature"] == 0.3


@pytest.mark.asyncio
async def test_generate_avs():
    """AVS generation calls GPT-4o with patient-friendly language prompt."""
    avs_text = "You came in today for abdominal pain. We found signs of appendicitis..."

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(avs_text)
    with patch("backend.paperwork._get_openai_client", return_value=mock_client):
        result = await _generate_avs(SAMPLE_PATIENT)

    assert result == avs_text
    call_kwargs = mock_client.chat.completions.create.call_args[1]
    assert call_kwargs["temperature"] == 0.4


@pytest.mark.asyncio
async def test_generate_work_school_form():
    """Work/school form is pre-filled from patient data (no GPT call)."""
    result = await _generate_work_school_form(SAMPLE_PATIENT)

    assert result["patient_name"] == "Jane Doe"
    assert result["diagnosis"] == "Acute appendicitis"
    assert "[Electronic Signature Pending]" in result["provider_signature"]


@pytest.mark.asyncio
async def test_generate_discharge_papers_full(mock_db):
    """Full paperwork generation produces all three documents and saves to DB."""
    soap = "SOAP note content"
    avs = "AVS content"

    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [
        _mock_openai_response(soap),
        _mock_openai_response(avs),
    ]
    with patch("backend.paperwork._get_openai_client", return_value=mock_client):
        result = await generate_discharge_papers(SAMPLE_PATIENT)

    assert "soap_note" in result
    assert "avs" in result
    assert "work_school_form" in result
    assert result["soap_note"] == soap
    assert result["avs"] == avs
    assert result["work_school_form"]["patient_name"] == "Jane Doe"

    # Verify DB was updated with papers
    mock_db.table.assert_called_with("patients")
    update_args = mock_db.table.return_value.update.call_args[0][0]
    assert "discharge_papers" in update_args


@pytest.mark.asyncio
async def test_paperwork_includes_lab_results():
    """Verify lab results are included in prompts sent to GPT-4o."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response("note")
    with patch("backend.paperwork._get_openai_client", return_value=mock_client):
        await _generate_soap_note(SAMPLE_PATIENT)

    prompt = mock_client.chat.completions.create.call_args[1]["messages"][0]["content"]
    assert "CBC" in prompt
    assert "WBC 14k" in prompt
