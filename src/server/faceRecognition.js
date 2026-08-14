// Server-side face descriptor extraction and matching.
//
// Deliberately does NOT import @tensorflow/tfjs. face-api.js 0.22 bundles its
// own tfjs-core 1.x; loading tfjs 4.x alongside it registers a second set of
// backends and kernel lookups then cross between the two copies, failing with
// "forwardFunc_1 is not a function". face-api's own tf is used instead.
//
// JPEGs are decoded with jpeg-js rather than the native `canvas` package, so
// there is no build toolchain requirement.
//
// What this gives you: confidence that the face in front of the camera is the
// same one that started the session. It is continuity, not identity - there is
// no trusted enrolled photo to compare against, so it cannot tell you the right
// person started the exam, only that nobody swapped in afterwards.
import path from 'path';
import { fileURLToPath } from 'url';
import * as faceapi from 'face-api.js';
import jpeg from 'jpeg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FACE = {
  // face-api's usual cut-off for "same person" on 128-d descriptors. Lower is
  // stricter. Distances below this are treated as a match.
  matchThreshold: 0.6,
  // Descriptors are only meaningful for a clearly detected face.
  minDetectionScore: 0.5,
  // Largest frame accepted, to bound CPU cost per request.
  maxPixels: 1280 * 720,

  // Detector resolution, and the only meaningful performance lever here.
  //
  // Cost is almost entirely detection. Landmarks and the descriptor are close
  // to free, and the source image resolution makes no difference at all,
  // because face-api rescales to inputSize regardless:
  //
  //   detector alone           source image (inputSize 416)   stages (416)
  //     416  915 ms              320x240  797 ms                detect      783 ms
  //     320  489 ms              480x360  803 ms                + landmarks 799 ms
  //     224  238 ms              640x480  795 ms                + descriptor 789 ms
  //     160  126 ms
  //
  // End to end through /face, which also pays a Supabase session lookup and
  // HTTP overhead that no detector setting can remove:
  //
  //     inputSize 416   1044 ms   ~57 concurrent students per core @ 60s
  //     inputSize 320    772 ms   ~77 concurrent students per core @ 60s
  //
  // Smaller values are faster but detect small or distant faces less reliably;
  // for a webcam headshot the face fills enough of the frame that 320 is
  // comfortable. Drop to 224 if throughput matters more than catching someone
  // sitting well back from the camera.
  //
  // Note for anyone reaching for @tensorflow/tfjs-node: it will not help.
  // face-api.js 0.22 pins tfjs-core 1.7.0, so a 4.x native backend registers
  // against a different module instance and is simply never used. Native
  // acceleration would require migrating off face-api.js first.
  detectorInputSize: 320,
};

let loadPromise = null;

// Load once, and only when first needed, so server boot is not delayed by
// ~6.3 MB of weights. Concurrent callers share the same promise.
export const loadFaceModels = () => {
  if (!loadPromise) {
    loadPromise = (async () => {
      const clientModels = path.join(__dirname, '..', '..', 'public', 'models');
      const serverModels = path.join(__dirname, 'models');

      await faceapi.nets.tinyFaceDetector.loadFromDisk(clientModels);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(clientModels);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(serverModels);
    })().catch((err) => {
      loadPromise = null; // let a later request retry
      throw err;
    });
  }
  return loadPromise;
};

// jpeg-js gives RGBA; face-api wants a 3-channel tensor.
const toTensor = ({ width, height, data }) => {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return faceapi.tf.tensor3d(rgb, [height, width, 3]);
};

// Extract a 128-float descriptor from a JPEG buffer.
// Returns { descriptor, score } or null when no usable face is present.
// Throws only on malformed input or a model failure.
export const computeFaceDescriptor = async (jpegBuffer) => {
  await loadFaceModels();

  let decoded;
  try {
    decoded = jpeg.decode(jpegBuffer, { useTArray: true });
  } catch {
    throw new Error('image could not be decoded as JPEG');
  }

  if (decoded.width * decoded.height > FACE.maxPixels) {
    throw new Error('image is too large');
  }

  const tensor = toTensor(decoded);
  try {
    const result = await faceapi
      .detectSingleFace(
        tensor,
        new faceapi.TinyFaceDetectorOptions({ inputSize: FACE.detectorInputSize })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) return null;
    if (result.detection.score < FACE.minDetectionScore) return null;

    return {
      descriptor: Array.from(result.descriptor),
      score: result.detection.score,
    };
  } finally {
    // Tensors are not garbage collected; leaking one per request would grow
    // memory until the process dies.
    tensor.dispose();
  }
};

// Euclidean distance between two 128-d descriptors. Returns null if either is
// missing or malformed, rather than a misleading number.
export const descriptorDistance = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  if (a.length !== b.length || !a.length) return null;

  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    if (!Number.isFinite(d)) return null;
    sum += d * d;
  }
  return Math.sqrt(sum);
};

// Distance plus the match decision, so callers do not each re-apply the
// threshold and drift apart.
export const matchDescriptors = (reference, candidate) => {
  const distance = descriptorDistance(reference, candidate);
  if (distance === null) return { matched: null, distance: null };
  return { matched: distance <= FACE.matchThreshold, distance };
};


