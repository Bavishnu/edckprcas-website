-- EDCKPRCAS online Content Manager schema for Cloudflare D1.
-- Run once in Cloudflare D1 > Console before deploying the online CMS.

CREATE TABLE IF NOT EXISTS cms_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_sessions_expiry ON cms_sessions(expires_at);

CREATE TABLE IF NOT EXISTS cms_login_attempts (
  ip_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  email_sent INTEGER NOT NULL DEFAULT 0,
  email_error TEXT,
  email_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_cms_inquiries_received ON cms_inquiries(received_at DESC);

CREATE TABLE IF NOT EXISTS cms_media_files (
  filename TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Files are split into 512 KiB BLOBs because Cloudflare D1 limits an individual
-- BLOB or row to 2,000,000 bytes. The complete free database is limited to 500 MB.
CREATE TABLE IF NOT EXISTS cms_media_chunks (
  filename TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (filename, chunk_index),
  FOREIGN KEY (filename) REFERENCES cms_media_files(filename) ON DELETE CASCADE
);


-- Lightweight per-IP enquiry throttling to limit form abuse and Resend quota use.
CREATE TABLE IF NOT EXISTS cms_contact_limits (
  ip_hash TEXT PRIMARY KEY,
  window_started INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
