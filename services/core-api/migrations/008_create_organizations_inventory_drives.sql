-- Phase 17: Organizations, Blood Bank Inventory & Drives

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  org_name TEXT NOT NULL,
  registration_number TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  location GEOGRAPHY(POINT, 4326),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_location ON organizations USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_organizations_user_id ON organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_verified ON organizations(is_verified);

CREATE TABLE IF NOT EXISTS blood_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  units_available INT NOT NULL DEFAULT 0 CHECK (units_available >= 0),
  low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, blood_group)
);

CREATE INDEX IF NOT EXISTS idx_blood_inventory_org ON blood_inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_group ON blood_inventory(blood_group);

CREATE TABLE IF NOT EXISTS blood_drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  venue_name TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  rsvp_count INT NOT NULL DEFAULT 0 CHECK (rsvp_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_drives_location ON blood_drives USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_blood_drives_org ON blood_drives(organization_id);
CREATE INDEX IF NOT EXISTS idx_blood_drives_status ON blood_drives(status);
CREATE INDEX IF NOT EXISTS idx_blood_drives_start_time ON blood_drives(start_time);

CREATE TABLE IF NOT EXISTS blood_drive_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id UUID NOT NULL REFERENCES blood_drives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'ATTENDED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (drive_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_blood_drive_rsvps_drive ON blood_drive_rsvps(drive_id);
CREATE INDEX IF NOT EXISTS idx_blood_drive_rsvps_user ON blood_drive_rsvps(user_id);

ALTER TABLE donations ADD COLUMN IF NOT EXISTS drive_id UUID REFERENCES blood_drives(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_donations_drive_id ON donations(drive_id);

