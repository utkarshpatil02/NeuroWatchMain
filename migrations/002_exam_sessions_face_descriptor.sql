-- Adds the per-session reference face for continuity checking.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- Safe to run more than once; the columns are nullable, so the 55 existing
-- sessions stay valid and simply carry NULL.
--
-- What is stored is a 128-float descriptor derived from one webcam frame at
-- the start of the session, not the image itself. It cannot be turned back
-- into a photograph, but it is still biometric data: it identifies a person
-- across images. Treat it accordingly, and delete it when the session's
-- retention period ends.

ALTER TABLE exam_sessions
  -- 128-element JSON array from face-api.js. NULL until the student enrols,
  -- and NULL forever if enrolment never succeeded.
  ADD COLUMN IF NOT EXISTS face_descriptor JSONB,

  -- When the reference was captured, so a stale or missing enrolment is
  -- visible rather than silently absent.
  ADD COLUMN IF NOT EXISTS face_enrolled_at TIMESTAMP WITH TIME ZONE;
