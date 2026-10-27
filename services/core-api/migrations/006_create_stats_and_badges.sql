-- Phase 14: Gamification, Donor Stats, Badges & Certificates

-- 1. Add certificate_no to donations
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS certificate_no TEXT UNIQUE;

-- 2. Add leaderboard opt-in and next_eligible_at to donor_profiles
ALTER TABLE donor_profiles
  ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS next_eligible_at DATE;

-- 3. Badges table
CREATE TABLE IF NOT EXISTS badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_code)
);

-- 4. Donor stats table
CREATE TABLE IF NOT EXISTS donor_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notified_count INT NOT NULL DEFAULT 0,
  accepted_count INT NOT NULL DEFAULT 0,
  donated_count INT NOT NULL DEFAULT 0,
  no_show_count INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  avg_response_seconds NUMERIC DEFAULT NULL,
  reliability_score NUMERIC NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id);
CREATE INDEX IF NOT EXISTS idx_donor_stats_donated ON donor_stats(donated_count DESC);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_leaderboard ON donor_profiles(show_on_leaderboard) WHERE show_on_leaderboard = TRUE;
