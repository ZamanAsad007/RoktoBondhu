-- Migration 012: Telegram Bot Integration & Links (Phase 21)

CREATE TABLE IF NOT EXISTS telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT UNIQUE,
  telegram_username TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  link_code VARCHAR(32) UNIQUE,
  code_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_links_user_id ON telegram_links(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_link_code ON telegram_links(link_code);
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON telegram_links(telegram_chat_id);
