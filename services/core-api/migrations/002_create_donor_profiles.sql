-- Donor Profiles with PostGIS Geography Point
CREATE TABLE IF NOT EXISTS donor_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  date_of_birth DATE NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  city TEXT NOT NULL,
  last_donated_at DATE NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial GiST index for fast radius / nearest neighbor queries
CREATE INDEX IF NOT EXISTS idx_donor_profiles_location ON donor_profiles USING GIST (location);

-- Composite index for filtering available donors by blood group
CREATE INDEX IF NOT EXISTS idx_donor_profiles_blood_available ON donor_profiles (blood_group, available);
