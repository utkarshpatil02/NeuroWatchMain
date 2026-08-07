// Exercises the real gaze functions from src/utils/gaze.js.
import {
  GAZE, CALIBRATION, headYaw, pupilOffset, estimateGaze, gazeReading,
  suggestThreshold, median, mad, buildBaseline, estimateGazeWithBaseline,
} from './gaze.js';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name.padEnd(46)} ${detail}`); }
  else { fail++; console.log(`FAIL  ${name.padEnd(46)} ${detail}`); }
};

// --- landmark stub ---------------------------------------------------------
// jaw spans x=0..100; noseX places the nose tip between the edges.
const makeLandmarks = (noseX, leftEye = [], rightEye = []) => ({
  getJawOutline: () => [{ x: 0, y: 50 }, { x: 100, y: 50 }],
  getNose: () => [{ x: noseX, y: 40 }, { x: noseX, y: 55 }],
  getLeftEye: () => leftEye,
  getRightEye: () => rightEye,
});

const eyeBox = (x0, y0, w = 20, h = 10) => ([
  { x: x0, y: y0 + h / 2 }, { x: x0 + w * 0.25, y: y0 },
  { x: x0 + w * 0.75, y: y0 }, { x: x0 + w, y: y0 + h / 2 },
  { x: x0 + w * 0.75, y: y0 + h }, { x: x0 + w * 0.25, y: y0 + h },
]);

// Canvas stub: a light field with a dark blob at a chosen fraction of width.
const makeCtx = (blobFrac, { flat = false } = {}) => ({
  getImageData: (sx, sy, w, h) => {
    const data = new Uint8ClampedArray(w * h * 4);
    const blobX = Math.round(blobFrac * w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dark = !flat && Math.abs(x - blobX) <= Math.max(1, w * 0.12);
        const v = flat ? 200 : (dark ? 20 : 210);
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    return { data, width: w, height: h };
  },
});

console.log('HEAD YAW');
console.log('-'.repeat(72));
check('nose centred -> ~0', Math.abs(headYaw(makeLandmarks(50))) < 0.01, `yaw=${headYaw(makeLandmarks(50)).toFixed(3)}`);
check('nose left  -> negative', headYaw(makeLandmarks(20)) < -GAZE.yawTolerance, `yaw=${headYaw(makeLandmarks(20)).toFixed(3)}`);
check('nose right -> positive', headYaw(makeLandmarks(80)) > GAZE.yawTolerance, `yaw=${headYaw(makeLandmarks(80)).toFixed(3)}`);
check('slight turn stays under tolerance', Math.abs(headYaw(makeLandmarks(55))) < GAZE.yawTolerance, `yaw=${headYaw(makeLandmarks(55)).toFixed(3)}`);
check('degenerate jaw does not throw', headYaw({ getJawOutline: () => [], getNose: () => [] }) === 0);

console.log('\nPUPIL OFFSET');
console.log('-'.repeat(72));
const eye = eyeBox(10, 10);
const centred = pupilOffset(makeCtx(0.5), eye);
const leftward = pupilOffset(makeCtx(0.15), eye);
const rightward = pupilOffset(makeCtx(0.85), eye);
check('pupil centred -> near 0', Math.abs(centred) < 0.05, `offset=${centred.toFixed(3)}`);
check('pupil left  -> negative', leftward < -GAZE.pupilTolerance, `offset=${leftward.toFixed(3)}`);
check('pupil right -> positive', rightward > GAZE.pupilTolerance, `offset=${rightward.toFixed(3)}`);
check('flat/unreadable region -> null', pupilOffset(makeCtx(0.5, { flat: true }), eye) === null);
check('eye region too small -> null', pupilOffset(makeCtx(0.5), eyeBox(0, 0, 3, 2)) === null);
check('no eye points -> null', pupilOffset(makeCtx(0.5), []) === null);
check('getImageData throwing -> null', pupilOffset({ getImageData: () => { throw new Error('tainted'); } }, eye) === null);

console.log('\nCOMBINED VERDICT');
console.log('-'.repeat(72));
const eyesFwd = makeLandmarks(50, eyeBox(10, 10), eyeBox(40, 10));
check('facing forward, pupils centred -> normal', estimateGaze(eyesFwd, makeCtx(0.5)) === 'normal');
check('head turned -> suspicious', estimateGaze(makeLandmarks(20, eyeBox(10, 10), eyeBox(40, 10)), makeCtx(0.5)) === 'suspicious');
check('head straight, pupils sideways -> suspicious', estimateGaze(eyesFwd, makeCtx(0.9)) === 'suspicious');
check('eyes unreadable -> null (no claim)', estimateGaze(eyesFwd, makeCtx(0.5, { flat: true })) === null);
check('no canvas -> falls back to yaw only', estimateGaze(eyesFwd, null) === 'normal');

console.log('\nRAW READINGS');
console.log('-'.repeat(72));
const r1 = gazeReading(eyesFwd, makeCtx(0.5));
check('reading exposes yaw + pupil', Number.isFinite(r1.yaw) && Number.isFinite(r1.pupil), `yaw=${r1.yaw.toFixed(3)} pupil=${r1.pupil.toFixed(3)}`);
const r2 = gazeReading(eyesFwd, makeCtx(0.5, { flat: true }));
check('unreadable eyes -> pupil null', r2.pupil === null);
const r3 = gazeReading(eyesFwd, null);
check('no canvas -> pupil null, yaw still read', r3.pupil === null && Number.isFinite(r3.yaw));

console.log('\nTHRESHOLD SUGGESTION');
console.log('-'.repeat(72));
// Cleanly separable: on-screen clusters near 0, away clusters near 0.4
const clean = suggestThreshold(
  [0.01, 0.02, 0.03, 0.02, 0.04, 0.01, 0.02, 0.03],
  [0.38, 0.42, 0.40, 0.45, 0.39, 0.41, 0.44, 0.43],
);
check('separable data -> threshold between clusters', clean.threshold > 0.05 && clean.threshold < 0.38, `t=${clean.threshold.toFixed(3)}`);
check('separable data -> perfect separation', clean.tpr === 1 && clean.fpr === 0, `tpr=${clean.tpr} fpr=${clean.fpr}`);

// Overlapping data: J should be low, signalling a weak signal
const overlap = suggestThreshold(
  [0.10, 0.20, 0.30, 0.15, 0.25, 0.18, 0.22, 0.28],
  [0.12, 0.22, 0.28, 0.16, 0.24, 0.19, 0.21, 0.26],
);
check('overlapping data -> low J (weak signal)', overlap.j < 0.5, `J=${overlap.j.toFixed(2)}`);

check('sign is ignored (uses magnitude)',
  suggestThreshold([0.01, -0.02, 0.03, -0.02, 0.01], [-0.40, 0.42, -0.41, 0.44, -0.39]).tpr === 1);
check('too few samples -> null', suggestThreshold([0.1, 0.2], [0.5, 0.6]) === null);
check('non-finite values ignored', suggestThreshold(
  [0.01, 0.02, 0.03, 0.02, 0.04, NaN, null],
  [0.40, 0.42, 0.41, 0.44, 0.39, undefined]) !== null);

console.log('\nROBUST STATISTICS');
console.log('-'.repeat(72));
check('median, odd count', median([3, 1, 2]) === 2);
check('median, even count', median([4, 1, 2, 3]) === 2.5);
check('median ignores non-finite', median([1, 2, 3, NaN, null]) === 2);
check('median of nothing -> null', median([]) === null);
check('mad of a constant series -> 0', mad([5, 5, 5, 5]) === 0);
check('mad resists an outlier', mad([1, 1, 1, 1, 99]) === 0, 'a mean-based spread would blow up here');

console.log('\nBASELINE BUILDING');
console.log('-'.repeat(72));
const steady = (n, yaw, pupil) => Array.from({ length: n }, (_, i) => ({
  yaw: yaw + (i % 2 ? 0.01 : -0.01),
  pupil: pupil === null ? null : pupil + (i % 2 ? 0.01 : -0.01),
}));

check('too few samples -> null', buildBaseline(steady(10, 0, 0)) === null);

// A camera mounted off to one side: baseline yaw is not zero.
const offAxis = buildBaseline(steady(120, 0.30, 0.02));
check('off-axis camera -> centre follows the student', Math.abs(offAxis.yawCenter - 0.30) < 0.02, `yawCenter=${offAxis.yawCenter.toFixed(3)}`);
check('very still student -> tolerance clamped to floor', offAxis.yawTolerance === CALIBRATION.yawFloor, `tol=${offAxis.yawTolerance}`);

// A restless student: spread is large, tolerance must not exceed the ceiling.
const restless = buildBaseline(Array.from({ length: 120 }, (_, i) => ({
  yaw: (i % 7) * 0.12 - 0.36, pupil: (i % 5) * 0.09 - 0.18,
})));
check('restless student -> tolerance clamped to ceiling', restless.yawTolerance === CALIBRATION.yawCeil, `tol=${restless.yawTolerance}`);

// Unreadable irises throughout: pupil baseline must be withheld, not invented.
const noPupils = buildBaseline(steady(120, 0, null));
check('no readable pupils -> pupil baseline null', noPupils.pupilCenter === null && noPupils.pupilTolerance === null);
check('yaw baseline still built', Number.isFinite(noPupils.yawCenter));

console.log('\nVERDICT AGAINST A BASELINE');
console.log('-'.repeat(72));
// Student normally sits at yaw 0.30. A fixed global threshold (0.22) would
// flag them permanently; their own baseline should not.
const offAxisLandmarks = makeLandmarks(50 + 0.30 * 50, eyeBox(10, 10), eyeBox(40, 10));
check('off-axis student flagged by the FIXED threshold',
  estimateGaze(offAxisLandmarks, makeCtx(0.5)) === 'suspicious',
  `yaw=${headYaw(offAxisLandmarks).toFixed(3)} vs global ${GAZE.yawTolerance}`);
check('off-axis student NOT flagged against their own baseline',
  estimateGazeWithBaseline(offAxisLandmarks, makeCtx(0.5), offAxis) === 'normal');

// The same student genuinely turning further away should still be caught.
const turnedFurther = makeLandmarks(50 + 0.55 * 50, eyeBox(10, 10), eyeBox(40, 10));
check('same student turning further -> suspicious',
  estimateGazeWithBaseline(turnedFurther, makeCtx(0.5), offAxis) === 'suspicious',
  `yaw=${headYaw(turnedFurther).toFixed(3)}`);

check('no baseline -> falls back to global constants',
  estimateGazeWithBaseline(eyesFwd, makeCtx(0.5), null) === estimateGaze(eyesFwd, makeCtx(0.5)));
// Must sit AT the baseline centre, so yaw passes and the pupil check is what
// decides. Using forward-facing landmarks here would be a 0.30 yaw deviation
// from this student's baseline and get flagged before pupils are consulted.
check('unreadable eyes -> null even with a baseline',
  estimateGazeWithBaseline(offAxisLandmarks, makeCtx(0.5, { flat: true }), offAxis) === null);
check('at baseline centre with readable eyes -> normal',
  estimateGazeWithBaseline(offAxisLandmarks, makeCtx(0.5), offAxis) === 'normal');

console.log('\n' + '='.repeat(72));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
