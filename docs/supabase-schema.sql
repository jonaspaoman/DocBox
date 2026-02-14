-- DocBox Supabase Schema
-- Run this in Supabase SQL Editor to set up the database

-- Patients table
CREATE TABLE patients (
  pid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demographics JSONB NOT NULL,                -- {name, sex, dob, address}
  medical_history TEXT,                        -- paragraph of prior conditions
  ed_session JSONB,                            -- {triage, doctor_notes, labs, discharge_papers}
  color TEXT DEFAULT 'grey',                   -- grey|yellow|green|red
  status TEXT DEFAULT 'called_in',             -- called_in|waiting_room|er_bed|or|discharge|icu|done
  bed_number INT,
  is_simulated BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 0,
  time_to_discharge INT,                       -- tick number when discharge-ready
  discharge_blocked_reason TEXT,
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
