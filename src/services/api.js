import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

// The backend does not run a socket.io server yet. Connecting on import makes
// the client poll /socket.io/ forever, retrying on every 404. Stay offline
// until proctoringService.connectRealtime() is called; queued emits flush once
// a connection is established.
const socket = io(SOCKET_URL, { autoConnect: false });

// Create axios instance
const api = axios.create({
  baseURL: API_URL
});

// Exam services
export const examService = {
  getExams: async () => {
    const response = await api.get('/exams');
    return response.data.data;
  },
  
  getExamById: async (id, role = 'student') => {
    const response = await api.get(`/exams/${id}?role=${role}`);
    return response.data.data;
  },
  
  startExamSession: async (examId, studentName, studentEmail) => {
    const response = await api.post('/exams/sessions', { 
      examId, 
      studentName, 
      studentEmail 
    });
    return response.data.data;
  },
  
  // Face registration and server-side verification are not implemented. There
  // is no face storage in the schema and no recognition on the server, so face
  // checks run entirely client-side via face-api.js in useProctoring.

  submitAnswer: async (sessionId, questionId, optionId) => {
    const response = await api.post('/exams/answers', { sessionId, questionId, optionId });
    return response.data.data;
  },
  
  submitExam: async (sessionId) => {
    const response = await api.post(`/exams/sessions/${sessionId}/submit`);
    return response.data.data;
  },
  
  getExamResults: async (sessionId) => {
    const response = await api.get(`/exams/sessions/${sessionId}/results`);
    return response.data.data;
  }
};

// Proctoring services
export const proctoringService = {
  // Sent as JSON. `screenshot` is an optional image/jpeg data URL; the server
  // uploads it to a private bucket and stores only the path.
  logEvent: async (sessionId, eventType, details = {}, screenshot = null) => {
    const response = await api.post('/proctoring/log', {
      sessionId,
      eventType,
      details,
      screenshot
    });

    return response.data.data;
  },

  getSessionLogs: async (sessionId) => {
    const response = await api.get(`/proctoring/sessions/${sessionId}/logs`);
    return response.data.data;
  },
  
  getExamSessions: async (examId) => {
    const response = await api.get(`/proctoring/exams/${examId}/sessions`);
    return response.data.data;
  },
  
  // Socket.io methods
  // Call once a socket.io server is running on SOCKET_URL. Until then the
  // socket stays disconnected and emits are queued rather than sent.
  connectRealtime: () => {
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  },

  disconnectRealtime: () => {
    if (socket.connected) {
      socket.disconnect();
    }
  },

  joinExamSession: (sessionId) => {
    socket.emit('join-exam-session', sessionId);
  },
  
  joinProctorRoom: (examId) => {
    socket.emit('join-proctor-room', examId);
  },
  
  onProctoringEvent: (callback) => {
    socket.on('proctoring-event', callback);
    return () => socket.off('proctoring-event', callback);
  }
};

export default {
  exams: examService,
  proctoring: proctoringService,
  socket
};
