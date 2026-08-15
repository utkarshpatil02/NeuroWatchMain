// Manual retention run: `npm run retention`
//
// The server also sweeps on a timer, so this exists for running the policy
// on demand, or from cron if you would rather not rely on the server process
// staying up.
//
// Pass --dry-run to report what would be removed without removing it.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { RETENTION, cutoff, runRetention, createSupabaseFromEnv } from './retention.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const dryRun = process.argv.includes('--dry-run');
const supabase = createSupabaseFromEnv();

console.log('RETENTION POLICY');
console.log('-'.repeat(60));
console.log(`  screenshots kept  ${RETENTION.screenshotDays} days`);
console.log(`  descriptors kept  until the session ends, or ${RETENTION.staleSessionDays} days if abandoned`);
console.log(`  log rows          kept indefinitely (not biometric)`);
console.log(`  mode              ${dryRun ? 'DRY RUN - nothing will be removed' : 'live'}`);

if (dryRun) {
  const before = cutoff(RETENTION.screenshotDays);
  const { count: shots, error: e1 } = await supabase
    .from('proctor_logs').select('id', { count: 'exact', head: true })
    .not('screenshot_path', 'is', null).lt('timestamp', before);

  const staleBefore = cutoff(RETENTION.staleSessionDays);
  const { data: sessions, error: e2 } = await supabase
    .from('exam_sessions').select('id, status, start_time').not('face_descriptor', 'is', null);
  const descriptors = (sessions ?? []).filter(
    (s) => s.status !== 'active' || (s.start_time && s.start_time < staleBefore)
  ).length;

  console.log('\nWOULD REMOVE');
  console.log('-'.repeat(60));
  console.log(`  screenshots older than ${before.slice(0, 10)}   ${e1 ? 'n/a (' + e1.message + ')' : shots}`);
  console.log(`  descriptors on ended/abandoned sessions   ${e2 ? 'n/a (' + e2.message + ')' : descriptors}`);
  process.exit(0);
}

const result = await runRetention(supabase);

console.log('\nREMOVED');
console.log('-'.repeat(60));
console.log(`  screenshots   ${result.screenshots.purged}${result.screenshots.failed ? `  (${result.screenshots.failed} failed, will retry next run)` : ''}${result.screenshots.skipped ? `  skipped: ${result.screenshots.skipped}` : ''}`);
console.log(`  descriptors   ${result.descriptors.purged}${result.descriptors.skipped ? `  skipped: ${result.descriptors.skipped}` : ''}`);

// A full batch probably means there is more waiting.
if (result.screenshots.purged >= RETENTION.batchSize) {
  console.log('\n  batch was full - run again to continue draining the backlog');
}
