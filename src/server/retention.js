// Retention policy for proctoring evidence.
//
// Two different things are stored, and they do not deserve the same lifetime:
//
//   The record  - a proctor_logs row saying "tab_switch at 14:32". Not
//                 biometric, tiny, and the thing an integrity process actually
//                 relies on. Kept.
//   The evidence - webcam images and face descriptors. Personal data, and in
//                 many jurisdictions descriptors are a special category. Given
//                 the shortest lifetime their purpose allows.
//
// Descriptors have no purpose once a session ends: they exist only to compare
// against during the exam. They are deleted at submission, and swept by age
// afterwards because sessions frequently never reach 'completed' - a student
// who closes the tab leaves one 'active' forever.
//
// Screenshots are kept long enough to survive a grading cycle and an appeal,
// then removed while their log rows remain.
import { createClient } from '@supabase/supabase-js';

export const RETENTION = {
  screenshotDays: 30,
  // Sessions this old are treated as abandoned; their descriptor is purged
  // regardless of status.
  staleSessionDays: 2,
  bucket: 'proctor-screenshots',
  // Supabase caps a delete/list page; stay well under it.
  batchSize: 100,
};

export const cutoff = (days, now = Date.now()) =>
  new Date(now - days * 86400000).toISOString();

// Remove the reference face for one session. Called at submission, where it is
// the last thing the descriptor is needed for.
export const purgeSessionDescriptor = async (supabase, sessionRowId) => {
  const { error } = await supabase
    .from('exam_sessions')
    .update({ face_descriptor: null, face_enrolled_at: null })
    .eq('id', sessionRowId);

  // A missing column means migration 002 has not run; there is nothing to
  // purge, which is not a failure.
  if (error && /face_descriptor|face_enrolled_at/.test(error.message ?? '')) return false;
  if (error) throw error;
  return true;
};

// Descriptors belonging to sessions that ended, or that are old enough to be
// considered abandoned.
export const purgeStaleDescriptors = async (supabase, now = Date.now()) => {
  const { data, error } = await supabase
    .from('exam_sessions')
    .select('id, status, start_time')
    .not('face_descriptor', 'is', null)
    .limit(RETENTION.batchSize);

  if (error && /face_descriptor/.test(error.message ?? '')) return { purged: 0, skipped: 'migration 002 not applied' };
  if (error) throw error;

  const staleBefore = cutoff(RETENTION.staleSessionDays, now);
  const targets = (data ?? []).filter(
    (s) => s.status !== 'active' || (s.start_time && s.start_time < staleBefore)
  );
  if (!targets.length) return { purged: 0 };

  const { error: updateError } = await supabase
    .from('exam_sessions')
    .update({ face_descriptor: null, face_enrolled_at: null })
    .in('id', targets.map((t) => t.id));

  if (updateError) throw updateError;
  return { purged: targets.length };
};

// Screenshots past the retention window. The storage object goes first: if the
// row were cleared first and the delete then failed, the object would be
// orphaned with nothing left pointing at it.
export const purgeExpiredScreenshots = async (supabase, now = Date.now()) => {
  const before = cutoff(RETENTION.screenshotDays, now);

  const { data, error } = await supabase
    .from('proctor_logs')
    .select('id, screenshot_path, timestamp')
    .not('screenshot_path', 'is', null)
    .lt('timestamp', before)
    .limit(RETENTION.batchSize);

  if (error && /screenshot_path/.test(error.message ?? '')) return { purged: 0, skipped: 'migration 001 not applied' };
  if (error) throw error;
  if (!data?.length) return { purged: 0, failed: 0 };

  const { data: removed, error: removeError } = await supabase.storage
    .from(RETENTION.bucket)
    .remove(data.map((r) => r.screenshot_path));

  if (removeError) throw removeError;

  // Only clear rows whose object actually went. Anything that failed keeps its
  // path so the next sweep retries it, rather than leaking a file that nothing
  // references any more.
  const goneNames = new Set((removed ?? []).map((o) => o.name));
  const cleared = data.filter((r) => goneNames.has(r.screenshot_path));

  if (cleared.length) {
    const { error: updateError } = await supabase
      .from('proctor_logs')
      .update({ screenshot_path: null })
      .in('id', cleared.map((r) => r.id));
    if (updateError) throw updateError;
  }

  return { purged: cleared.length, failed: data.length - cleared.length };
};

// One full pass. Safe to call repeatedly; each run handles a bounded batch, so
// a large backlog drains over several runs rather than timing out.
export const runRetention = async (supabase, now = Date.now()) => {
  const screenshots = await purgeExpiredScreenshots(supabase, now);
  const descriptors = await purgeStaleDescriptors(supabase, now);
  return { screenshots, descriptors, ranAt: new Date(now).toISOString() };
};

// Entry point for `npm run retention`.
export const createSupabaseFromEnv = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
