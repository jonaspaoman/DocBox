from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class Demographics(BaseModel):
    name: str
    sex: Optional[str] = None
    dob: Optional[date] = None
    address: Optional[str] = None


class Triage(BaseModel):
    chief_complaint_summary: Optional[str] = None
    hpi_narrative: Optional[str] = None
    esi_score: Optional[int] = None
    time_admitted: Optional[datetime] = None


class DoctorNotes(BaseModel):
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None


class LabResult(BaseModel):
    test: str
    result: str
    is_surprising: bool
    arrives_at_tick: int


class Patient(BaseModel):
    pid: UUID
    name: str
    sex: Optional[str] = None
    age: Optional[int] = None
    dob: Optional[date] = None
    chief_complaint: Optional[str] = None
    hpi: Optional[str] = None
    pmh: Optional[str] = None
    family_social_history: Optional[str] = None
    review_of_systems: Optional[str] = None
    objective: Optional[str] = None
    primary_diagnoses: Optional[str] = None
    justification: Optional[str] = None
    plan: Optional[str] = None
    esi_score: Optional[int] = None
    triage_notes: Optional[str] = None
    color: str = "grey"
    status: str = "called_in"
    bed_number: Optional[int] = None
    is_simulated: bool = True
    version: int = 0
    lab_results: Optional[list[LabResult]] = None
    time_to_discharge: Optional[int] = None
    discharge_blocked_reason: Optional[str] = None
    discharge_papers: Optional[dict] = None
    entered_current_status_tick: int = 0


class SimState(BaseModel):
    current_tick: int
    speed_multiplier: float
    mode: str
    is_running: bool


class SpeedRequest(BaseModel):
    speed: float


class ModeRequest(BaseModel):
    mode: str


class BedAssignRequest(BaseModel):
    bed_number: int
