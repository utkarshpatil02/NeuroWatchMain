// Exercises the pure matching logic in faceRecognition.js.
// No models or images involved.
import { FACE, descriptorDistance, matchDescriptors } from './faceRecognition.js';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name.padEnd(46)} ${detail}`); }
  else { fail++; console.log(`FAIL  ${name.padEnd(46)} ${detail}`); }
};

const vec = (fill) => Array.from({ length: 128 }, () => fill);
// A descriptor a given euclidean distance away, spread over all 128 dims.
const offsetBy = (base, distance) => {
  const per = distance / Math.sqrt(128);
  return base.map((v) => v + per);
};

console.log('DISTANCE');
console.log('-'.repeat(72));
check('identical descriptors -> 0', descriptorDistance(vec(0.1), vec(0.1)) === 0);

const d = descriptorDistance(vec(0.1), offsetBy(vec(0.1), 0.5));
check('constructed distance is recovered', Math.abs(d - 0.5) < 1e-6, `got ${d.toFixed(6)}`);

check('order does not matter',
  descriptorDistance(vec(0.2), vec(0.9)) === descriptorDistance(vec(0.9), vec(0.2)));

console.log('\nMALFORMED INPUT -> null, never a number');
console.log('-'.repeat(72));
check('null reference', descriptorDistance(null, vec(0.1)) === null);
check('non-array', descriptorDistance('nope', vec(0.1)) === null);
check('length mismatch', descriptorDistance(vec(0.1), Array(64).fill(0.1)) === null);
check('empty arrays', descriptorDistance([], []) === null);
check('NaN inside', descriptorDistance(vec(0.1), [NaN, ...vec(0.1).slice(1)]) === null);
check('undefined inside', descriptorDistance(vec(0.1), [undefined, ...vec(0.1).slice(1)]) === null);

console.log('\nMATCH DECISION');
console.log('-'.repeat(72));
const ref = vec(0.1);

const clearlySame = matchDescriptors(ref, offsetBy(ref, FACE.matchThreshold - 0.2));
check('well inside threshold -> matched', clearlySame.matched === true, `distance=${clearlySame.distance.toFixed(3)} threshold=${FACE.matchThreshold}`);

const clearlyDifferent = matchDescriptors(ref, offsetBy(ref, FACE.matchThreshold + 0.4));
check('well outside threshold -> not matched', clearlyDifferent.matched === false, `distance=${clearlyDifferent.distance.toFixed(3)}`);

const exactlyAt = matchDescriptors(ref, offsetBy(ref, FACE.matchThreshold));
check('exactly at threshold -> matched (inclusive)', exactlyAt.matched === true, `distance=${exactlyAt.distance.toFixed(3)}`);

const justOver = matchDescriptors(ref, offsetBy(ref, FACE.matchThreshold + 0.001));
check('just over threshold -> not matched', justOver.matched === false, `distance=${justOver.distance.toFixed(4)}`);

console.log('\nUNKNOWN IS NOT A MISMATCH');
console.log('-'.repeat(72));
const noRef = matchDescriptors(null, vec(0.1));
check('missing reference -> matched null, not false', noRef.matched === null && noRef.distance === null,
  'a missing reference must never read as an impersonation');
const badCandidate = matchDescriptors(ref, 'garbage');
check('malformed candidate -> matched null, not false', badCandidate.matched === null);

console.log('\n' + '='.repeat(72));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
