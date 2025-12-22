import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  generateRoomId,
  generateCandidateLink,
  generateInterviewerLink,
} from '../utils/roomUtils';

const API_BASE =
  process.env.REACT_APP_API_BASE || 'http://localhost:5000';

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

  // stats state
  const [todayInterviews, setTodayInterviews] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [totalInterviews, setTotalInterviews] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user.id || null;
  const userName = user.full_name || '';
  const isValidUser = !!userId && !!userName;

  // fetch HR stats for card (based on created_by_hr_id)
  useEffect(() => {
    if (!isValidUser) return;

    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const res = await fetch(
          `${API_BASE}/api/auth/interview-rooms/stats/${userId}`
        );
        if (!res.ok) {
          console.error('Stats API not ok', res.status);
          return;
        }
        const data = await res.json();
        console.log('HR stats response:', data);

        setTodayInterviews(data.interviews_today || 0);
        setPendingInvites(data.pending_invites || 0);
        setTotalInterviews(data.total_interviews || 0);
      } catch (err) {
        console.error('Error fetching HR stats', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [isValidUser, userId]);

  const handleCreateNewRoom = () => {
    setCurrentStep('calendar');
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);

    const newRoomId = generateRoomId();
    const candLink = generateCandidateLink(newRoomId);
    const intLink = generateInterviewerLink(newRoomId);

    setGeneratedRoomId(newRoomId);
    setCandidateLink(candLink);
    setInterviewerLink(intLink);
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

  const handleSaveToDatabase = async () => {
    const interviewData = {
      roomId: generatedRoomId,
      scheduledDate: selectedDate.toISOString(),
      candidateLink,
      interviewerLink,
      createdByHrId: userId,
      status: 'SCHEDULED',
    };

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/interview-rooms`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(interviewData),
        }
      );

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

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('scheduledInterviews');
      navigate('/login');
    }
  };

  // final auth guard (after hooks)
  if (!isValidUser) {
    alert('User not authenticated or user data missing. Please login again.');
    navigate('/login');
    return null;
  }

  const handleViewInCalendar = async () => {
    const saved = await handleSaveToDatabase();
    if (!saved) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/interview-rooms/user/${userId}`
      );
      if (response.ok) {
        const interviews = await response.json();
        localStorage.setItem(
          'scheduledInterviews',
          JSON.stringify(interviews)
        );
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
                  year: 'numeric',
                })}{' '}
                at{' '}
                {selectedDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
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
                <div style={styles.avatarCircle} data-role="candidate">
                  C
                </div>
                <div>
                  <h4 style={styles.linkCardTitle}>Candidate Link</h4>
                  <p style={styles.linkCardSubtitle}>
                    Share this with the interview candidate
                  </p>
                </div>
              </div>
              <div style={styles.linkInputWrapper}>
                <input
                  type="text"
                  value={candidateLink}
                  readOnly
                  onClick={(e) => e.target.select()}
                  style={styles.modernInput}
                />
                <button onClick={copyCandidateLink} style={styles.copyButton}>
                  {candidateLinkCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={styles.linkCard}>
              <div style={styles.linkCardHeader}>
                <div style={styles.avatarCircle} data-role="interviewer">
                  I
                </div>
                <div>
                  <h4 style={styles.linkCardTitle}>Interviewer Link</h4>
                  <p style={styles.linkCardSubtitle}>
                    Share with HR team and interviewers
                  </p>
                </div>
              </div>
              <div style={styles.linkInputWrapper}>
                <input
                  type="text"
                  value={interviewerLink}
                  readOnly
                  onClick={(e) => e.target.select()}
                  style={styles.modernInput}
                />
                <button
                  onClick={copyInterviewerLink}
                  style={styles.copyButton}
                >
                  {interviewerLinkCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div style={styles.actionButtons}>
            <button onClick={handleViewInCalendar} style={styles.primaryButton}>
              {savedToCalendar ? '✓ Saved to Calendar' : 'View in Calendar'}
            </button>
            <button
              onClick={handleSaveToDatabase}
              style={styles.secondaryButton}
            >
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

          <p style={styles.instructionText}>
            Select a date and time for the interview
          </p>

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
                year: 'numeric',
              })}
            </span>
          </div>

          <button
            onClick={() => handleDateSelect(selectedDate)}
            style={styles.continueButton}
          >
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
            <div>
              <div style={styles.userNameLabel}>Logged in as</div>
              <div style={styles.userNameBig}>{userName}</div>
            </div>
            <div style={styles.userAvatar}>{userName.charAt(0)}</div>
          </div>

          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>

        {/* Today’s overview stats card – improved UI */}
        <div style={{ padding: '24px 32px 0' }}>
          <div style={styles.statsWrapper}>
            <div style={styles.statsHeaderRow}>
              <div>
                <h3 style={styles.statsTitle}>Today’s overview</h3>
                <p style={styles.statsSubtitle}>
                  Quick snapshot of interviews you own
                </p>
              </div>
              <span style={styles.statsDateChip}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div style={styles.statsGrid}>
              <div
                onClick={() => navigate('/calendar-view')}
                style={{
                  ...styles.statsCard,
                  background:
                    'linear-gradient(135deg, rgba(129, 140, 248, 0.15), rgba(129, 230, 217, 0.12))',
                  borderColor: 'rgba(129, 140, 248, 0.5)',
                }}
              >
                <div style={styles.statsCardLabelRow}>
                  <span style={styles.statsCardLabel}>Interviews today</span>
                  <span style={{ ...styles.chip, backgroundColor: 'rgba(129,140,248,0.18)', color: '#4c51bf' }}>
                    Live
                  </span>
                </div>
                <div style={styles.statsValueRow}>
                  <span style={styles.statsValue}>
                    {statsLoading ? '…' : todayInterviews}
                  </span>
                </div>
                <p style={styles.statsHint}>
                  Click to see today’s slots in calendar
                </p>
              </div>

              <div
                onClick={() => navigate('/calendar-view')}
                style={{
                  ...styles.statsCard,
                  background:
                    'linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(248, 250, 252, 0.06))',
                  borderColor: 'rgba(245, 158, 11, 0.5)',
                }}
              >
                <div style={styles.statsCardLabelRow}>
                  <span style={styles.statsCardLabel}>Pending invites</span>
                  <span style={{ ...styles.chip, backgroundColor: 'rgba(245,158,11,0.18)', color: '#b45309' }}>
                    Scheduled
                  </span>
                </div>
                <div style={styles.statsValueRow}>
                  <span style={styles.statsValue}>
                    {statsLoading ? '…' : pendingInvites}
                  </span>
                </div>
                <p style={styles.statsHint}>
                  Interviews still in scheduled state
                </p>
              </div>

              <div style={{ ...styles.statsCard, opacity: statsLoading ? 0.7 : 1 }}>
                <div style={styles.statsCardLabelRow}>
                  <span style={styles.statsCardLabel}>Total created</span>
                  <span style={{ ...styles.chip, backgroundColor: 'rgba(16,185,129,0.16)', color: '#047857' }}>
                    All time
                  </span>
                </div>
                <div style={styles.statsValueRow}>
                  <span style={styles.statsValue}>
                    {statsLoading ? '…' : totalInterviews}
                  </span>
                </div>
                <p style={styles.statsHint}>
                  All interviews where you are the HR owner
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.cardGrid}>
          <div style={styles.primaryCard} onClick={handleCreateNewRoom}>
            <div style={styles.cardIcon}>➕</div>
            <h3 style={styles.cardTitle}>Schedule New Interview</h3>
            <p style={styles.cardDescription}>
              Create a new interview room with unique links
            </p>
            <div style={styles.cardArrow}>→</div>
          </div>

          <div
            style={styles.secondaryCard}
            onClick={() => navigate('/calendar-view')}
          >
            <div style={styles.cardIconSecondary}>📅</div>
            <h3 style={styles.cardTitleSecondary}>View Calendar</h3>
            <p style={styles.cardDescriptionSecondary}>
              See all scheduled interviews
            </p>
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
    background:
      'radial-gradient(circle at top left, #e0e7ff 0, transparent 55%), radial-gradient(circle at bottom right, #fcd9bd 0, #f8fafc 55%)',
    padding: 0,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  modernContainer: {
    maxWidth: '1100px',
    margin: '0 auto',
    backgroundColor: 'rgba(255,255,255,0.86)',
    minHeight: '100vh',
    boxShadow: '0 24px 80px rgba(15,23,42,0.18)',
    backdropFilter: 'blur(14px)',
    borderRadius: '28px',
    overflow: 'hidden',
  },
  topNav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    borderBottom: '1px solid rgba(226,232,240,0.8)',
    background:
      'linear-gradient(90deg, rgba(15,23,42,0.9), rgba(30,64,175,0.9))',
    color: 'white',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoIcon: {
    fontSize: '24px',
  },
  logoText: {
    fontSize: '19px',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userNameLabel: {
    fontSize: '11px',
    opacity: 0.8,
  },
  userNameBig: {
    fontSize: '14px',
    fontWeight: 600,
  },
  userAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background:
      'radial-gradient(circle at 30% 0, #facc15 0, transparent 55%), linear-gradient(135deg, #6366f1, #ec4899)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 700,
    fontSize: '17px',
    boxShadow: '0 8px 18px rgba(15,23,42,0.55)',
  },
  logoutButton: {
    marginLeft: '12px',
    padding: '8px 14px',
    backgroundColor: 'rgba(248,113,113,0.95)',
    color: '#fff',
    border: 'none',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(248,113,113,0.45)',
  },

  // Stats section
  statsWrapper: {
    background:
      'radial-gradient(circle at top left, rgba(129,140,248,0.22), transparent 55%), radial-gradient(circle at bottom right, rgba(45,212,191,0.18), transparent 55%)',
    borderRadius: '24px',
    padding: '20px 22px 18px',
    border: '1px solid rgba(148,163,184,0.35)',
    boxShadow: '0 20px 45px rgba(15,23,42,0.18)',
  },
  statsHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#0f172a',
  },
  statsSubtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#64748b',
  },
  statsDateChip: {
    fontSize: 11,
    padding: '6px 10px',
    borderRadius: '999px',
    border: '1px solid rgba(148,163,184,0.5)',
    color: '#0f172a',
    backgroundColor: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(6px)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '14px',
    marginTop: 16,
  },
  statsCard: {
    cursor: 'pointer',
    padding: '14px 14px 12px',
    borderRadius: '18px',
    border: '1px solid rgba(148,163,184,0.6)',
    backgroundColor: 'rgba(15,23,42,0.02)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '86px',
  },
  statsCardLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statsCardLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#0f172a',
  },
  chip: {
    fontSize: 10,
    padding: '4px 8px',
    borderRadius: '999px',
    fontWeight: 600,
  },
  statsValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  statsValue: {
    fontSize: 26,
    fontWeight: 700,
    color: '#0f172a',
  },
  statsHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748b',
  },

  cardGrid: {
    padding: '32px',
    display: 'grid',
    gridTemplateColumns: '1.3fr 1fr',
    gap: '22px',
  },
  primaryCard: {
    background: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)',
    borderRadius: '20px',
    padding: '26px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'transform 0.2s, boxShadow 0.2s',
    boxShadow: '0 18px 40px rgba(79,70,229,0.45)',
    color: 'white',
    overflow: 'hidden',
  },
  cardIcon: {
    fontSize: '32px',
    marginBottom: '10px',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 700,
    margin: '0 0 6px 0',
  },
  cardDescription: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.9)',
    margin: 0,
    lineHeight: 1.5,
  },
  cardArrow: {
    position: 'absolute',
    top: '20px',
    right: '22px',
    fontSize: '24px',
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 700,
  },
  secondaryCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '24px',
    cursor: 'pointer',
    border: '1px solid rgba(226,232,240,0.9)',
    position: 'relative',
    transition: 'all 0.2s',
    boxShadow: '0 10px 24px rgba(15,23,42,0.08)',
  },
  cardIconSecondary: {
    fontSize: '32px',
    marginBottom: '10px',
  },
  cardTitleSecondary: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 6px 0',
  },
  cardDescriptionSecondary: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.5,
  },
  cardArrowSecondary: {
    position: 'absolute',
    top: '18px',
    right: '20px',
    fontSize: '22px',
    color: '#4f46e5',
    fontWeight: 700,
  },

  modernHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    borderBottom: '1px solid #e9ecef',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '999px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    color: '#495057',
  },
  modernTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  instructionText: {
    textAlign: 'center',
    padding: '18px 32px 10px',
    fontSize: '14px',
    color: '#6c757d',
    margin: 0,
  },
  calendarContainer: {
    padding: '0 32px 18px',
    display: 'flex',
    justifyContent: 'center',
  },
  selectedDateDisplay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '0 32px 22px',
  },
  selectedLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#6c757d',
  },
  selectedValue: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#1a1a2e',
  },
  continueButton: {
    width: 'calc(100% - 64px)',
    margin: '0 32px 28px',
    padding: '14px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '999px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(79,70,229,0.4)',
  },
  infoCard: {
    margin: '18px 32px',
    padding: '20px',
    background: '#f8f9fb',
    borderRadius: '14px',
    border: '1px solid #e9ecef',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
  },
  infoLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#6c757d',
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a2e',
  },
  meetingId: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#4f46e5',
    fontFamily: 'monospace',
    letterSpacing: '1px',
  },
  divider: {
    height: '1px',
    background: '#dee2e6',
    margin: '8px 0',
  },
  linkSection: {
    padding: '0 32px',
  },
  sectionTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: '16px',
  },
  linkCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '14px',
  },
  linkCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '12px',
  },
  avatarCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 700,
    color: 'white',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  },
  linkCardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#1f2933',
    margin: '0 0 2px 0',
  },
  linkCardSubtitle: {
    fontSize: '12px',
    color: '#6c757d',
    margin: 0,
  },
  linkInputWrapper: {
    display: 'flex',
    gap: '10px',
  },
  modernInput: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '12px',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fb',
    color: '#495057',
  },
  copyButton: {
    padding: '10px 18px',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  actionButtons: {
    display: 'flex',
    gap: '14px',
    padding: '20px 32px 28px',
  },
  primaryButton: {
    flex: 1,
    padding: '14px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '999px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 26px rgba(79,70,229,0.4)',
  },
  secondaryButton: {
    flex: 1,
    padding: '14px',
    background: 'white',
    color: '#4f46e5',
    border: '1px solid #4f46e5',
    borderRadius: '999px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default RoomSelection;
