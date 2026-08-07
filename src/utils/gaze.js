// Gaze estimation from face-api.js 68-point landmarks.
//
// 68-point landmarks give eye *contours*, not pupils, so gaze is inferred from
// two independent signals and either one can raise a flag:
//
//   1. Head yaw  - where the nose sits between the jaw edges. Catches the head
//                  turning away from the screen.
//   2. Pupil offset - the darkest-weighted centroid inside each eye contour.
//                  Catches eyes glancing sideways while the head stays still.
//
// Both are heuristics. Lighting, glasses glare and low-resolution webcams all
// degrade the pupil signal, so this is a behavioural hint and not proof of
// anything. Callers are expected to debounce over consecutive frames.
//
// These are pure functions with no DOM or face-api dependency so they can be
// exercised directly in tests.

export const GAZE = {
  detectIntervalMs: 200,   // ~5 detections/sec; a rAF-speed loop pegs the CPU
  framesToTrigger: 5,      // ~1s of sustained deviation before flagging
  framesToClear: 3,        // ~0.6s of looking back before clearing
  yawTolerance: 0.22,      // 0 = nose centred between jaw edges, ±1 = extreme
  pupilTolerance: 0.17,    // fraction of eye width away from the eye's centre
  warnCooldownMs: 15000,   // never warn more than once per this interval
};

// Where the nose sits horizontally between the jaw edges.
// Returns 0 when facing forward, negative/positive when turned.
export const headYaw = (landmarks) => {
  const jaw = landmarks.getJawOutline();
  const nose = landmarks.getNose();
  if (!jaw?.length || !nose?.length) return 0;

  const left = jaw[0];
  const right = jaw[jaw.length - 1];
  const tip = nose[nose.length - 1];

  const dLeft = tip.x - left.x;
  const dRight = right.x - tip.x;
  const span = dLeft + dRight;
  if (span <= 0) return 0;

  return (dLeft - dRight) / span;
};

// Darkest-weighted centroid inside one eye's contour, expressed as a signed
// fraction of eye width from centre. Returns null when the eye region is too
// small or too uniform to read.
export const pupilOffset = (ctx, eyePoints) => {
  if (!eyePoints?.length) return null;

  const xs = eyePoints.map((p) => p.x);
  const ys = eyePoints.map((p) => p.y);
  const minX = Math.floor(Math.min(...xs));
  const minY = Math.floor(Math.min(...ys));
  const w = Math.ceil(Math.max(...xs)) - minX;
  const h = Math.ceil(Math.max(...ys)) - minY;

  // Too few pixels to locate anything reliably.
  if (w < 6 || h < 4) return null;

  let img;
  try {
    img = ctx.getImageData(minX, minY, w, h);
  } catch {
    return null; // tainted canvas or off-frame region
  }

  const { data } = img;
  let weightTotal = 0;
  let weightedX = 0;
  let min = 255;
  let max = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
      const weight = 255 - lum; // darker pixels pull the centroid
      weightTotal += weight;
      weightedX += weight * x;
    }
  }

  // A flat region means no visible iris (closed eye, blown-out highlight,
  // heavy glare). Reporting a centroid here would be noise.
  if (weightTotal <= 0 || max - min < 25) return null;

  // Divide by (w - 1), not w: pixel indices run 0..w-1, so a centred centroid
  // sits at (w - 1) / 2. Dividing by w biases every reading toward the left by
  // 1 / (2w), which over-reports left gaze and under-reports right gaze.
  return weightedX / weightTotal / (w - 1) - 0.5;
};

// Raw signals for one frame, before any thresholding. `pupil` is the mean of
// whichever eyes were readable, or null when neither was. Exposed so the
// tuner can record real measurements instead of just verdicts.
export const gazeReading = (landmarks, ctx) => {
  const yaw = headYaw(landmarks);
  if (!ctx) return { yaw, pupil: null };

  const left = pupilOffset(ctx, landmarks.getLeftEye());
  const right = pupilOffset(ctx, landmarks.getRightEye());
  const readings = [left, right].filter((v) => v !== null);

  return {
    yaw,
    pupil: readings.length
      ? readings.reduce((s, v) => s + v, 0) / readings.length
      : null,
    left,
    right,
  };
};

// Combines both signals into 'normal' | 'suspicious', or null when the frame
// carries no usable evidence.
export const estimateGaze = (landmarks, ctx) => {
  const { yaw, pupil } = gazeReading(landmarks, ctx);

  if (Math.abs(yaw) > GAZE.yawTolerance) return 'suspicious';
  if (!ctx) return 'normal';
  if (pupil === null) return null; // eyes unreadable this frame

  return Math.abs(pupil) > GAZE.pupilTolerance ? 'suspicious' : 'normal';
};

// --- Per-student calibration ----------------------------------------------
//
// A single global threshold is fragile: it has to hold for a dim laptop webcam
// and a bright external one, for someone sitting close and someone leaning
// back, with and without glasses. A camera mounted off to one side also gives
// a permanently non-zero yaw, which a fixed threshold reads as looking away.
//
// Instead, measure each student's own baseline at the start of the session,
// while they are reading instructions and presumed to be looking at the
// screen, then flag deviation from *their* baseline.
export const CALIBRATION = {
  minSamples: 40,     // ~8s at GAZE.detectIntervalMs before a baseline is usable
  targetSamples: 100, // ~20s; collection stops here
  k: 4,               // flag beyond k x the student's own spread
  yawFloor: 0.10,     // never tighter than this, however still they sat
  yawCeil: 0.35,      // never looser than this, however much they moved
  pupilFloor: 0.08,
  pupilCeil: 0.30,
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const median = (values) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

// Median absolute deviation: a spread measure that a few glances away during
// calibration cannot drag around, unlike a standard deviation.
export const mad = (values, center = null) => {
  const v = values.filter(Number.isFinite);
  if (!v.length) return null;
  const c = center === null ? median(v) : center;
  return median(v.map((x) => Math.abs(x - c)));
};

// Turn collected calibration samples into per-student centres and tolerances.
// Returns null when there is not enough data to justify one.
export const buildBaseline = (samples) => {
  const yaws = samples.map((s) => s.yaw).filter(Number.isFinite);
  if (yaws.length < CALIBRATION.minSamples) return null;

  const yawCenter = median(yaws);
  const yawTolerance = clamp(
    CALIBRATION.k * (mad(yaws, yawCenter) ?? 0),
    CALIBRATION.yawFloor,
    CALIBRATION.yawCeil,
  );

  // The iris is often unreadable for a fair share of frames. Only derive a
  // pupil baseline when enough of them came through; otherwise fall back.
  const pupils = samples.map((s) => s.pupil).filter(Number.isFinite);
  let pupilCenter = null;
  let pupilTolerance = null;
  if (pupils.length >= CALIBRATION.minSamples / 2) {
    pupilCenter = median(pupils);
    pupilTolerance = clamp(
      CALIBRATION.k * (mad(pupils, pupilCenter) ?? 0),
      CALIBRATION.pupilFloor,
      CALIBRATION.pupilCeil,
    );
  }

  return {
    yawCenter,
    yawTolerance,
    pupilCenter,
    pupilTolerance,
    samples: yaws.length,
    pupilSamples: pupils.length,
  };
};

// Same verdict logic as estimateGaze, but measured against the student's own
// baseline. Falls back to the global constants for anything not calibrated,
// so this is safe to call before or without calibration.
export const estimateGazeWithBaseline = (landmarks, ctx, baseline) => {
  const { yaw, pupil } = gazeReading(landmarks, ctx);

  const yawCenter = baseline?.yawCenter ?? 0;
  const yawTolerance = baseline?.yawTolerance ?? GAZE.yawTolerance;
  if (Math.abs(yaw - yawCenter) > yawTolerance) return 'suspicious';

  if (!ctx) return 'normal';
  if (pupil === null) return null;

  const pupilCenter = baseline?.pupilCenter ?? 0;
  const pupilTolerance = baseline?.pupilTolerance ?? GAZE.pupilTolerance;
  return Math.abs(pupil - pupilCenter) > pupilTolerance ? 'suspicious' : 'normal';
};

// Given labelled |value| samples, pick the threshold that best separates them.
// Sweeps candidate cut points and maximises Youden's J (TPR - FPR), so it
// favours catching real look-aways without flagging normal behaviour.
export const suggestThreshold = (onScreen, away) => {
  const pos = away.filter((v) => Number.isFinite(v)).map(Math.abs);
  const neg = onScreen.filter((v) => Number.isFinite(v)).map(Math.abs);
  if (pos.length < 5 || neg.length < 5) return null;

  const candidates = [...new Set([...pos, ...neg])].sort((a, b) => a - b);
  let best = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const next = candidates[i + 1] ?? candidates[i] + 0.01;
    const t = (candidates[i] + next) / 2;
    const tpr = pos.filter((v) => v > t).length / pos.length;
    const fpr = neg.filter((v) => v > t).length / neg.length;
    const j = tpr - fpr;
    if (!best || j > best.j) best = { threshold: t, tpr, fpr, j };
  }

  return best;
};
