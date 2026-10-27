-- Phase 15: Shareable Emergency Pages & SOS Escalation

-- 1. Add share_token, is_sos, and escalated_at columns to blood_requests
ALTER TABLE blood_requests
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_sos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ NULL;

-- 2. Populate share_token for existing rows that do not have one
UPDATE blood_requests
SET share_token = SUBSTRING(md5(id::text || random()::text || clock_timestamp()::text) FROM 1 FOR 12)
WHERE share_token IS NULL;

-- 3. Create index for fast lookup by share token
CREATE INDEX IF NOT EXISTS idx_blood_requests_share_token ON blood_requests(share_token);
CREATE INDEX IF NOT EXISTS idx_blood_requests_is_sos ON blood_requests(is_sos) WHERE is_sos = TRUE;
