import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiCamera, FiMonitor, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';

import Header from '../common/Header';
import Card from '../common/Card';
import Button from '../common/Button';
import QuestionCard from './QuestionCard';
import WarningBanner from '../proctoring/WarningBanner';
import { useProctoring } from '../../hooks/useProctoring';

const ExamContainer = styled.div`
  min-height: 100vh;
  background-color: var(--background);
`;

const ExamContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    padding: 1rem;
  }

  @media (max-width: 768px) {
    padding: 0.5rem;
  }
`;

const QuestionsSection = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
`;

const ProctoringSidebar = styled(Card)`
  height: fit-content;
  position: sticky;
  top: 90px;
  
  @media (max-width: 1024px) {
    position: relative;
    top: 0;
    margin-top: 1rem;
  }
`;

const WebcamContainer = styled.div`
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 4/3;
  background-color: #000;
`;

const Webcam = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const WebcamOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  flex-direction: column;
  text-align: center;
  padding: 16px;
`;

const StatusItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 6px;
  background-color: ${props => props.status === 'ok' ? 'rgba(76, 201, 240, 0.1)' : 'rgba(230, 57, 70, 0.1)'};
`;

const StatusIcon = styled.div`
  color: ${props => props.status === 'ok' ? 'var(--success)' : 'var(--danger)'};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StatusText = styled.div`
  flex: 1;
  font-size: 0.9rem;
`;

const SubmitSection = styled.div`
  margin-top: 40px;
  display: flex;
  justify-content: center;
`;

const ExamInterface = () => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [score, setScore] = useState(null);
  const location = useLocation();
  const { exam: examData, sessionId } = location.state || {};

  const { 
    isFullScreen, 
    tabFocused, 
    faceDetected,
    multipleFaces,
    warnings,
    webcamRef,
    requestFullScreen,
    startWebcam
  } = useProctoring(sessionId);

  // Fetch exam questions
  useEffect(() => {
    if (examData && examData.id) {
      setExam(examData);
      setTimeLeft(examData.duration);
      fetch(`http://localhost:5000/api/exams/${examData.id}/questions`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => setQuestions(data))
        .catch(err => console.error('Error fetching questions:', err));
    }
  }, [examData]);

  // Handle answer changes
  const handleAnswerChange = (questionId, optionId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  // Submit exam
  const handleSubmit = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/exams/${exam.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ examId: exam.id, sessionId, answers })
      });
      const data = await res.json();
      if (res.ok) {
        setScore(data.score);
        setExamSubmitted(true);
      } else {
        console.error('Error submitting exam:', data.error);
      }
    } catch (err) {
      console.error('Error submitting exam:', err);
    }
  };

  // Initialize exam environment
  useEffect(() => {
    setTimeout(() => {
      startWebcam().then(success => {
        if (!success) {
          console.warn("Failed to initialize webcam");
          setCameraError(true);
        }
      }).catch(err => {
        console.error("Error starting webcam:", err);
        setCameraError(true);
      });
    }, 1000);
    
    requestFullScreen();
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);

  // Handle webcam retry
  const handleRetryCamera = () => {
    setCameraError(false);
    startWebcam().then(success => {
      if (!success) {
        setCameraError(true);
      }
    }).catch(() => {
      setCameraError(true);
    });
  };

  if (examSubmitted) {
    return (
      <ExamContainer>
        <Header examTitle={exam?.title} timeLeft={0} examMode={true} />
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <FiCheckCircle size={100} color="var(--success)" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Exam Submitted Successfully!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ fontSize: '1.2rem', maxWidth: '600px', margin: '20px auto' }}
          >
            Your score: {score} points. Thank you for completing the exam. Your responses have been recorded.
            You may now close this window.
          </motion.p>
        </div>
      </ExamContainer>
    );
  }

  return (
    <ExamContainer>
      <Header examTitle={exam?.title} timeLeft={timeLeft} examMode={true} />
      
      <ExamContent>
        <QuestionsSection>
          {!isFullScreen && (
            <WarningBanner 
              visible={true}
              message="Please enter full screen mode to continue the exam."
              actionText="Enter Full Screen"
              onAction={requestFullScreen}
            />
          )}
          
          {!tabFocused && (
            <WarningBanner 
              visible={true}
              message="Warning: Tab switching detected! Please stay on this tab."
            />
          )}
          
          {!faceDetected && !cameraError && (
            <WarningBanner 
              visible={true}
              message="Face not detected. Please ensure your face is visible."
            />
          )}
          
          {multipleFaces && (
            <WarningBanner 
              visible={true}
              message="Multiple faces detected. Only the exam taker should be visible."
            />
          )}
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {questions.map((question, index) => (
              <QuestionCard 
                key={question.id}
                question={question}
                number={index + 1}
                onAnswerChange={handleAnswerChange}
              />
            ))}
            
            <SubmitSection>
              <Button 
                size="large" 
                onClick={handleSubmit}
              >
                Submit Exam
              </Button>
            </SubmitSection>
          </motion.div>
        </QuestionsSection>
        
        <ProctoringSidebar>
          <h3>Proctoring Status</h3>
          
          <WebcamContainer>
            <Webcam 
              ref={webcamRef} 
              autoPlay 
              playsInline
              muted 
              onError={() => setCameraError(true)}
            />
            {cameraError && (
              <WebcamOverlay>
                <FiCamera size={32} />
                <p style={{ margin: '10px 0' }}>Camera access denied or unavailable</p>
                <Button 
                  size="small" 
                  onClick={handleRetryCamera}
                  style={{ marginTop: '10px' }}
                >
                  Enable Camera
                </Button>
              </WebcamOverlay>
            )}
          </WebcamContainer>
          
          <StatusItem status={isFullScreen ? 'ok' : 'error'}>
            <StatusIcon status={isFullScreen ? 'ok' : 'error'}>
              {isFullScreen ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
            </StatusIcon>
            <StatusText>
              {isFullScreen ? 'Full screen mode active' : 'Full screen required'}
            </StatusText>
          </StatusItem>
          
          <StatusItem status={tabFocused ? 'ok' : 'error'}>
            <StatusIcon status={tabFocused ? 'ok' : 'error'}>
              {tabFocused ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
            </StatusIcon>
            <StatusText>
              {tabFocused ? 'Tab focus maintained' : 'Tab switching detected'}
            </StatusText>
          </StatusItem>
          
          <StatusItem status={!cameraError && faceDetected ? 'ok' : 'error'}>
            <StatusIcon status={!cameraError && faceDetected ? 'ok' : 'error'}>
              {!cameraError && faceDetected ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
            </StatusIcon>
            <StatusText>
              {cameraError ? 'Camera not available' : 
               faceDetected ? 'Face properly detected' : 'Face not detected'}
            </StatusText>
          </StatusItem>
          
          <StatusItem status={!multipleFaces ? 'ok' : 'error'}>
            <StatusIcon status={!multipleFaces ? 'ok' : 'error'}>
              {!multipleFaces ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
            </StatusIcon>
            <StatusText>
              {!multipleFaces ? 'Single person detected' : 'Multiple people detected'}
            </StatusText>
          </StatusItem>
          
          {warnings.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4>Recent Warnings ({warnings.length})</h4>
              <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '10px' }}>
                {warnings.slice(-5).reverse().map(warning => (
                  <div key={warning.id} style={{ fontSize: '0.85rem', marginBottom: '8px', padding: '8px', backgroundColor: 'rgba(255, 190, 11, 0.1)', borderRadius: '4px' }}>
                    <div style={{ fontWeight: '500' }}>{warning.message}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(warning.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ProctoringSidebar>
      </ExamContent>
    </ExamContainer>
  );
};

export default ExamInterface;