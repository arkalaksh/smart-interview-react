import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { generateRoomId, generateCandidateLink, generateInterviewerLink } from '../utils/roomUtils';

const RoomSelection = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState('main');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [candidateLink, setCandidateLink] = useState('');
  const [interviewerLink, setInterviewerLink] = useState('');
  const [candidateLinkCopied, setCandidateLinkCopied] = useState(false);
  const [interviewerLinkCopied, setInterviewerLinkCopied] = useState(false);
  const [savedToCalendar, setSavedToCalendar] = useState(false);


const user = JSON.parse(localStorage.getItem('user') || '{}');
const userId = user.id || null;
const userName = user.full_name || '';  

// Check if user is valid
if (!userId || !userName) {
  alert('User not authenticated or user data missing. Please login again.');
  return null; // Or redirect to login page
}

// Then use userId and userName anywhere, for example:
console.log('User ID:', userId);
console.log('User Name:', userName);




  const handleCreateNewRoom = () => {
    console.log('📅 Opening calendar for date selection...');
    setCurrentStep('calendar');
  };

  const handleDateSelect = (date) => {
    console.log('📆 Selected date:', date);

    setSelectedDate(date);

    const newRoomId = generateRoomId();
    const candLink = generateCandidateLink(newRoomId);
    const intLink = generateInterviewerLink(newRoomId);

    setGeneratedRoomId(newRoomId);
    setCandidateLink(candLink);
    setInterviewerLink(intLink);

    console.log('🔐 Generated Room ID:', newRoomId);
    setCurrentStep('links');
  };

  const copyCandidateLink = () => {
    navigator.clipboard.writeText(candidateLink).then(() => {
      setCandidateLinkCopied(true);
      setTimeout(() => setCandidateLinkCopied(false), 2500);
    });
  };

  const copyInterviewerLink = () => {
    navigator.clipboard.writeText(interviewerLink).then(() => {
      setInterviewerLinkCopied(true);
      setTimeout(() => setInterviewerLinkCopied(false), 2500);
    });
  };

  // API POST to save interview room data in DB
// Saves the current interview room data to the backend
const handleSaveToDatabase = async () => {
  // Generate actual tokens (replace with secure token generation or UUID)
  // const candidateToken = 'candidate-secure-token'; 
  // const interviewerToken = 'interviewer-secure-token';

  const interviewData = {
    roomId: generatedRoomId,
    scheduledDate: selectedDate.toISOString(),
    candidateLink,
    // candidateToken,
    interviewerLink,
    // interviewerToken,
    createdByHrId: userId,  // use extracted userId variable
    status: 'scheduled'
  };

  console.log('📦 Sending interview data to backend:', interviewData);

  try {
    const response = await fetch('http://localhost:5000/api/auth/interview-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interviewData),
    });

    const data = await response.json();

    if (response.ok) {
      alert('✅ Interview scheduled and saved successfully!');
      return true;
    } else {
      alert(`❌ Failed to save interview: ${data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    alert(`❌ Network error: ${error.message}`);
    return false;
  }
};

// Fetches saved interviews, stores them, and navigates to calendar view
const handleViewInCalendar = async () => {
  // First save interview; if fails, do not proceed
  const saved = await handleSaveToDatabase();
  if (!saved) return;

  try {
    // Fetch all interview rooms for current user to display in calendar
const response = await fetch(`http://localhost:5000/api/auth/interview-rooms/user/${userId}`);
    if (response.ok) {
      const interviews = await response.json();
      console.log('Fetched scheduled interviews:', interviews);

      // Save interviews in localStorage for calendar page
      localStorage.setItem('scheduledInterviews', JSON.stringify(interviews));

      setSavedToCalendar(true);
      navigate('/calendar-view');
    } else {
      alert('Interview room data not found. Redirecting to calendar.');
      navigate('/calendar-view');
    }
  } catch (error) {
    console.error('Error fetching interview rooms:', error);
    alert('Network error fetching interviews. Redirecting to calendar.');
    navigate('/calendar-view');
  }
};


  const handleBackToMain = () => {
    setCurrentStep('main');
    setGeneratedRoomId('');
    setCandidateLink('');
    setInterviewerLink('');
    setSavedToCalendar(false);
  };

  const handleBackToCalendar = () => {
    setCurrentStep('calendar');
  };

  // STEP 3: Links display and actions
  if (currentStep === 'links') {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.modernContainer}>
          <div style={styles.modernHeader}>
            <button onClick={handleBackToCalendar} style={styles.backButton}>
              ← Back
            </button>
            <h2 style={styles.modernTitle}>Interview Scheduled</h2>
            <div style={{ width: '80px' }}></div>
          </div>

          <div style={styles.infoCard}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>📅 Date & Time</span>
              <span style={styles.infoValue}>
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })} at {selectedDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div style={styles.divider}></div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>🔑 Meeting ID</span>
              <span style={styles.meetingId}>{generatedRoomId}</span>
            </div>
          </div>

          <div style={styles.linkSection}>
            <h3 style={styles.sectionTitle}>Invitation Links</h3>

            <div style={styles.linkCard}>
              <div style={styles.linkCardHeader}>
                <div style={styles.avatarCircle} data-role="candidate">C</div>
                <div>
                  <h4 style={styles.linkCardTitle}>Candidate Link</h4>
                  <p style={styles.linkCardSubtitle}>Share this with the interview candidate</p>
                </div>
              </div>
              <div style={styles.linkInputWrapper}>
                <input
                  type="text"
                  value={candidateLink}
                  readOnly
                  onClick={e => e.target.select()}
                  style={styles.modernInput}
                />
                <button onClick={copyCandidateLink} style={styles.copyButton}>
                  {candidateLinkCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={styles.linkCard}>
              <div style={styles.linkCardHeader}>
                <div style={styles.avatarCircle} data-role="interviewer">I</div>
                <div>
                  <h4 style={styles.linkCardTitle}>Interviewer Link</h4>
                  <p style={styles.linkCardSubtitle}>Share with HR team and interviewers</p>
                </div>
              </div>
              <div style={styles.linkInputWrapper}>
                <input
                  type="text"
                  value={interviewerLink}
                  readOnly
                  onClick={e => e.target.select()}
                  style={styles.modernInput}
                />
                <button onClick={copyInterviewerLink} style={styles.copyButton}>
                  {interviewerLinkCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div style={styles.actionButtons}>
            <button onClick={handleViewInCalendar} style={styles.primaryButton}>
              {savedToCalendar ? '✓ Saved to Calendar' : 'View in Calendar'}
            </button>
            <button onClick={handleSaveToDatabase} style={styles.secondaryButton}>
              Save to Database
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: Calendar Selection
  if (currentStep === 'calendar') {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.modernContainer}>
          <div style={styles.modernHeader}>
            <button onClick={handleBackToMain} style={styles.backButton}>
              ← Back
            </button>
            <h2 style={styles.modernTitle}>Schedule Interview</h2>
            <div style={{ width: '80px' }}></div>
          </div>

          <p style={styles.instructionText}>Select a date and time for the interview</p>

          <div style={styles.calendarContainer}>
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              minDate={new Date()}
              className="modern-calendar"
            />
          </div>

          <div style={styles.selectedDateDisplay}>
            <span style={styles.selectedLabel}>Selected:</span>
            <span style={styles.selectedValue}>
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>

          <button onClick={() => handleDateSelect(selectedDate)} style={styles.continueButton}>
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // STEP 1: Main Dashboard
  return (
    <div style={styles.pageWrapper}>
      <div style={styles.modernContainer}>
        <div style={styles.topNav}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>🎯</div>
            <span style={styles.logoText}>Interview Hub</span>
          </div>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{userName}</span>
<div style={styles.userAvatar}>{userName.charAt(0)}</div>
<h1 style={styles.welcomeTitle}>
  Welcome back, {userName?.split(' ')[0] || 'Guest'}
</h1>

          </div>
        </div>

        <div style={styles.cardGrid}>
          <div style={styles.primaryCard} onClick={handleCreateNewRoom}>
            <div style={styles.cardIcon}>➕</div>
            <h3 style={styles.cardTitle}>Schedule New Interview</h3>
            <p style={styles.cardDescription}>Create a new interview room with unique links</p>
            <div style={styles.cardArrow}>→</div>
          </div>

          <div style={styles.secondaryCard} onClick={() => navigate('/calendar-view')}>
            <div style={styles.cardIconSecondary}>📅</div>
            <h3 style={styles.cardTitleSecondary}>View Calendar</h3>
            <p style={styles.cardDescriptionSecondary}>See all scheduled interviews</p>
            <div style={styles.cardArrowSecondary}>→</div>
          </div>
        </div>
      </div>
    </div>
  );
};



const styles = {
  pageWrapper: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #f8f9fb 0%, #e9ecef 100%)',
    padding: '0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  modernContainer: {
    maxWidth: '1000px',
    margin: '0 auto',
    backgroundColor: 'white',
    minHeight: '100vh',
    boxShadow: '0 0 50px rgba(0,0,0,0.08)'
  },
  topNav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    borderBottom: '1px solid #e9ecef'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoIcon: {
    fontSize: '28px'
  },
  logoText: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#495057'
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '16px'
  },
  welcomeSection: {
    padding: '40px 40px 30px',
    borderBottom: '1px solid #e9ecef'
  },
  welcomeTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: '0 0 8px 0'
  },
  welcomeSubtitle: {
    fontSize: '16px',
    color: '#6c757d',
    margin: 0
  },
  cardGrid: {
    padding: '40px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px'
  },
  primaryCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px',
    padding: '32px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 30px rgba(102, 126, 234, 0.4)'
    }
  },
  cardIcon: {
    fontSize: '40px',
    marginBottom: '16px'
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'white',
    margin: '0 0 8px 0'
  },
  cardDescription: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.9)',
    margin: 0,
    lineHeight: '1.5'
  },
  cardArrow: {
    position: 'absolute',
    top: '32px',
    right: '32px',
    fontSize: '24px',
    color: 'white',
    fontWeight: '700'
  },
  secondaryCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px',
    cursor: 'pointer',
    border: '2px solid #e9ecef',
    position: 'relative',
    transition: 'all 0.2s'
  },
  cardIconSecondary: {
    fontSize: '40px',
    marginBottom: '16px'
  },
  cardTitleSecondary: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: '0 0 8px 0'
  },
  cardDescriptionSecondary: {
    fontSize: '14px',
    color: '#6c757d',
    margin: 0,
    lineHeight: '1.5'
  },
  cardArrowSecondary: {
    position: 'absolute',
    top: '32px',
    right: '32px',
    fontSize: '24px',
    color: '#667eea',
    fontWeight: '700'
  },
  featuresSection: {
    padding: '0 40px 40px'
  },
  featuresTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: '20px'
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px'
  },
  featureItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '20px',
    background: '#f8f9fb',
    borderRadius: '12px',
    border: '1px solid #e9ecef'
  },
  featureIcon: {
    fontSize: '28px'
  },
  featureText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#495057',
    textAlign: 'center'
  },
  modernHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 40px',
    borderBottom: '1px solid #e9ecef'
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: '#495057',
    transition: 'all 0.2s'
  },
  modernTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: 0
  },
  instructionText: {
    textAlign: 'center',
    padding: '24px 40px',
    fontSize: '15px',
    color: '#6c757d',
    margin: 0
  },
  calendarContainer: {
    padding: '0 40px 24px',
    display: 'flex',
    justifyContent: 'center'
  },
  selectedDateDisplay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '0 40px 24px'
  },
  selectedLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#6c757d'
  },
  selectedValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  continueButton: {
    width: 'calc(100% - 80px)',
    margin: '0 40px 40px',
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
  },
  infoCard: {
    margin: '24px 40px',
    padding: '24px',
    background: '#f8f9fb',
    borderRadius: '12px',
    border: '1px solid #e9ecef'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0'
  },
  infoLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#6c757d'
  },
  infoValue: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  meetingId: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#667eea',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  divider: {
    height: '1px',
    background: '#dee2e6',
    margin: '8px 0'
  },
  linkSection: {
    padding: '0 40px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: '20px'
  },
  linkCard: {
    background: 'white',
    border: '2px solid #e9ecef',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '16px',
    transition: 'all 0.2s'
  },
  linkCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  avatarCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '700',
    color: 'white',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  linkCardTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1a2e',
    margin: '0 0 4px 0'
  },
  linkCardSubtitle: {
    fontSize: '13px',
    color: '#6c757d',
    margin: 0
  },
  linkInputWrapper: {
    display: 'flex',
    gap: '12px'
  },
  modernInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '13px',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fb',
    color: '#495057'
  },
  copyButton: {
    padding: '12px 24px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap'
  },
  actionButtons: {
    display: 'flex',
    gap: '16px',
    padding: '24px 40px 40px'
  },
  primaryButton: {
    flex: 1,
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
  },
  secondaryButton: {
    flex: 1,
    padding: '16px',
    background: 'white',
    color: '#667eea',
    border: '2px solid #667eea',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

// Enhanced Calendar Styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .modern-calendar {
    border: none !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    width: 100% !important;
    max-width: 450px !important;
    background: white !important;
    border-radius: 12px !important;
    overflow: hidden !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08) !important;
  }

  .modern-calendar .react-calendar__navigation {
    background: #f8f9fb !important;
    margin-bottom: 0 !important;
    padding: 16px !important;
    border-bottom: 1px solid #e9ecef !important;
  }

  .modern-calendar .react-calendar__navigation button {
    font-size: 16px !important;
    font-weight: 700 !important;
    color: #1a1a2e !important;
    min-width: 44px !important;
  }

  .modern-calendar .react-calendar__navigation button:enabled:hover {
    background-color: #e9ecef !important;
    border-radius: 8px !important;
  }

  .modern-calendar .react-calendar__month-view__weekdays {
    background: #f8f9fb !important;
    padding: 12px 0 !important;
    text-transform: uppercase !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #6c757d !important;
  }

  .modern-calendar .react-calendar__month-view__days {
    padding: 8px !important;
  }

  .modern-calendar .react-calendar__tile {
    padding: 16px 8px !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    transition: all 0.2s !important;
  }

  .modern-calendar .react-calendar__tile:enabled:hover {
    background-color: #f0f4ff !important;
    color: #667eea !important;
  }

  .modern-calendar .react-calendar__tile--active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    font-weight: 700 !important;
  }

  .modern-calendar .react-calendar__tile--now {
    background: #fff3cd !important;
    color: #856404 !important;
    font-weight: 700 !important;
  }

  .modern-calendar .react-calendar__tile--now:enabled:hover {
    background: #ffe69c !important;
  }

  .modern-calendar .react-calendar__month-view__days__day--weekend {
    color: #dc3545 !important;
  }

  /* Hover effects for cards */
  [style*="primaryCard"]:hover {
    transform: translateY(-4px) !important;
    box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4) !important;
  }

  [style*="secondaryCard"]:hover {
    border-color: #667eea !important;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15) !important;
  }

  [style*="copyButton"]:hover {
    background: #5568d3 !important;
    transform: translateY(-1px) !important;
  }

  [style*="backButton"]:hover {
    background: #f8f9fb !important;
    border-color: #adb5bd !important;
  }

  [style*="continueButton"]:hover,
  [style*="primaryButton"]:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 24px rgba(102, 126, 234, 0.4) !important;
  }

  [style*="secondaryButton"]:hover {
    background: #f0f4ff !important;
  }

  [data-role="candidate"] {
    background: linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%) !important;
  }

  [data-role="interviewer"] {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  }
`;
document.head.appendChild(styleSheet);

export default RoomSelection;
