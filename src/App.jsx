// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import StudentLogin from './pages/StudentLogin';
import StudentSignIn from './pages/StudentSignIn';
import AdminLogin from './pages/AdminLogin';
import AdminSignIn from './pages/AdminSignIn';
import LandingPage from './pages/LandingPage';
import GlobalStyles from './styles/GlobalStyles';
import ExamInterface from './components/exam/ExamInterface';
import ProctorDashboard from './components/dashboard/ProctorDashboard';
import ProtectedRoute from './components/ProtectedRoute';

// ✅ ADD THIS LINE (NEW)
import ExamSetup from './pages/ExamSetup';

function App() {
  return (
    <Router>
      <GlobalStyles />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/student-signin" element={<StudentSignIn />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-signin" element={<AdminSignIn />} />

        {/* ✅ NEW SETUP PAGE */}
        <Route
          path="/exam-setup"
          element={
            <ProtectedRoute role="student">
              <ExamSetup />
            </ProtectedRoute>
          }
        />

        {/* EXISTING EXAM ROUTE (UNCHANGED) */}
        <Route
          path="/exam"
          element={
            <ProtectedRoute role="student">
              <ExamInterface />
            </ProtectedRoute>
          }
        />

        {/* EXISTING ADMIN ROUTE (UNCHANGED) */}
        <Route
          path="/proctor"
          element={
            <ProtectedRoute role="admin">
              <ProctorDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;