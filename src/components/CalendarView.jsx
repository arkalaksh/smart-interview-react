import React, { useState, useEffect } from 'react'; 
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Calendar.css';

const CalendarView = () => {
  const [interviews, setInterviews] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    // Fetch scheduled interviews for the logged-in user from API
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      console.warn('User id missing - cannot fetch interviews');
      return;
    }

    const fetchInterviews = async () => {
      try {
        const response = await fetch(
          `https://darkcyan-hornet-746720.hostingersite.com/api/auth/interview-rooms/user/${userId}`
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
  }, []); // run once on mount

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

  // NEW: View result handler
  const handleViewResult = async (roomId) => {
    try {
      const res = await fetch(
        `https://darkcyan-hornet-746720.hostingersite.com/api/auth/interviews/${roomId}/details`
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

  return (
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
        {selectedDate && (
          <div className="view-calendar-sidepanel">
            <h3>{selectedDate.toDateString()}</h3>
            {interviewsOnDate.length === 0 ? (
              <p className="empty-text">No interviews scheduled</p>
            ) : (
              interviewsOnDate.map((i) => (
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

                  {/* NEW: status / result */}
                  {i.status === 'COMPLETED' ? (
                    <button
                      className="view-result-btn"
                      onClick={() => handleViewResult(i.room_id)}
                    >
                      View result
                    </button>
                  ) : (
                    <span className="status-chip">{i.status}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;
