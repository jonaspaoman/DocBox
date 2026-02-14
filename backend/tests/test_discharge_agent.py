"""Tests for discharge_agent.py — discharge evaluation logic with mocked GPT-4o."""

import json
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from backend.discharge_agent import evaluate_discharge, check_blocked_resolution
from backend.tests.conftest import SAMPLE_PATIENT


def _mock_openai_response(content: dict):
    """Create a mock OpenAI chat completion response."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps(content)
    return mock_response


@pytest.mark.asyncio
async def test_evaluate_discharge_ready(mock_db, mock_broadcast):
    """Patient with all labs arrived and GPT says ready -> flags green."""
    patient = {**SAMPLE_PATIENT, "version": 2}
    current_tick = 10

    gpt_result = {
        "ready": True,
        "reasoning": "Labs stable, pain controlled.",
        "time_to_discharge_minutes": 0,
        "summary": "Patient stable with resolved symptoms. Safe for discharge.",
    }

    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(gpt_result)
    with patch("backend.discharge_agent._get_openai_client", return_value=mock_client):
        result = await evaluate_discharge(patient, current_tick)

    assert result is not None
    assert result["ready"] is True
    assert result["summary"] == gpt_result["summary"]

    # Verify DB was updated to green
    update_args = mock_db.table.return_value.update.call_args[0][0]
    assert update_args["color"] == "green"
    assert update_args["time_to_discharge"] == current_tick
    assert update_args["version"] == 3

    # Verify two broadcasts: patient_update + discharge_ready
    assert mock_broadcast.call_count == 2
    calls = [c[0][0] for c in mock_broadcast.call_args_list]
    assert calls[0]["type"] == "patient_update"
    assert calls[1]["type"] == "discharge_ready"


@pytest.mark.asyncio
async def test_evaluate_discharge_not_ready(mock_db, mock_broadcast):
    """GPT says not ready -> returns None, no DB or broadcast changes."""
    patient = {**SAMPLE_PATIENT, "version": 2}
    current_tick = 10

    gpt_result = {
        "ready": False,
        "reasoning": "Elevated WBC needs monitoring.",
        "time_to_discharge_minutes": 120,
        "summary": "Patient needs continued observation.",
    }

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(gpt_result)
    with patch("backend.discharge_agent._get_openai_client", return_value=mock_client):
        result = await evaluate_discharge(patient, current_tick)

    assert result is None
    mock_broadcast.assert_not_called()


@pytest.mark.asyncio
async def test_evaluate_discharge_pending_labs():
    """Returns None if labs haven't arrived yet."""
    patient = {
        **SAMPLE_PATIENT,
        "lab_results": [
            {"test": "Troponin", "result": "pending", "is_surprising": False, "arrives_at_tick": 15}
        ],
    }

    result = await evaluate_discharge(patient, current_tick=10)
    assert result is None


@pytest.mark.asyncio
async def test_evaluate_discharge_blocked():
    """Returns None if discharge is blocked by doctor dispute."""
    patient = {**SAMPLE_PATIENT, "discharge_blocked_reason": "Waiting for repeat troponin"}

    result = await evaluate_discharge(patient, current_tick=10)
    assert result is None


@pytest.mark.asyncio
async def test_evaluate_discharge_no_labs(mock_db, mock_broadcast):
    """Patient with no labs still gets evaluated."""
    patient = {**SAMPLE_PATIENT, "lab_results": None, "version": 1}

    gpt_result = {
        "ready": True,
        "reasoning": "Simple case, no labs needed.",
        "time_to_discharge_minutes": 0,
        "summary": "Patient stable for discharge.",
    }

    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(gpt_result)
    with patch("backend.discharge_agent._get_openai_client", return_value=mock_client):
        result = await evaluate_discharge(patient, current_tick=10)

    assert result is not None
    assert result["ready"] is True


@pytest.mark.asyncio
async def test_check_blocked_resolution(mock_db, mock_broadcast):
    """Clears block and re-evaluates patient."""
    patient = {**SAMPLE_PATIENT, "discharge_blocked_reason": "Waiting for labs", "version": 2}

    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    gpt_result = {
        "ready": True,
        "reasoning": "Condition resolved.",
        "time_to_discharge_minutes": 0,
        "summary": "Ready for discharge.",
    }

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(gpt_result)
    with patch("backend.discharge_agent._get_openai_client", return_value=mock_client):
        await check_blocked_resolution(patient, current_tick=20)

    # Should have cleared the block first, then re-evaluated
    assert mock_db.table.return_value.update.call_count >= 2


@pytest.mark.asyncio
async def test_check_blocked_resolution_no_block():
    """Does nothing if patient isn't blocked."""
    patient = {**SAMPLE_PATIENT, "discharge_blocked_reason": None}
    await check_blocked_resolution(patient, current_tick=10)
