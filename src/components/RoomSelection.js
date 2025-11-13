import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RoomSelection = () => {
  const [roomId, setRoomId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
  };

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      setError('Please enter a Room ID');
      return;
    }

    if (!selectedRole) {
      setError('Please select your role');
      return;
    }

    navigate(`/interview/${selectedRole}/${roomId}`);
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        {/* Header Section */}
        <div style={styles.header}>
          <div style={styles.iconCircle}>🎥</div>
          <h1 style={styles.title}>Interview Platform</h1>
          <p style={styles.subtitle}>
            Welcome back, <span style={styles.userName}>{user.name}</span>
          </p>
        </div>

        {/* Role Selection Section */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Select Your Role</h3>
          <div style={styles.roleContainer}>
            <button
              onClick={() => handleRoleSelect('candidate')}
              style={{
                ...styles.roleButton,
                ...(selectedRole === 'candidate' ? styles.candidateActive : {})
              }}
            >
              <div style={styles.roleLabel}>Candidate</div>
              <div style={styles.roleDescription}>Join as interviewee</div>
            </button>

            <button
              onClick={() => handleRoleSelect('interviewer')}
              style={{
                ...styles.roleButton,
                ...(selectedRole === 'interviewer' ? styles.interviewerActive : {})
              }}
            >
              <div style={styles.roleLabel}>Interviewer</div>
              <div style={styles.roleDescription}>Conduct interview</div>
            </button>
          </div>
        </div>

        {/* Room ID Section */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Enter Room ID</h3>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            placeholder="Enter Room ID"
            style={styles.input}
            maxLength={10}
          />
          <p style={styles.hint}>Enter the room ID provided by the interviewer</p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={styles.errorBox}>
            <span style={styles.errorIcon}>⚠</span>
            {error}
          </div>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoinRoom}
          style={{
            ...styles.joinButton,
            ...((!roomId || !selectedRole) ? styles.joinButtonDisabled : {})
          }}
          disabled={!roomId || !selectedRole}
        >
          {selectedRole ? `Join as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}` : 'Join Interview Room'}
        </button>
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
  },
  userName: {
    fontWeight: '600',
    color: '#667eea'
  },
  section: {
    marginBottom: '28px'
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#334155',
    letterSpacing: '0.3px'
  },
  roleContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  roleButton: {
    padding: '20px 16px',
    backgroundColor: '#f8fafc',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textAlign: 'center'
  },
  candidateActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
  },
  interviewerActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
  },
  roleLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '4px'
  },
  roleDescription: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '4px'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    fontWeight: '600',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    outline: 'none',
    textAlign: 'center',
    letterSpacing: '2px',
    color: '#1e293b',
    transition: 'border-color 0.2s',
    backgroundColor: '#fafafa',
    boxSizing: 'border-box',
    marginBottom: '8px'
  },
  hint: {
    margin: '0',
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center'
  },
  errorBox: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#dc2626',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  errorIcon: {
    fontSize: '16px'
  },
  joinButton: {
    width: '100%',
    padding: '16px',
    fontSize: '16px',
    fontWeight: '700',
    color: 'white',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
    letterSpacing: '0.3px'
  },
  joinButtonDisabled: {
    background: '#cbd5e1',
    cursor: 'not-allowed',
    boxShadow: 'none'
  }
};

// Add hover effects
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  button:not(:disabled):hover {
    transform: translateY(-2px);
  }
  input:focus {
    border-color: #667eea !important;
  }
`;
document.head.appendChild(styleSheet);

export default RoomSelection;
