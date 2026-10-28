-- Phase 19: In-App Masked Chat & Privacy Controls

-- 1. Add "chat first, share phone later" privacy preference to donor_profiles
ALTER TABLE donor_profiles
  ADD COLUMN IF NOT EXISTS chat_first_share_phone_later BOOLEAN DEFAULT TRUE;

-- 2. Chat threads table created upon match acceptance
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES request_matches(id) ON DELETE CASCADE UNIQUE,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  phone_shared_by_donor BOOLEAN NOT NULL DEFAULT FALSE,
  phone_shared_by_requester BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ NULL,
  closed_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_request ON chat_threads(request_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_match ON chat_threads(match_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_requester ON chat_threads(requester_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_donor ON chat_threads(donor_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);

-- 3. Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON chat_messages(thread_id, created_at ASC);

-- 4. Chat block / report table
CREATE TABLE IF NOT EXISTS chat_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  blocked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thread_id, blocked_by)
);

CREATE INDEX IF NOT EXISTS idx_chat_blocks_thread ON chat_blocks(thread_id);
