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


class DischargePapers(BaseModel):
    disposition: Optional[str] = None
    diagnosis: Optional[str] = None
    discharge_justification: Optional[str] = None
    admitting_attending: Optional[str] = None
    follow_up: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    warning_instructions: Optional[str] = None
    soap_note: Optional[str] = None
    avs: Optional[str] = None
    work_school_form: Optional[str] = None


class EDSession(BaseModel):
    triage: Optional[Triage] = None
    doctor_notes: Optional[DoctorNotes] = None
    labs: Optional[list[LabResult]] = None
    discharge_papers: Optional[DischargePapers] = None


class Patient(BaseModel):
    pid: UUID
    demographics: Demographics
    medical_history: Optional[str] = None
    ed_session: Optional[EDSession] = None
    color: str = "grey"
    status: str = "called_in"
    bed_number: Optional[int] = None
    is_simulated: bool = True
    version: int = 0
    time_to_discharge: Optional[int] = None
    discharge_blocked_reason: Optional[str] = None
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
