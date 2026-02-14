"""Tests for discharge_api.py — Vapi webhook and discharge endpoints."""

import pytest
import pytest_asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from backend.discharge_api import router
from backend.tests.conftest import SAMPLE_PATIENT


@pytest.fixture
def app():
    app = FastAPI()
    app.include_router(router, prefix="/api")
    return app


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _mock_execute(data):
    result = MagicMock()
    result.data = data
    return result


# --- Vapi Webhook Tests ---

@pytest.mark.asyncio
async def test_vapi_webhook_creates_patient(client, mock_db, mock_broadcast):
    """Vapi function-call webhook creates a yellow patient."""
    inserted = {**SAMPLE_PATIENT, "pid": "new-pid", "color": "yellow", "is_simulated": False}
    mock_db.table.return_value.insert.return_value.execute.return_value = _mock_execute([inserted])

    payload = {
        "message": {
            "type": "function-call",
            "functionCall": {
                "name": "submit_triage",
                "parameters": {
                    "name": "Test Caller",
                    "sex": "M",
                    "age": 30,
                    "chief_complaint": "Headache",
                    "esi_score": 4,
                    "triage_notes": "30M with mild headache",
                },
            },
        }
    }

    res = await client.post("/api/vapi/webhook", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    # Verify DB insert was called
    mock_db.table.assert_called_with("patients")
    call_args = mock_db.table.return_value.insert.call_args[0][0]
    assert call_args["color"] == "yellow"
    assert call_args["is_simulated"] is False
    assert call_args["name"] == "Test Caller"

    # Verify broadcast
    mock_broadcast.assert_called_once()
    broadcast_msg = mock_broadcast.call_args[0][0]
    assert broadcast_msg["type"] == "patient_added"


@pytest.mark.asyncio
async def test_vapi_webhook_esi_1_2_flags_911(client, mock_db, mock_broadcast):
    """ESI 1-2 patients get 911 recommendation prepended to triage notes."""
    inserted = {**SAMPLE_PATIENT, "pid": "esi2-pid", "esi_score": 2}
    mock_db.table.return_value.insert.return_value.execute.return_value = _mock_execute([inserted])

    payload = {
        "message": {
            "type": "function-call",
            "functionCall": {
                "name": "submit_triage",
                "parameters": {
                    "name": "Critical Patient",
                    "chief_complaint": "Chest pain",
                    "esi_score": 2,
                    "triage_notes": "Severe chest pain",
                },
            },
        }
    }

    res = await client.post("/api/vapi/webhook", json=payload)
    assert res.status_code == 200

    call_args = mock_db.table.return_value.insert.call_args[0][0]
    assert "911 recommended (simulated)" in call_args["triage_notes"]
    assert "ESI 2" in call_args["triage_notes"]


@pytest.mark.asyncio
async def test_vapi_webhook_ignores_non_function_call(client):
    """Non-function-call messages return ignored."""
    res = await client.post("/api/vapi/webhook", json={"message": {"type": "other"}})
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"


# --- Discharge Pending Tests ---

@pytest.mark.asyncio
async def test_get_pending_discharges(client, mock_db):
    """Returns all green patients."""
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        _mock_execute([SAMPLE_PATIENT])
    )

    res = await client.get("/api/discharge/pending")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Jane Doe"


# --- Discharge Approve Tests ---

@pytest.mark.asyncio
async def test_approve_discharge(client, mock_db, mock_broadcast):
    """Approve generates paperwork and updates patient to discharge status."""
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        _mock_execute([SAMPLE_PATIENT])
    )
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = (
        _mock_execute([])
    )

    mock_papers = {"soap_note": "SOAP...", "avs": "AVS...", "work_school_form": {}}
    with patch("backend.discharge_api.generate_discharge_papers", new_callable=AsyncMock, return_value=mock_papers):
        res = await client.post("/api/discharge/test-pid-123/approve")

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"
    assert "soap_note" in data["papers"]


@pytest.mark.asyncio
async def test_approve_discharge_not_found(client, mock_db):
    """404 when patient doesn't exist."""
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        _mock_execute([])
    )

    res = await client.post("/api/discharge/nonexistent/approve")
    assert res.status_code == 404


# --- Discharge Dispute Tests ---

@pytest.mark.asyncio
async def test_dispute_discharge(client, mock_db, mock_broadcast):
    """Dispute resets color to grey and logs reason."""
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        _mock_execute([SAMPLE_PATIENT])
    )
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = (
        _mock_execute([])
    )

    res = await client.post(
        "/api/discharge/test-pid-123/dispute",
        json={"reason": "Waiting for troponin results"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "disputed"
    assert data["reason"] == "Waiting for troponin results"

    # Verify DB update includes blocked reason
    update_args = mock_db.table.return_value.update.call_args[0][0]
    assert update_args["color"] == "grey"
    assert update_args["discharge_blocked_reason"] == "Waiting for troponin results"


# --- Paperwork Endpoint Tests ---

@pytest.mark.asyncio
async def test_get_paperwork(client, mock_db):
    """Returns stored paperwork."""
    patient_with_papers = {
        **SAMPLE_PATIENT,
        "discharge_papers": {"soap_note": "Note", "avs": "Summary", "work_school_form": {}},
    }
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        _mock_execute([patient_with_papers])
    )

    res = await client.get("/api/discharge/test-pid-123/paperwork")
    assert res.status_code == 200
    assert "soap_note" in res.json()


@pytest.mark.asyncio
async def test_get_paperwork_not_generated(client, mock_db):
    """404 when paperwork hasn't been generated yet."""
    patient_no_papers = {**SAMPLE_PATIENT, "discharge_papers": None}
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        _mock_execute([patient_no_papers])
    )

    res = await client.get("/api/discharge/test-pid-123/paperwork")
    assert res.status_code == 404
