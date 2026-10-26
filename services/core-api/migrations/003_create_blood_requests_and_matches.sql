-- Blood Requests Table
CREATE TABLE IF NOT EXISTS blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  units_needed INT NOT NULL CHECK (units_needed >= 1 AND units_needed <= 10),
  hospital_name TEXT NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  city TEXT,
  urgency TEXT NOT NULL CHECK (urgency IN ('NORMAL', 'URGENT', 'CRITICAL')),
  needed_by TIMESTAMPTZ NOT NULL,
  contact_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'EXPIRED', 'CANCELLED')),
  current_radius_km INT NOT NULL DEFAULT 5,
  wave_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Donor Request Matches
CREATE TABLE IF NOT EXISTS request_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOTIFIED' CHECK (status IN ('NOTIFIED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'DONATED', 'NO_SHOW', 'CANCELLED_BY_DONOR')),
  distance_km NUMERIC(6,2),
  wave_number INT NOT NULL DEFAULT 1,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(request_id, donor_id)
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Donations History Table
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES blood_requests(id) ON DELETE SET NULL,
  donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  donated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_by_requester BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial and Filtering Indexes
CREATE INDEX IF NOT EXISTS idx_blood_requests_location ON blood_requests USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status_expires ON blood_requests (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_blood_requests_requester ON blood_requests (requester_id);

CREATE INDEX IF NOT EXISTS idx_request_matches_request_status ON request_matches (request_id, status);
CREATE INDEX IF NOT EXISTS idx_request_matches_donor ON request_matches (donor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, entity_id);

CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations (donor_id);
