import { useState, useEffect, useRef } from 'react';
import { proctoringService } from '../services/api';
import * as faceapi from 'face-api.js';

import {
  GAZE,
  CALIBRATION,
  gazeReading,
  buildBaseline,
  estimateGazeWithBaseline,
} from '../utils/gaze';

// Screenshot capture policy. Images are personal data and are retained for as
// long as the logs are, so capture is deliberately narrow: only events a
// proctor would actually want to see a frame for, at a bounded rate.
const SCREENSHOT = {
  eventTypes: ['multiple_faces', 'face_not_detected', 'gaze_away'],
  minIntervalMs: 10000,
  maxWidth: 480,
  quality: 0.6,
};

export const useProctoring = (sessionId) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [tabFocused, setTabFocused] = useState(true);
  const [warnings, setWarnings] = useState([]);
  const [faceDetected, setFaceDetected] = useState(true);
  const [multipleFaces, setMultipleFaces] = useState(false);
  // 'normal' | 'suspicious' | 'unavailable'. 'unavailable' means the landmark
  // model did not load, so no claim is made either way.
  const [eyeMovement, setEyeMovement] = useState('normal');
  const [faceVerified, setFaceVerified] = useState(false);

  const webcamRef = useRef(null);
  const streamRef = useRef(null);
  const faceCheckIntervalRef = useRef(null);
  const faceApiLoadedRef = useRef(false);
  const landmarksLoadedRef = useRef(false);

  // Gaze is debounced over consecutive frames: people glance away constantly
  // while thinking, so a single off-screen frame must not raise a warning.
  const gazeStreakRef = useRef(0);
  const gazeStateRef = useRef('normal');
  const lastGazeWarnRef = useRef(0);
  const lastScreenshotRef = useRef(0);

  // 'calibrating' until enough baseline samples are collected, then 'ready'.
  // No gaze verdict is issued while calibrating.
  const [gazeCalibration, setGazeCalibration] = useState('calibrating');
  const calibrationSamplesRef = useRef([]);
  const baselineRef = useRef(null);

  // Join exam session for real-time updates
  useEffect(() => {
    if (sessionId) {
      proctoringService.joinExamSession(sessionId);
    }
  }, [sessionId]);

  // Load face-api.js models once. The landmark net is what makes gaze
  // estimation possible; without it detection still runs, but eyeMovement
  // stays 'normal' rather than silently reporting everyone as attentive.
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        faceApiLoadedRef.current = true;
      } catch (err) {
        console.error('Error loading face-api.js models:', err);
        addWarning('Face detection models failed to load');
        return;
      }

      try {
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        landmarksLoadedRef.current = true;
      } catch (err) {
        console.error('Error loading face landmark model:', err);
        addWarning('Gaze tracking unavailable (landmark model failed to load)');
      }
    };
    loadModels();
  }, []);

  // Request full screen
  const requestFullScreen = () => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  };

  // Exit full screen
  const exitFullScreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  };

  // Start webcam
  const startWebcam = async () => {
    try {
      if (streamRef.current) {
        if (webcamRef.current) {
          webcamRef.current.srcObject = streamRef.current;
        }
        return true;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        webcamRef.current.onloadedmetadata = () => {
          webcamRef.current.play().catch(e => console.error("Error playing video:", e));
        };
      }
      streamRef.current = stream;
      console.log("Webcam started successfully");
      return true;
    } catch (err) {
      console.error("Error accessing webcam:", err);
      addWarning("Webcam access denied or unavailable");
      return false;
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (faceCheckIntervalRef.current) {
      clearInterval(faceCheckIntervalRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Take screenshot
  const takeScreenshot = async () => {
    if (!webcamRef.current || !webcamRef.current.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = webcamRef.current.videoWidth;
    canvas.height = webcamRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcamRef.current, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    });
  };

  // Screenshot as a data URL for upload, downscaled and compressed. The full
  // webcam frame is larger than a proctor needs, and every extra kilobyte is
  // stored per event and retained for as long as the logs are.
  const screenshotDataUrl = () => {
    const video = webcamRef.current;
    if (!video?.videoWidth) return null;

    const scale = Math.min(1, SCREENSHOT.maxWidth / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', SCREENSHOT.quality);
  };

  // Confirm a face is visible before the exam starts. There is no server-side
  // face store to register against, so this checks the local webcam frame
  // rather than uploading anything. (It previously called
  // proctoringService.registerFace, which never existed and threw.)
  const registerFace = async () => {
    if (!sessionId) return null;
    try {
      const screenshot = await takeScreenshot();
      if (!screenshot) return null;
      setFaceVerified(true);
      return { faceVerified: true };
    } catch (error) {
      console.error('Error registering face:', error);
      return null;
    }
  };

  // Clear the gaze streak when there is nothing to judge (no face, or more
  // than one). Absence of a reading is not evidence of looking away.
  const resetGaze = () => {
    gazeStreakRef.current = 0;
    if (gazeStateRef.current !== 'normal') {
      gazeStateRef.current = 'normal';
      setEyeMovement('normal');
    }
  };

  // Fold one frame's verdict into the debounced state. Only a run of
  // consecutive agreeing frames flips it, so a glance does not trigger.
  const applyGazeVerdict = (verdict) => {
    const current = gazeStateRef.current;

    if (verdict === current) {
      gazeStreakRef.current = 0;
      return;
    }

    gazeStreakRef.current += 1;

    const needed =
      verdict === 'suspicious' ? GAZE.framesToTrigger : GAZE.framesToClear;
    if (gazeStreakRef.current < needed) return;

    gazeStreakRef.current = 0;
    gazeStateRef.current = verdict;
    setEyeMovement(verdict);

    if (verdict !== 'suspicious') return;

    // Rate-limit the visible warning and the logged event separately from the
    // state, which flips as often as the student looks back and away.
    const now = Date.now();
    if (now - lastGazeWarnRef.current < GAZE.warnCooldownMs) return;
    lastGazeWarnRef.current = now;

    addWarning('Looking away from the screen was detected.');
    logProctoringEvent('gaze_away');
  };

  // Real-time face detection using face-api.js.
  //
  // Throttled to GAZE.detectIntervalMs. This previously ran a full detection
  // every animation frame and pushed a warning on each one, which pegged the
  // CPU and grew the warnings list without bound; landmark extraction on top
  // of that would be far worse.
  useEffect(() => {
    let animationFrameId;
    let cancelled = false;
    let lastRun = 0;
    let busy = false;

    // Reused scratch canvas for reading eye pixels.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const runDetection = async (video) => {
      const useLandmarks = landmarksLoadedRef.current;

      const query = faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
      const detections = useLandmarks ? await query.withFaceLandmarks() : await query;

      if (cancelled) return;

      setFaceDetected(detections.length === 1);
      setMultipleFaces(detections.length > 1);

      if (detections.length === 0) {
        addWarning('Face not detected. Please ensure your face is visible.');
        resetGaze();
        return;
      }
      if (detections.length > 1) {
        addWarning('Multiple faces detected. Only the exam taker should be visible.');
        resetGaze();
        return;
      }

      if (!useLandmarks) {
        setEyeMovement('unavailable');
        setGazeCalibration('unavailable');
        return;
      }

      // Copy the current frame so eye regions can be sampled.
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const landmarks = detections[0].landmarks;

      // Calibration phase: the student is reading instructions and presumed to
      // be looking at the screen, so these frames define their normal. No
      // verdict is issued yet - judging someone against a baseline that does
      // not exist is what the fixed global thresholds did.
      if (!baselineRef.current) {
        calibrationSamplesRef.current.push(gazeReading(landmarks, ctx));

        if (calibrationSamplesRef.current.length >= CALIBRATION.targetSamples) {
          const baseline = buildBaseline(calibrationSamplesRef.current);
          if (baseline) {
            baselineRef.current = baseline;
            calibrationSamplesRef.current = [];
            setGazeCalibration('ready');
          } else {
            // Not enough usable frames; keep the most recent ones and retry.
            calibrationSamplesRef.current =
              calibrationSamplesRef.current.slice(-CALIBRATION.minSamples);
          }
        }
        return;
      }

      const verdict = estimateGazeWithBaseline(landmarks, ctx, baselineRef.current);
      if (verdict === null) return; // unreadable frame: leave the streak alone

      applyGazeVerdict(verdict);
    };

    const tick = async (now) => {
      if (cancelled) return;

      const video = webcamRef.current;
      const ready = video && video.readyState === 4 && faceApiLoadedRef.current;

      if (ready && !busy && now - lastRun >= GAZE.detectIntervalMs) {
        lastRun = now;
        busy = true;
        try {
          await runDetection(video);
        } catch (err) {
          console.error('Face detection error:', err);
        } finally {
          busy = false;
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
    // eslint-disable-next-line
  }, [webcamRef, faceApiLoadedRef]);

  // Face checks run client-side in the detectFaces loop above, which already
  // sets faceDetected/multipleFaces from real face-api.js detections. There is
  // no server-side verification to poll: it would need face storage and
  // recognition that the backend does not have, and returning a canned "pass"
  // here would overwrite genuine detection results with a fake one.
  //
  // Eye-movement tracking is not implemented, so eyeMovement stays 'normal'.
  const startFaceVerification = () => {
    if (faceCheckIntervalRef.current) {
      clearInterval(faceCheckIntervalRef.current);
      faceCheckIntervalRef.current = null;
    }
  };

  // Log proctoring event, attaching a webcam screenshot where one is useful.
  //
  // Not every event warrants an image. face_not_detected alone accounts for
  // most logged events, so capturing on all of them would store thousands of
  // near-identical frames per exam and retain far more of a student's face
  // than the evidence justifies. Only visual events carry an image, and only
  // one every SCREENSHOT.minIntervalMs.
  const logProctoringEvent = async (eventType, details = {}) => {
    if (!sessionId) return;

    let screenshot = null;
    if (SCREENSHOT.eventTypes.includes(eventType)) {
      const now = Date.now();
      if (now - lastScreenshotRef.current >= SCREENSHOT.minIntervalMs) {
        lastScreenshotRef.current = now;
        try {
          screenshot = screenshotDataUrl();
        } catch (err) {
          console.error('Screenshot capture failed:', err);
        }
      }
    }

    try {
      await proctoringService.logEvent(sessionId, eventType, details, screenshot);
    } catch (error) {
      console.error('Error logging proctoring event:', error);
    }
  };

  // Add warning with timestamp
  const addWarning = (message) => {
    const warning = {
      id: Date.now(),
      message,
      timestamp: new Date().toISOString(),
    };
    setWarnings(prev => [...prev, warning]);
  };

  // Monitor full screen changes
  useEffect(() => {
    const handleFullScreenChange = () => {
      const isInFullScreen = !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      setIsFullScreen(isInFullScreen);
      if (!isInFullScreen && sessionId) {
        logProctoringEvent('full_screen_exit');
        addWarning("Full screen mode exited");
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('msfullscreenchange', handleFullScreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('msfullscreenchange', handleFullScreenChange);
    };
  }, [sessionId]);

  // Monitor tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabFocused(false);
        if (sessionId) {
          logProctoringEvent('tab_switch');
        }
        addWarning("Tab switched");
      } else {
        setTabFocused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId]);

  // Prevent context menu
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      addWarning("Right-click attempted");
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Prevent copy-paste
  useEffect(() => {
    const handleCopy = (e) => {
      e.preventDefault();
      addWarning("Copy attempted");
      return false;
    };

    const handlePaste = (e) => {
      e.preventDefault();
      addWarning("Paste attempted");
      return false;
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return {
    isFullScreen,
    tabFocused,
    warnings,
    faceDetected,
    multipleFaces,
    eyeMovement,
    gazeCalibration,
    faceVerified,
    webcamRef,
    requestFullScreen,
    exitFullScreen,
    startWebcam,
    stopWebcam,
    registerFace,
    startFaceVerification,
    takeScreenshot
  };
};
