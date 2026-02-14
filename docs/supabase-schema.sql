-- DocBox Supabase Schema
-- Run this in Supabase SQL Editor to set up the database

-- Patients table
CREATE TABLE patients (
  pid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sex TEXT,
  age INT,
  dob DATE,
  chief_complaint TEXT,
  hpi TEXT,                          -- History of Present Illness
  pmh TEXT,                          -- Past Medical History
  family_social_history TEXT,
  review_of_systems TEXT,
  objective TEXT,                    -- Physical exam findings, vitals
  primary_diagnoses TEXT,
  justification TEXT,                -- Clinical reasoning
  plan TEXT,                         -- Treatment plan
  esi_score INT CHECK (esi_score BETWEEN 1 AND 5),
  triage_notes TEXT,
  color TEXT DEFAULT 'grey',         -- grey|yellow|green|red
  status TEXT DEFAULT 'called_in',   -- called_in|waiting_room|er_bed|or|discharge|icu|done
  bed_number INT,
  is_simulated BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 0,
  lab_results JSONB,                 -- [{test, result, is_surprising, arrives_at_tick}]
  time_to_discharge INT,             -- tick number when discharge-ready
  discharge_blocked_reason TEXT,
  discharge_papers JSONB,            -- {soap_note, avs, work_school_form}
  entered_current_status_tick INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simulation config (singleton row)
CREATE TABLE simulation_config (
  id INT PRIMARY KEY DEFAULT 1,
  current_tick INT DEFAULT 0,
  speed_multiplier FLOAT DEFAULT 1.0,
  mode TEXT DEFAULT 'manual',        -- manual|auto
  is_running BOOLEAN DEFAULT FALSE
);

-- Insert default simulation config
INSERT INTO simulation_config (id, current_tick, speed_multiplier, mode, is_running)
VALUES (1, 0, 1.0, 'manual', FALSE);

-- Index for common queries
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_color ON patients(color);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
