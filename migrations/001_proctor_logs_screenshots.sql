-- Adds screenshot storage to proctoring logs.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- Safe to run more than once; both columns are nullable, so the 241 existing
-- rows stay valid and simply carry NULL.
--
-- Images themselves live in the private "proctor-screenshots" storage bucket.
-- Only the object path is stored here, so the table stays small and access is
-- controlled by short-lived signed URLs rather than by row contents.

ALTER TABLE proctor_logs
  -- Path within the proctor-screenshots bucket, e.g.
  -- "3f2a.../1754500000000-multiple_faces.jpg". NULL when no image was captured.
  ADD COLUMN IF NOT EXISTS screenshot_path TEXT,

  -- Structured context the client already sends but the server previously
  -- discarded (face counts, warning text, and similar). Optional: drop this
  -- line if you only want screenshots.
  ADD COLUMN IF NOT EXISTS details JSONB;

-- Proctor dashboards read a session's log newest-first; this keeps that cheap
-- as the table grows.
CREATE INDEX IF NOT EXISTS proctor_logs_session_time_idx
  ON proctor_logs (session_id, timestamp DESC);
