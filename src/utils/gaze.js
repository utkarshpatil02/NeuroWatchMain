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

// Combines both signals into 'normal' | 'suspicious', or null when the frame
// carries no usable evidence.
export const estimateGaze = (landmarks, ctx) => {
  const yaw = headYaw(landmarks);
  if (Math.abs(yaw) > GAZE.yawTolerance) return 'suspicious';

  if (!ctx) return 'normal';

  const left = pupilOffset(ctx, landmarks.getLeftEye());
  const right = pupilOffset(ctx, landmarks.getRightEye());
  const readings = [left, right].filter((v) => v !== null);
  if (!readings.length) return null; // eyes unreadable this frame

  const avg = readings.reduce((s, v) => s + v, 0) / readings.length;
  return Math.abs(avg) > GAZE.pupilTolerance ? 'suspicious' : 'normal';
};
