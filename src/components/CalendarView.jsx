import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Calendar.css';

const API_BASE = 'http://localhost:5000/api/auth';  // 👉 लोकल backend

const CalendarView = () => {
  const [interviews, setInterviews] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('DAY'); // 'DAY' | 'ALL'

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user.full_name || 'Guest';

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      console.warn('User id missing - cannot fetch interviews');
      return;
    }

    const fetchInterviews = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/interview-rooms/user/${userId}`
        );
        if (!response.ok) throw new Error('Failed to fetch interviews');
        const data = await response.json();

        setInterviews(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching interviews:', error);
        setInterviews([]);
      }
    };

    fetchInterviews();
  }, []);

  const interviewsOnDate =
    Array.isArray(interviews) && selectedDate
      ? interviews.filter(
          (i) =>
            new Date(i.scheduled_date).toDateString() ===
            selectedDate.toDateString()
        )
      : [];

  const hasInterviewForDate = (date) =>
    Array.isArray(interviews) &&
    interviews.some(
      (i) =>
        new Date(i.scheduled_date).toDateString() === date.toDateString()
    );

  const handleViewResult = async (roomId) => {
    try {
      const res = await fetch(
        `${API_BASE}/interviews/${roomId}/details`
      );
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to load interview details');
        return;
      }

      const { room, questions, answers } = data;
      alert(
        `Candidate: ${room.candidate_name || 'Unknown'}\n` +
          `Interviewer: ${room.interviewer_name || 'Unknown'}\n` +
          `Questions: ${questions.length}\n` +
          `Answers: ${answers.length}\n` +
          `Status: ${room.status}`
      );
    } catch (e) {
      console.error(e);
      alert('Error loading interview details');
    }
  };

  const handleCancel = async (roomId) => {
    if (!window.confirm('Cancel this interview?')) return;

    try {
      const res = await fetch(
        `${API_BASE}/interview-rooms/${roomId}/cancel`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Cancelled from calendar' }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to cancel');
        return;
      }

      setInterviews((prev) =>
        prev.map((it) =>
          it.room_id === roomId ? { ...it, status: 'CANCELLED' } : it
        )
      );
      alert('Interview cancelled');
    } catch (e) {
      console.error(e);
      alert('Network error while cancelling');
    }
  };

  const handleReschedule = async (interview) => {
    const current = interview.scheduled_date
      ? interview.scheduled_date.replace('T', ' ').slice(0, 16)
      : '';

    const input = window.prompt(
      'Enter new date & time (YYYY-MM-DD HH:mm, 24h):',
      current
    );
    if (!input) return;

    const iso = new Date(input.replace(' ', 'T')).toISOString();

    try {
      const res = await fetch(
        `${API_BASE}/interview-rooms/${interview.room_id}/reschedule`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledDate: iso }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to reschedule');
        return;
      }

      setInterviews((prev) =>
        prev.map((it) =>
          it.room_id === interview.room_id
            ? { ...it, scheduled_date: iso, status: 'RESCHEDULED' }
            : it
        )
      );
      alert('Interview rescheduled');
    } catch (e) {
      console.error(e);
      alert('Network error while rescheduling');
    }
  };

  const handleSendEmail = async (roomId) => {
    try {
      const res = await fetch(
        `${API_BASE}/interview-rooms/${roomId}/send-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'REMINDER' }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to send email');
        return;
      }

      alert('Email sent successfully');
    } catch (e) {
      console.error(e);
      alert('Network error while sending email');
    }
  };

  const listToShow = viewMode === 'DAY' ? interviewsOnDate : interviews;

  return (
    <div className="calendar-page-wrapper">
      {/* Header */}
      <div className="calendar-top-nav">
        <div className="calendar-logo">
          <div className="calendar-logo-icon">🎯</div>
          <span className="calendar-logo-text">Interview Hub</span>
        </div>

        <div className="calendar-user-info">
          <div className="calendar-welcome-texts">
            <span className="calendar-user-name">{userName}</span>
            <h1 className="calendar-welcome-title">Interview calendar</h1>
          </div>
          <div className="calendar-user-avatar">
            {userName.charAt(0)}
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="page-center-wrapper">
        <div className="view-calendar-layout">
          <div className="view-calendar-wrapper">
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              className="view-calendar"
              tileClassName={({ date, view }) => {
                if (view === 'month' && hasInterviewForDate(date)) {
                  return 'has-interview';
                }
                return null;
              }}
            />
          </div>

          <div className="view-calendar-sidepanel">
            <div className="sidepanel-header">
              <h3>
                {viewMode === 'DAY'
                  ? selectedDate.toDateString()
                  : 'All interviews'}
              </h3>
              <div className="sidepanel-toggle">
                <button
                  className={
                    viewMode === 'DAY' ? 'toggle-btn active' : 'toggle-btn'
                  }
                  onClick={() => setViewMode('DAY')}
                >
                  Day
                </button>
                <button
                  className={
                    viewMode === 'ALL' ? 'toggle-btn active' : 'toggle-btn'
                  }
                  onClick={() => setViewMode('ALL')}
                >
                  All
                </button>
              </div>
            </div>

            {listToShow.length === 0 ? (
              <p className="empty-text">No interviews found</p>
            ) : (
              listToShow.map((i) => (
                <div key={i.room_id} className="interview-card">
                  <div className="interview-id">
                    <span>Meeting ID</span>
                    <strong>{i.room_id}</strong>
                  </div>

                  <div className="interview-links">
                    <a
                      href={i.candidate_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Candidate
                    </a>
                    <a
                      href={i.interviewer_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Interviewer
                    </a>
                  </div>

                  <div className="interview-meta">
                    <span>
                      {new Date(i.scheduled_date).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    <span className={`status-chip status-${i.status}`}>
                      {i.status}
                    </span>
                  </div>

                  {i.status === 'COMPLETED' && (
                    <button
                      className="view-result-btn"
                      onClick={() => handleViewResult(i.room_id)}
                    >
                      View result
                    </button>
                  )}

                  <div className="interview-actions">
                    <button
                      className="action-btn cancel"
                      onClick={() => handleCancel(i.room_id)}
                    >
                      Cancel
                    </button>
                    <button
                      className="action-btn reschedule"
                      onClick={() => handleReschedule(i)}
                    >
                      Reschedule
                    </button>
                    <button
                      className="action-btn email"
                      onClick={() => handleSendEmail(i.room_id)}
                    >
                      Send Email
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
