import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import RoomSelection from './components/RoomSelection';
import CandidateView from './components/CandidateView';
import InterviewerView from './components/InterviewerView';

// Wrapper for CandidateView to extract roomId from URL
const CandidateViewWrapper = () => {
  const { roomId } = useParams();
  
  // Get user from localStorage or use default
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest"}');
  
  return <CandidateView roomId={roomId} userName={user.name} />;
};

// Wrapper for InterviewerView
const InterviewerViewWrapper = () => {
  const { roomId } = useParams();
  
  // Get user from localStorage or use default
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Interviewer"}');
  
  return <InterviewerView roomId={roomId} userName={user.name} />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Room Selection Page - Default landing (NO AUTH REQUIRED) */}
        <Route path="/" element={<RoomSelection />} />
        <Route path="/interview" element={<RoomSelection />} />
        
        {/* Candidate Interview Page */}
        <Route 
          path="/interview/candidate/:roomId" 
          element={<CandidateViewWrapper />} 
        />
        
        {/* Interviewer Interview Page */}
        <Route 
          path="/interview/interviewer/:roomId" 
          element={<InterviewerViewWrapper />} 
        />
        
        {/* Redirect unknown routes to room selection */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
