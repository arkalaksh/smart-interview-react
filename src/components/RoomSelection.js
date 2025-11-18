import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateRoomId, generateCandidateLink } from '../utils/roomUtils';

const RoomSelection = () => {
  const navigate = useNavigate();
  
  // For interviewer flow
  const [showInterviewerSetup, setShowInterviewerSetup] = useState(false);
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [candidateLink, setCandidateLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Guest User"}');

  console.log('🏠 Room Selection Page - User:', user.name);

  const handleCreateRoom = () => {
    console.log('👨‍💼 Creating interviewer room...');
    
    const newRoomId = generateRoomId();
    const link = generateCandidateLink(newRoomId);
    
    setGeneratedRoomId(newRoomId);
    setCandidateLink(link);
    setShowInterviewerSetup(true);
    
    console.log('🔐 Generated room for interviewer:', newRoomId);
    console.log('🔗 Candidate link:', link);
  };

  const handleStartInterview = () => {
    console.log('▶️ Interviewer entering room:', generatedRoomId);
    navigate(`/interview/interviewer/${generatedRoomId}`);
  };

  const copyToClipboard = () => {
    console.log('📋 Copying link to clipboard...');
    navigator.clipboard.writeText(candidateLink).then(() => {
      setLinkCopied(true);
      console.log('✅ Link copied!');
      setTimeout(() => setLinkCopied(false), 3000);
    }).catch(err => {
      console.error('❌ Failed to copy:', err);
    });
  };

  const shareViaEmail = () => {
    const subject = 'Interview Invitation - Join Now';
    const body = `Hi,\n\nYou have been invited to an interview.\n\nPlease click the link below to join:\n${candidateLink}\n\nRoom ID: ${generatedRoomId}\n\nBest regards,\n${user.name}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    console.log('📧 Opening email client...');
  };

  const handleBackToSelection = () => {
    console.log('⬅️ Back to main screen');
    setShowInterviewerSetup(false);
    setGeneratedRoomId('');
    setCandidateLink('');
    setLinkCopied(false);
  };

  // Interviewer Setup View
  if (showInterviewerSetup) {
    return (
      <div style={styles.container}>
        <div style={{...styles.box, maxWidth: '600px'}}>
          {/* Header */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px'}}>
            <h2 style={{margin: 0, fontSize: '24px', fontWeight: '700', color: '#1a1a2e'}}>
              🎯 Interview Room Created
            </h2>
            <button
              onClick={handleBackToSelection}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                color: '#64748b',
                transition: 'all 0.2s'
              }}
            >
              ← Back
            </button>
          </div>

          {/* Room ID Display */}
          <div style={{
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '2px solid #e2e8f0'
          }}>
            <p style={{fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '600'}}>
              🔐 Room ID:
            </p>
            <code style={{
              display: 'block',
              padding: '12px',
              backgroundColor: '#fff',
              borderRadius: '6px',
              fontSize: '13px',
              wordBreak: 'break-all',
              border: '1px solid #e2e8f0',
              color: '#1e293b',
              fontFamily: 'monospace',
              fontWeight: '600',
              letterSpacing: '1px'
            }}>
              {generatedRoomId}
            </code>
          </div>

          {/* Candidate Link Section */}
          <div style={{
            padding: '20px',
            backgroundColor: '#eff6ff',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '2px solid #bfdbfe'
          }}>
            <p style={{fontSize: '14px', color: '#1e40af', marginBottom: '12px', fontWeight: '700'}}>
              📧 Candidate Invitation Link:
            </p>
            <input
              type="text"
              value={candidateLink}
              readOnly
              onClick={(e) => e.target.select()}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '12px',
                border: '1px solid #93c5fd',
                borderRadius: '6px',
                marginBottom: '12px',
                fontFamily: 'monospace',
                backgroundColor: 'white',
                boxSizing: 'border-box',
                cursor: 'pointer',
                color: '#1e293b'
              }}
            />
            <div style={{display: 'flex', gap: '10px'}}>
              <button
                onClick={copyToClipboard}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: linkCopied ? '#10b981' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.3s ease'
                }}
              >
                {linkCopied ? '✅ Copied!' : '📋 Copy Link'}
              </button>
              <button
                onClick={shareViaEmail}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                📧 Email
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div style={{
            padding: '16px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #fde68a'
          }}>
            <p style={{margin: 0, fontSize: '13px', color: '#92400e', lineHeight: '1.6'}}>
              💡 <strong>Next Steps:</strong>
              <br />
              1. Copy and share the link with the candidate
              <br />
              2. Wait for the candidate to join
              <br />
              3. Click "Enter Interview Room" to start
            </p>
          </div>

          {/* Start Interview Button */}
          <button
            onClick={handleStartInterview}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '16px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.2s ease',
              letterSpacing: '0.3px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            }}
          >
            ▶️ Enter Interview Room
          </button>
        </div>
      </div>
    );
  }

  // Main Interviewer Landing Page
  return (
    <div style={styles.container}>
      <div style={styles.box}>
        {/* Header Section */}
        <div style={styles.header}>
          <div style={styles.iconCircle}>🎥</div>
          <h1 style={styles.title}>AI Interview Platform</h1>
          <p style={styles.subtitle}>
            Create a secure interview room with AI-powered monitoring
          </p>
        </div>

        {/* Welcome Message */}
        <div style={{
          padding: '20px',
          backgroundColor: '#f0fdf4',
          borderRadius: '12px',
          marginBottom: '30px',
          border: '2px solid #86efac'
        }}>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            color: '#065f46',
            fontWeight: '700'
          }}>
            👨‍💼 Interviewer Portal
          </h3>
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: '#064e3b',
            lineHeight: '1.6'
          }}>
            Create a new interview room and invite candidates with a secure, non-guessable link.
          </p>
        </div>

        {/* Create Room Button */}
        <button
          onClick={handleCreateRoom}
          style={{
            width: '100%',
            padding: '18px',
            fontSize: '16px',
            fontWeight: '700',
            color: 'white',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            letterSpacing: '0.3px',
            marginBottom: '25px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
          }}
        >
          ➕ Create New Interview Room
        </button>

        {/* Features Box */}
        {/* <div style={{
          padding: '16px',
          backgroundColor: '#f0f4ff',
          borderRadius: '10px',
          border: '1px solid #c7d2fe'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '13px',
            color: '#4338ca',
            fontWeight: '700'
          }}>
            🔐 Platform Features
          </h3>
          <ul style={{
            margin: 0,
            paddingLeft: '18px',
            fontSize: '12px',
            color: '#64748b',
            lineHeight: '1.8'
          }}>
            <li>🔒 Non-guessable room IDs for security</li>
            <li>🤖 Real-time AI speech analysis</li>
            <li>👁️ Eye gaze tracking & monitoring</li>
            <li>🚨 Tab switch detection alerts</li>
            <li>📹 HD video & audio streaming</li>
            <li>📊 Live candidate behavior monitoring</li>
          </ul>
        </div> */}

        {/* Footer Note */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          border: '1px solid #fde68a',
          textAlign: 'center'
        }}>
          <p style={{
            margin: 0,
            fontSize: '11px',
            color: '#92400e',
            fontWeight: '600'
          }}>
            💡 Candidates will receive a unique link to join the interview
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  box: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '45px 40px',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '35px'
  },
  iconCircle: {
    width: '70px',
    height: '70px',
    margin: '0 auto 20px',
    backgroundColor: '#f0f4ff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    margin: 0,
    fontSize: '15px',
    color: '#64748b'
  }
};

// Add hover effects
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  button:hover {
    transform: translateY(-2px);
  }
`;
document.head.appendChild(styleSheet);

export default RoomSelection;
