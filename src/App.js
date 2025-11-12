import React, { useState } from 'react';
import CandidateView from './components/CandidateView';
import InterviewerView from './components/InterviewerView';
import './App.css';

function App() {
  const [view, setView] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');

  if (view === 'candidate') {
    return <CandidateView roomId={roomId} userName={userName} />;
  }

  if (view === 'interviewer') {
    return <InterviewerView roomId={roomId} userName={userName} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f2f5',
      fontFamily: 'Arial'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        width: '400px'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
          Interview Platform
        </h1>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Your Name:
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '5px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Room ID:
          </label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="e.g., interview-123"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '5px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={() => setView('interviewer')}
            disabled={!userName.trim() || !roomId.trim()}
            style={{
              padding: '15px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: userName.trim() && roomId.trim() ? 'pointer' : 'not-allowed',
              opacity: userName.trim() && roomId.trim() ? 1 : 0.6
            }}
          >
            Join as Interviewer
          </button>

          <button
            onClick={() => setView('candidate')}
            disabled={!userName.trim() || !roomId.trim()}
            style={{
              padding: '15px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: userName.trim() && roomId.trim() ? 'pointer' : 'not-allowed',
              opacity: userName.trim() && roomId.trim() ? 1 : 0.6
            }}
          >
            Join as Candidate
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
