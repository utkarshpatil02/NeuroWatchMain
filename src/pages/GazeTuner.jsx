// Development-only calibration tool for the gaze thresholds in utils/gaze.js.
//
// The thresholds cannot be chosen sensibly without measurements from a real
// face on a real webcam: they depend on camera placement, lighting, glasses
// and how far you sit from the screen. This page records labelled samples in
// two phases and suggests thresholds that best separate them.
//
// Registered only when import.meta.env.DEV is true, so it never ships.
import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { GAZE, gazeReading, suggestThreshold } from '../utils/gaze';

const PHASES = {
  onScreen: {
    label: 'Looking AT the screen',
    hint: 'Read this page normally. Glance around the screen as you would during an exam.',
  },
  away: {
    label: 'Looking AWAY',
    hint: 'Look at your phone, a book on the desk, or off to one side — as if consulting something.',
  },
};

const RECORD_MS = 15000;

const pct = (v) => `${(v * 100).toFixed(0)}%`;
const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(3));

const stats = (arr) => {
  const vals = arr.filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
  if (!vals.length) return null;
  const at = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  return { n: vals.length, median: at(0.5), p90: at(0.9), max: vals[vals.length - 1] };
};

export default function GazeTuner() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const samplesRef = useRef({ onScreen: [], away: [] });
  const recordingRef = useRef(null);

  const [status, setStatus] = useState('Loading models…');
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState({ yaw: null, pupil: null, faces: 0 });
  const [recording, setRecording] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [counts, setCounts] = useState({ onScreen: 0, away: 0 });
  const [result, setResult] = useState(null);

  // Load models, then open the webcam.
  useEffect(() => {
    let cancelled = false;
    // Held locally so cleanup stops the exact stream this effect opened,
    // rather than whatever videoRef happens to point at by then.
    let mediaStream = null;

    (async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      } catch (err) {
        if (!cancelled) setStatus(`Model load failed: ${err.message}`);
        return;
      }

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          mediaStream = null;
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
        setStatus('Ready. Record both phases, then compute.');
      } catch (err) {
        setStatus(`Camera unavailable: ${err.message}`);
      }
    })();

    return () => {
      cancelled = true;
      mediaStream?.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    };
  }, []);

  // Sampling loop, at the same cadence the real detector uses.
  useEffect(() => {
    if (!ready) return undefined;

    let timer;
    let busy = false;

    const sample = async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4 || busy) return;
      busy = true;

      try {
        const dets = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        if (dets.length !== 1) {
          setLive({ yaw: null, pupil: null, faces: dets.length });
          return;
        }

        const canvas = canvasRef.current;
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const reading = gazeReading(dets[0].landmarks, ctx);
        setLive({ ...reading, faces: 1 });

        const phase = recordingRef.current;
        if (phase) {
          samplesRef.current[phase].push(reading);
          setCounts({
            onScreen: samplesRef.current.onScreen.length,
            away: samplesRef.current.away.length,
          });
        }
      } catch {
        /* transient detector errors are not interesting here */
      } finally {
        busy = false;
      }
    };

    timer = setInterval(sample, GAZE.detectIntervalMs);
    return () => clearInterval(timer);
  }, [ready]);

  const startRecording = (phase) => {
    samplesRef.current[phase] = [];
    recordingRef.current = phase;
    setRecording(phase);
    setResult(null);
    setRemaining(Math.round(RECORD_MS / 1000));

    const tick = setInterval(() => setRemaining((r) => r - 1), 1000);
    setTimeout(() => {
      clearInterval(tick);
      recordingRef.current = null;
      setRecording(null);
      setRemaining(0);
    }, RECORD_MS);
  };

  const compute = () => {
    const { onScreen, away } = samplesRef.current;
    const yaw = suggestThreshold(onScreen.map((s) => s.yaw), away.map((s) => s.yaw));
    const pupil = suggestThreshold(
      onScreen.map((s) => s.pupil).filter((v) => v !== null),
      away.map((s) => s.pupil).filter((v) => v !== null),
    );

    setResult({
      yaw,
      pupil,
      onScreenYaw: stats(onScreen.map((s) => s.yaw)),
      awayYaw: stats(away.map((s) => s.yaw)),
      onScreenPupil: stats(onScreen.map((s) => s.pupil)),
      awayPupil: stats(away.map((s) => s.pupil)),
      pupilReadRate: {
        onScreen: onScreen.length ? onScreen.filter((s) => s.pupil !== null).length / onScreen.length : 0,
        away: away.length ? away.filter((s) => s.pupil !== null).length / away.length : 0,
      },
    });
  };

  const reset = () => {
    samplesRef.current = { onScreen: [], away: [] };
    setCounts({ onScreen: 0, away: 0 });
    setResult(null);
  };

  const box = { border: '1px solid #d0d4dd', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fff' };
  const mono = { fontFamily: 'ui-monospace, Consolas, monospace' };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#1a1d24' }}>
      <h1 style={{ marginBottom: 4 }}>Gaze threshold tuner</h1>
      <p style={{ color: '#5b6270', marginTop: 0 }}>
        Development tool. Records labelled samples and suggests values for <code>GAZE</code> in{' '}
        <code>src/utils/gaze.js</code>.
      </p>

      <div style={box}>
        <div style={{ marginBottom: 8, color: '#5b6270' }}>{status}</div>
        <video ref={videoRef} muted playsInline style={{ width: 320, borderRadius: 6, background: '#000' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{ ...mono, marginTop: 12 }}>
          faces: {live.faces} &nbsp;|&nbsp; yaw: {fmt(live.yaw)} &nbsp;|&nbsp; pupil: {fmt(live.pupil)}
          {live.faces === 1 && live.pupil === null && (
            <span style={{ color: '#b26a00' }}> &nbsp;(eyes unreadable this frame)</span>
          )}
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>1. Record samples</h3>
        {Object.entries(PHASES).map(([key, phase]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <button
              type="button"
              disabled={!ready || recording !== null}
              onClick={() => startRecording(key)}
              style={{
                padding: '8px 14px', borderRadius: 6, border: '1px solid #3b5bdb',
                background: recording === key ? '#3b5bdb' : '#fff',
                color: recording === key ? '#fff' : '#3b5bdb',
                cursor: !ready || recording !== null ? 'not-allowed' : 'pointer',
                opacity: !ready || (recording !== null && recording !== key) ? 0.5 : 1,
              }}
            >
              {recording === key ? `Recording… ${remaining}s` : `Record: ${phase.label}`}
            </button>
            <span style={{ marginLeft: 10, color: '#5b6270', fontSize: 14 }}>
              {phase.hint} &nbsp;<strong>({counts[key]} samples)</strong>
            </span>
          </div>
        ))}
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>2. Compute thresholds</h3>
        <button
          type="button"
          onClick={compute}
          disabled={counts.onScreen < 5 || counts.away < 5}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #2b8a3e', background: '#2b8a3e', color: '#fff', marginRight: 8, opacity: counts.onScreen < 5 || counts.away < 5 ? 0.5 : 1 }}
        >
          Compute
        </button>
        <button type="button" onClick={reset} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #adb5bd', background: '#fff' }}>
          Reset
        </button>

        {result && (
          <div style={{ ...mono, marginTop: 16, fontSize: 14 }}>
            <p style={{ fontFamily: 'system-ui', color: '#5b6270' }}>
              Paste these into <code>GAZE</code>. <strong>J</strong> is separation quality: above ~0.7 is a
              usable signal, below ~0.4 means that signal barely distinguishes the two phases here.
            </p>
            <pre style={{ background: '#f6f7f9', padding: 12, borderRadius: 6, overflowX: 'auto' }}>
{`yawTolerance:   ${result.yaw ? result.yaw.threshold.toFixed(3) : 'insufficient samples'}   ${result.yaw ? `(J=${result.yaw.j.toFixed(2)}  catches ${pct(result.yaw.tpr)} of look-aways, flags ${pct(result.yaw.fpr)} of normal)` : ''}
pupilTolerance: ${result.pupil ? result.pupil.threshold.toFixed(3) : 'insufficient samples'}   ${result.pupil ? `(J=${result.pupil.j.toFixed(2)}  catches ${pct(result.pupil.tpr)} of look-aways, flags ${pct(result.pupil.fpr)} of normal)` : ''}

|yaw|    on-screen  median ${fmt(result.onScreenYaw?.median)}  p90 ${fmt(result.onScreenYaw?.p90)}  max ${fmt(result.onScreenYaw?.max)}
         away       median ${fmt(result.awayYaw?.median)}  p90 ${fmt(result.awayYaw?.p90)}  max ${fmt(result.awayYaw?.max)}
|pupil|  on-screen  median ${fmt(result.onScreenPupil?.median)}  p90 ${fmt(result.onScreenPupil?.p90)}  max ${fmt(result.onScreenPupil?.max)}
         away       median ${fmt(result.awayPupil?.median)}  p90 ${fmt(result.awayPupil?.p90)}  max ${fmt(result.awayPupil?.max)}

pupil readable in ${pct(result.pupilReadRate.onScreen)} of on-screen frames, ${pct(result.pupilReadRate.away)} of away frames
current values: yawTolerance ${GAZE.yawTolerance}, pupilTolerance ${GAZE.pupilTolerance}`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
