import React, { useState, useEffect } from 'react';
import {
  HashRouter as Router,
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

// ✅ NEW: Environment-based config
const getConfig = () => {
  const isProduction = window.location.hostname !== 'localhost' && 
                      window.location.hostname !== '127.0.0.1' && 
                      !window.location.hostname.includes('localhost');
  
  return {
    SOCKET_URL: isProduction 
      ? 'https://darkcyan-hornet-746720.hostingersite.com'
      : 'http://localhost:5000',
    API_BASE_URL: isProduction 
      ? 'https://darkcyan-hornet-746720.hostingersite.com/api'
      : 'http://localhost:5000/api',
    isProduction
  };
};

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

// ✅ UPDATED: Auth Guard with config
const AuthGuard = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem('user');
    setIsAuthenticated(!!user && user !== '{"name":"Guest"}');
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Checking authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// ✅ NEW: Config Provider Component
const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const configData = getConfig();
    setConfig(configData);
    
    // Set global window config for other components
    window.APP_CONFIG = configData;
    
    console.log('🚀 Environment:', configData.isProduction ? 'Production' : 'Development');
    console.log('📡 Socket URL:', configData.SOCKET_URL);
    console.log('🔗 API URL:', configData.API_BASE_URL);
  }, []);

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading app configuration...</div>
      </div>
    );
  }

  return <div data-config={JSON.stringify(config)}>{children}</div>;
};

function App() {
  return (
    <ConfigProvider>
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
    </ConfigProvider>
  );
}

export default App;
