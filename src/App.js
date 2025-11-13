import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import AuthPage from './components/SignInPage';
import RoomSelection from './components/RoomSelection';
import CandidateView from './components/CandidateView';
 import InterviewerView from './components/InterviewerView';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return children;
};

// Wrapper for CandidateView to extract roomId from URL
const CandidateViewWrapper = () => {
  const { roomId } = useParams();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  return <CandidateView roomId={roomId} userName={user.name} />;
};

// Wrapper for InterviewerView
const InterviewerViewWrapper = () => {
  const { roomId } = useParams();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
   return <InterviewerView roomId={roomId} userName={user.name} />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Page - Default landing */}
        <Route path="/" element={<AuthPage />} />
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Room Selection Page - After login */}
        <Route 
          path="/interview" 
          element={
            <ProtectedRoute>
              <RoomSelection />
            </ProtectedRoute>
          } 
        />
        
        {/* Candidate Interview Page */}
        <Route 
          path="/interview/candidate/:roomId" 
          element={
            <ProtectedRoute>
              <CandidateViewWrapper />
            </ProtectedRoute>
          } 
        />
        
        {/* Interviewer Interview Page */}
        <Route 
          path="/interview/interviewer/:roomId" 
          element={
            <ProtectedRoute>
              <InterviewerViewWrapper />
            </ProtectedRoute>
          } 
        />
        
        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
