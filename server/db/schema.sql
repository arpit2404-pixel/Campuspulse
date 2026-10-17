-- CampusPulse database schema (PostgreSQL / Neon)
--
-- Safe to run more than once: every statement uses IF NOT EXISTS.
-- Run it with:  npm run db:setup      (or paste it into the Neon SQL Editor)
--
-- Vocabulary used in this project:
--   report  = one complaint submitted by one student
--   issue   = a group of similar reports about the same problem (a "recurring problem")

-- ---------------------------------------------------------------------------
-- issues: one row per distinct campus problem
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text NOT NULL,
  category    text NOT NULL CHECK (category IN (
                'Infrastructure', 'Electricity', 'Water', 'Cleanliness',
                'Internet', 'Classroom Equipment', 'Other')),
  building    text NOT NULL,
  room        text NOT NULL DEFAULT '',
  location    text NOT NULL,          -- "Building, Room" text shown in the UI
  status      text NOT NULL DEFAULT 'Pending'
                CHECK (status IN ('Pending', 'In Progress', 'Resolved')),
  urgency     text CHECK (urgency IN ('Low', 'Medium', 'High')),   -- optional
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS issues_status_idx   ON issues (status);
CREATE INDEX IF NOT EXISTS issues_category_idx ON issues (category);

-- ---------------------------------------------------------------------------
-- reports: every individual complaint (and every "+1 I have this too")
--
-- reporter_hash and ip_hash are keyed hashes (HMAC) made on the server. They let
-- us stop one device from counting twice without storing a name, email, phone
-- number or raw IP address. They are never sent to the browser.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no  text NOT NULL UNIQUE,
  issue_id      uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text NOT NULL,
  category      text NOT NULL,
  building      text NOT NULL,
  room          text NOT NULL DEFAULT '',
  location      text NOT NULL,
  urgency       text CHECK (urgency IN ('Low', 'Medium', 'High')),
  is_support    boolean NOT NULL DEFAULT false,   -- true for "+1 I have this too"
  reporter_hash text NOT NULL,
  ip_hash       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- One person can only count once per issue. The database enforces this, so it
  -- holds even if two requests arrive at the same moment.
  UNIQUE (issue_id, reporter_hash)
);

CREATE INDEX IF NOT EXISTS reports_created_idx  ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports (reporter_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_ip_idx       ON reports (ip_hash, created_at DESC);

-- ---------------------------------------------------------------------------
-- status_history: the public timeline shown on each issue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  notes       text NOT NULL,
  changed_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS status_history_issue_idx ON status_history (issue_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- admins and admin_sessions
--
-- Admin accounts are created with `npm run create-admin`. Only a salted scrypt
-- hash of the password is stored here. There are no default admin accounts.
-- Login sessions store only a hash of the session token, never the token itself.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'campus_officer'
                  CHECK (role IN ('superadmin', 'campus_officer')),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS admins_email_idx ON admins (lower(email));

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  admin_id   uuid NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions (expires_at);
