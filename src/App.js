import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom';
import RoomSelection from './components/RoomSelection';
import CandidateView from './components/CandidateView';
import InterviewerView from './components/InterviewerView';
import HRSignupPage from './components/HRSignupPage';
import HRLoginPage from './components/HRLoginPage';
import CalendarView from './components/CalendarView';
import WelcomePage from './components/WelcomePage';

// Wrapper for CandidateView to extract roomId from URL
const CandidateViewWrapper = () => {
  const { roomId } = useParams();
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest"}');
  return <CandidateView roomId={roomId} userName={user.name} />;
};

// Wrapper for InterviewerView
const InterviewerViewWrapper = () => {
  const { roomId } = useParams();
  const user = JSON.parse(
    localStorage.getItem('user') || '{"name":"Interviewer"}'
  );
  return <InterviewerView roomId={roomId} userName={user.name} />;
};

// Auth Guard Component - Controls access based on login status
const AuthGuard = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in by looking for user data in localStorage
    const user = localStorage.getItem('user');
    setIsAuthenticated(!!user && user !== '{"name":"Guest"}');
    setIsLoading(false);
  }, []);

  // Show loading state briefly
  if (isLoading) {
    return <div>Checking authentication...</div>;
  }

  // If not authenticated, redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render children (RoomSelection or other protected routes)
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Welcome page - Public, first landing */}
        <Route path="/" element={<WelcomePage />} />

        {/* Auth pages - Public (signup & login) */}
        <Route path="/signup" element={<HRSignupPage />} />
        <Route path="/login" element={<HRLoginPage />} />

        {/* Protected Routes - Only accessible after login */}
        <Route
          path="/interview"
          element={
            <AuthGuard>
              <RoomSelection />
            </AuthGuard>
          }
        />
        <Route
          path="/calendar-view"
          element={
            <AuthGuard>
              <CalendarView />
            </AuthGuard>
          }
        />

        {/* Interview Pages - Direct access allowed */}
        <Route
          path="/interview/candidate/:roomId"
          element={<CandidateViewWrapper />}
        />
        <Route
          path="/interview/interviewer/:roomId"
          element={<InterviewerViewWrapper />}
        />

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
