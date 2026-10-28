-- Phase 18: Trust, Reliability Score & Smarter Matching

-- 1. Add weekly availability windows to donor_profiles
ALTER TABLE donor_profiles
  ADD COLUMN IF NOT EXISTS availability_windows JSONB DEFAULT '[]'::jsonb;

-- 2. Add verification document and verified status to blood_requests
ALTER TABLE blood_requests
  ADD COLUMN IF NOT EXISTS verification_document_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_verified_request BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blood_requests_verified ON blood_requests(is_verified_request);
