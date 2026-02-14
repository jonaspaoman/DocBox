"""Shared test fixtures — mock DB, WebSocket manager, and OpenAI client."""

import sys
from unittest.mock import MagicMock, AsyncMock, patch
import pytest
import pytest_asyncio


def make_mock_db():
    """Create a chainable mock that simulates Supabase's query builder pattern."""
    mock_db = MagicMock()

    mock_table = MagicMock()
    mock_db.table.return_value = mock_table

    mock_select = MagicMock()
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_select

    mock_insert = MagicMock()
    mock_table.insert.return_value = mock_insert

    mock_update = MagicMock()
    mock_table.update.return_value = mock_update
    mock_update.eq.return_value = mock_update

    return mock_db


@pytest.fixture
def mock_db():
    """Patch get_db everywhere it's imported."""
    db = make_mock_db()
    with patch("backend.discharge_api.get_db", return_value=db), \
         patch("backend.discharge_agent.get_db", return_value=db), \
         patch("backend.paperwork.get_db", return_value=db):
        yield db


@pytest.fixture
def mock_broadcast():
    """Patch manager.broadcast everywhere it's imported."""
    mock = AsyncMock()
    with patch("backend.discharge_api.manager") as api_mgr, \
         patch("backend.discharge_agent.manager") as agent_mgr:
        api_mgr.broadcast = mock
        agent_mgr.broadcast = mock
        yield mock


SAMPLE_PATIENT = {
    "pid": "test-pid-123",
    "name": "Jane Doe",
    "sex": "F",
    "age": 35,
    "chief_complaint": "Abdominal pain",
    "hpi": "35F with 6hr history of RLQ abdominal pain, 6/10 severity",
    "pmh": "None",
    "review_of_systems": "Positive for nausea, negative for fever",
    "objective": "Vitals stable, RLQ tenderness",
    "primary_diagnoses": "Acute appendicitis",
    "plan": "Surgical consult, IV antibiotics",
    "esi_score": 3,
    "triage_notes": "35F RLQ pain, possible appendicitis",
    "color": "green",
    "status": "er_bed",
    "bed_number": 5,
    "is_simulated": False,
    "version": 2,
    "lab_results": [
        {"test": "CBC", "result": "WBC 14k", "is_surprising": False, "arrives_at_tick": 5},
        {"test": "CRP", "result": "Elevated", "is_surprising": False, "arrives_at_tick": 5},
    ],
    "time_to_discharge": None,
    "discharge_blocked_reason": None,
    "discharge_papers": None,
    "created_at": "2026-02-14T10:00:00Z",
}
