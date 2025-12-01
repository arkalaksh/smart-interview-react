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
        const response = await fetch(`http://localhost:5000/api/auth/interview-rooms/user/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch interviews');
        const data = await response.json();

        setInterviews(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching interviews:', error);
        setInterviews([]);
      }
    };

    fetchInterviews();
  }, []); // empty deps array to run once on mount

  const interviewsOnDate =
    Array.isArray(interviews) && selectedDate
      ? interviews.filter(
          (i) => new Date(i.scheduled_date).toDateString() === selectedDate.toDateString()
        )
      : [];

  const hasInterviewForDate = (date) =>
    Array.isArray(interviews) &&
    interviews.some(
      (i) => new Date(i.scheduled_date).toDateString() === date.toDateString()
    );

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
