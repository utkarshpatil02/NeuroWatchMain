import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

function ExamSetup() {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Receive data from login
  const { exam, sessionId } = location.state || {};

  // ✅ Debug logs (keep for now)
  console.log("Exam Data:", exam);
  console.log("Session ID:", sessionId);

  const videoRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    startCamera();

    // ✅ Tab switching detection + logging
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("🚨 Tab switched");

        // ✅ Send to backend
        fetch("http://localhost:5000/api/log-event", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            session_id: sessionId,
            type: "tab_switch"
          })
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionId]); // ✅ FIX: dependency added

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraOn(true);
    } catch (err) {
      alert("Camera access is required to start the exam");
    }
  };

  const handleStart = () => {
    // ✅ Pass exam + session to exam page
    navigate("/exam", {
      state: { exam, sessionId }
    });
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Exam Setup</h2>

      <video ref={videoRef} autoPlay width="300" />

      <h3>Instructions:</h3>
      <ul style={{ listStyle: "none" }}>
        <li>No cheating</li>
        <li>Stay in front of camera</li>
        <li>No tab switching</li>
      </ul>

      <button
        onClick={handleStart}
        disabled={!cameraOn}
        style={{ padding: "10px 20px", marginTop: "20px" }}
      >
        Start Exam
      </button>
    </div>
  );
}

export default ExamSetup;