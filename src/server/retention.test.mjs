// Retention logic against a stubbed Supabase client. No network, no database.
import { RETENTION, cutoff, purgeExpiredScreenshots, purgeStaleDescriptors } from './retention.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => {
  if (ok) { pass++; console.log(`PASS  ${n.padEnd(52)} ${d}`); }
  else { fail++; console.log(`FAIL  ${n.padEnd(52)} ${d}`); }
};

const NOW = Date.parse('2026-08-15T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

// Minimal stub recording what it was asked to do.
const makeSupabase = ({ logs = [], sessions = [], removeResult = null, removeError = null }) => {
  const calls = { removed: [], clearedIds: [], nulledSessionIds: [] };

  const table = (name) => {
    const state = { name, filters: [], _lt: null };
    const api = {
      select: () => api,
      not: () => api,
      lt: (_c, v) => { state._lt = v; return api; },
      in: (_c, v) => { state.inIds = v; return api; },
      eq: () => api,
      limit: () => api,
      update: (patch) => {
        state.patch = patch;
        return {
          in: (_c, ids) => {
            if (name === 'proctor_logs') calls.clearedIds.push(...ids);
            else calls.nulledSessionIds.push(...ids);
            return Promise.resolve({ error: null });
          },
          eq: () => Promise.resolve({ error: null }),
        };
      },
      then: (resolve) => {
        if (name === 'proctor_logs') {
          const rows = logs.filter((r) => (state._lt ? r.timestamp < state._lt : true));
          return resolve({ data: rows, error: null });
        }
        return resolve({ data: sessions, error: null });
      },
    };
    return api;
  };

  return {
    calls,
    from: table,
    storage: {
      from: () => ({
        remove: async (paths) => {
          calls.removed.push(...paths);
          if (removeError) return { data: null, error: removeError };
          const result = removeResult ?? paths.map((p) => ({ name: p }));
          return { data: result, error: null };
        },
      }),
    },
  };
};

console.log('CUTOFF');
console.log('-'.repeat(72));
check('cutoff is the expected number of days back',
  cutoff(30, NOW).slice(0, 10) === '2026-07-16', cutoff(30, NOW).slice(0, 10));
check('zero days is now', cutoff(0, NOW) === new Date(NOW).toISOString());

console.log('\nSCREENSHOT EXPIRY');
console.log('-'.repeat(72));
const logs = [
  { id: 'a', screenshot_path: 's1/old.jpg', timestamp: daysAgo(40) },
  { id: 'b', screenshot_path: 's1/older.jpg', timestamp: daysAgo(90) },
];
const sb1 = makeSupabase({ logs });
const r1 = await purgeExpiredScreenshots(sb1, NOW);
check('expired screenshots removed from storage', sb1.calls.removed.length === 2, sb1.calls.removed.join(', '));
check('their rows are cleared', sb1.calls.clearedIds.length === 2 && r1.purged === 2);
check('log rows themselves are NOT deleted', !('deletedRows' in r1),
  'the record that an event happened must survive the image');

const sb2 = makeSupabase({ logs: [] });
const r2 = await purgeExpiredScreenshots(sb2, NOW);
check('nothing expired -> no storage calls', sb2.calls.removed.length === 0 && r2.purged === 0);

console.log('\nPARTIAL STORAGE FAILURE');
console.log('-'.repeat(72));
// Only the first object actually goes.
const sb3 = makeSupabase({ logs, removeResult: [{ name: 's1/old.jpg' }] });
const r3 = await purgeExpiredScreenshots(sb3, NOW);
check('only successfully removed rows are cleared', r3.purged === 1 && r3.failed === 1, `purged=${r3.purged} failed=${r3.failed}`);
check('the failed one keeps its path for a retry', !sb3.calls.clearedIds.includes('b'),
  'clearing it would orphan a file nothing points at');

console.log('\nDESCRIPTOR EXPIRY');
console.log('-'.repeat(72));
const sessions = [
  { id: 'done', status: 'completed', start_time: daysAgo(1) },
  { id: 'abandoned', status: 'active', start_time: daysAgo(30) },
  { id: 'live', status: 'active', start_time: daysAgo(0.01) },
];
const sb4 = makeSupabase({ sessions });
const r4 = await purgeStaleDescriptors(sb4, NOW);
check('completed session descriptor purged', sb4.calls.nulledSessionIds.includes('done'));
check('abandoned active session purged too', sb4.calls.nulledSessionIds.includes('abandoned'),
  `${RETENTION.staleSessionDays}d threshold catches sessions that never complete`);
check('IN-PROGRESS session is left alone', !sb4.calls.nulledSessionIds.includes('live'),
  'purging a live session would break its own verification');
check('purged count matches', r4.purged === 2, `purged=${r4.purged}`);

console.log('\n' + '='.repeat(72));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
