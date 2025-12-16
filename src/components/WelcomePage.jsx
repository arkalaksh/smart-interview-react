// components/WelcomePage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const WelcomePage = () => {
  const navigate = useNavigate();

  const goSignup = () => {
    navigate('/signup');
  };

  const goLogin = () => {
    navigate('/login');
  };

  // check user in localStorage
  const storedUser = localStorage.getItem('user');
  const isLoggedIn = !!storedUser && storedUser !== '{"name":"Guest"}';

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.navbar}>
        <div style={styles.navLeft}>
          <span style={styles.navLogo}>🎯</span>
          <span style={styles.navTitle}>Smart Interview</span>
        </div>
      </div>

      <div style={styles.heroWrapper}>
        <div style={styles.heroCard}>
          {/* LEFT */}
          <div style={styles.heroLeft}>
            <h1 style={styles.heroTitle}>
              Hire faster with <span style={styles.highlight}>Smart Interview</span>
            </h1>
            <p style={styles.heroSubtitle}>
              Schedule, manage and run online interviews from a single, powerful dashboard.
              OTP-based login, secure links and calendar integration built-in.
            </p>

            <div style={styles.heroActions}>
              <button
                onClick={goSignup}
                style={styles.primaryButton}
                onMouseOver={(e) => (e.target.style.transform = 'translateY(-2px)')}
                onMouseOut={(e) => (e.target.style.transform = 'translateY(0)')}
              >
                Get Started – Register
              </button>

              <button
                onClick={goLogin}
                style={styles.secondaryButton}
                onMouseOver={(e) => (e.target.style.transform = 'translateY(-2px)')}
                onMouseOut={(e) => (e.target.style.transform = 'translateY(0)')}
              >
                Login
              </button>
            </div>

            <div style={styles.heroMeta}>
              <span>⚡ OTP based authentication</span>
              <span>🔗 One-click interview links</span>
              <span>📅 Smart calendar view</span>
            </div>
          </div>

          {/* RIGHT – show only when logged in */}
          {isLoggedIn && (
            <div style={styles.heroRight}>
              <div style={styles.statsCard}>
                <h3 style={styles.statsTitle}>Today’s overview</h3>
                <div style={styles.statsRow}>
                  <div style={styles.statBoxPrimary}>
                    <span style={styles.statLabel}>Interviews today</span>
                    <span style={styles.statValue}>08</span>
                  </div>
                  <div style={styles.statBoxSecondary}>
                    <span style={styles.statLabel}>Pending invites</span>
                    <span style={styles.statValue}>15</span>
                  </div>
                </div>
                <div style={styles.timeline}>
                  <div style={styles.timelineItem}>
                    <span style={styles.timelineDot} />
                    <div>
                      <div style={styles.timelineTitle}>Frontend Engineer · 11:00 AM</div>
                      <div style={styles.timelineSub}>Candidate link auto-shared</div>
                    </div>
                  </div>
                  <div style={styles.timelineItem}>
                    <span style={styles.timelineDot} />
                    <div>
                      <div style={styles.timelineTitle}>HR Screening · 2:30 PM</div>
                      <div style={styles.timelineSub}>Reminder scheduled</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: '#1a1a2e',
  },
  navbar: {
    width: '100%',
    maxWidth: '1320px',
    margin: '0 auto',
    padding: '18px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  navLogo: {
    fontSize: '26px',
  },
  navTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1a1a2e',
  },

  heroWrapper: {
    width: '100%',
    maxWidth: '1320px',
    margin: '20px auto 40px',
    padding: '0 16px',
  },
  heroCard: {
    width: '100%',
    minHeight: '420px',
    backgroundColor: '#ffffff',
    borderRadius: '26px',
    boxShadow: '0 0 45px rgba(0,0,0,0.06)',
    border: '1px solid #e9ecef',
    padding: '48px 48px 52px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.1fr)',
    gap: '40px',
    alignItems: 'center',
  },
  heroLeft: {
    textAlign: 'left',
  },
  heroTitle: {
    fontSize: '40px',
    lineHeight: 1.2,
    fontWeight: 800,
    color: '#1a1a2e',
    marginBottom: '18px',
  },
  highlight: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f97316 100%)',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
  },
  heroSubtitle: {
    fontSize: '16px',
    lineHeight: 1.8,
    color: '#495057',
    marginBottom: '26px',
    maxWidth: '580px',
  },
  heroActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '20px',
  },
  primaryButton: {
    padding: '14px 30px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(102,126,234,0.4)',
    transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
  },
  secondaryButton: {
    padding: '14px 24px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#667eea',
    background: '#f8f9ff',
    border: '1px solid #d0d4ff',
    borderRadius: '999px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(102,126,234,0.15)',
    transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
  },
  heroMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '10px',
    fontSize: '12px',
    color: '#6c757d',
  },
  heroRight: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  statsCard: {
    width: '100%',
    maxWidth: '440px',
    minHeight: '260px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '24px',
    padding: '26px 26px 30px',
    color: '#fff',
    boxShadow: '0 24px 40px rgba(102,126,234,0.6)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  statsTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px',
  },
  statsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '18px',
  },
  statBoxPrimary: {
    flex: 1,
    borderRadius: '14px',
    padding: '12px 14px',
    background: 'rgba(15,23,42,0.22)',
  },
  statBoxSecondary: {
    flex: 1,
    borderRadius: '14px',
    padding: '12px 14px',
    background: 'rgba(15,23,42,0.12)',
  },
  statLabel: {
    fontSize: '11px',
    opacity: 0.9,
  },
  statValue: {
    fontSize: '22px',
    fontWeight: 700,
    marginTop: '4px',
  },
  timeline: {
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  timelineItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#facc15',
    marginTop: '6px',
  },
  timelineTitle: {
    fontSize: '13px',
  },
  timelineSub: {
    fontSize: '11px',
    opacity: 0.9,
  },
};

export default WelcomePage;
