// ✅ COMPLETE FIXED InterviewerView.jsx - FULL TRANSCRIPT SAVE + NO 404 ERRORS
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SIGNALING_SERVER, iceServers } from '../utils/config';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// ✅ API base (backend port 5000)
const API_BASE = 'http://localhost:5000/api/auth';

// ---------- Helpers for localStorage persistence ----------
const loadState = (key, defaultValue) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};
const saveState = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
};

const InterviewerView = ({ roomId, userName }) => {
  const [interviewerName, setInterviewerName] = useState('');
  const [step, setStep] = useState('nameEntry'); // 'nameEntry' or 'meeting'

  // ---------- Persistent states ----------
  const [connectionStatus, setConnectionStatus] = useState(
    loadState('interviewer_connectionStatus', 'Initializing...')
  );
  const [alerts, setAlerts] = useState(loadState('interviewer_alerts', []));
  const [candidateConnected, setCandidateConnected] = useState(
    loadState('interviewer_candidateConnected', false)
  );

  // ✅ NEW: Full transcript state for auto-save + display
  const [fullTranscript, setFullTranscript] = useState('');

  // persist
  useEffect(
    () => saveState('interviewer_connectionStatus', connectionStatus),
    [connectionStatus]
  );
  useEffect(() => saveState('interviewer_alerts', alerts), [alerts]);
  useEffect(
    () => saveState('interviewer_candidateConnected', candidateConnected),
    [candidateConnected]
  );

  // ---------- Refs ----------
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  const remotePeerIdRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const mountedRef = useRef(true);

  // speech refs
  const lastTranscriptRef = useRef('');     // last transcript shown in UI
  const savedTranscriptRef = useRef('');    // transcript already saved to DB

  // ---------- Mount / Unmount ----------
  useEffect(() => {
    mountedRef.current = true;
    console.log('🔌 InterviewerView mounted');

    return () => {
      mountedRef.current = false;
      console.log('🧹 Interviewer cleaning up on unmount...');
      cleanupConnection();
    };
  }, []);

  // Effect to initialize connection - only trigger on 'meeting' step and when interviewerName exists
  useEffect(() => {
    if (step === 'meeting' && interviewerName.trim() !== '') {
      console.log('🔌 Initializing connection for meeting step...');
      initializeConnection();
    }
    // Cleanup on step / interviewerName change
    return () => {
      console.log('🧹 Cleaning up connection on step/name change...');
      cleanupConnection();
    };
  }, [step, interviewerName]);

  // Handler for when user submits name
  const handleNameSubmit = async () => {
    if (!interviewerName.trim()) {
      alert('Please enter your name');
      return;
    }

    await saveInterviewerName();
    setStep('meeting');
  };

  // ---------- Speech Recognition ----------
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const [isRecording, setIsRecording] = useState(false);
  const [secondsSinceLastSpeech, setSecondsSinceLastSpeech] = useState(0);
  const [lastSpeechTime, setLastSpeechTime] = useState(Date.now());
  const pauseTimerRef = useRef(null);
  const PAUSE_THRESHOLD = 10000; // 10 seconds pause threshold
  const speechStartedRef = useRef(false);

  // ✅ LIVE TRANSCRIPT BUILD - Updates fullTranscript as you speak
  useEffect(() => {
    if (transcript.trim() && listening) {
      const newText = transcript.trim();
      if (newText !== lastTranscriptRef.current) {
        setFullTranscript((prev) => {
          const updated =
            (prev ? prev + '\n' : '') + '[Interviewer Live]: ' + newText;
          lastTranscriptRef.current = newText;
          return updated;
        });
        // mark this as spoken (but not necessarily saved to DB)
        setLastSpeechTime(Date.now());
      }
    }
  }, [transcript, listening]);

  // Auto-start Speech Recognition Once Interviewer Has Entered Name and Step is 'meeting'
  useEffect(() => {
    if (
      step === 'meeting' &&
      browserSupportsSpeechRecognition &&
      !speechStartedRef.current
    ) {
      console.log('✅ Auto-starting speech recognition...');
      setTimeout(() => {
        startSpeechRecognition();
        speechStartedRef.current = true;
      }, 2000);
    }
  }, [step, browserSupportsSpeechRecognition]);

  // MOUNT log
  useEffect(() => {
    console.log(
      '👨‍💼 InterviewerView MOUNTED - Room ID:',
      roomId,
      'User:',
      userName || 'Guest'
    );
  }, [roomId, userName]);

  // ✅ startSpeechRecognition function (with proper resets)
  const startSpeechRecognition = () => {
    resetTranscript();
    savedTranscriptRef.current = '';
    lastTranscriptRef.current = '';
    setFullTranscript('');
    setIsRecording(true);
    setLastSpeechTime(Date.now());
    setSecondsSinceLastSpeech(0);

    SpeechRecognition.startListening({
      continuous: true,
      language: 'en-US',
      interimResults: true,
    });

    console.log('🎤 Interviewer speech recognition started');
  };

  // ✅ AUTO-SAVE TRANSCRIPT EVERY 30 SECONDS (NO DUPLICATES)
  useEffect(() => {
    if (!listening) return;

    const interval = setInterval(() => {
      const currentText = transcript.trim();
      if (!currentText) return;

      // save ONLY new spoken part
      const newChunk = currentText
        .replace(savedTranscriptRef.current, '')
        .trim();

      if (newChunk.length > 0) {
        console.log('💾 Auto-saving new transcript chunk (30 sec)...', newChunk);
        saveInterviewerQuestion(newChunk);

        // mark this part as saved (everything up to currentText)
        savedTranscriptRef.current = currentText;
      }
    }, 30000); // ✅ 30 seconds

    return () => clearInterval(interval);
  }, [listening, transcript]);

  // Increment Seconds Since Last Speech
  useEffect(() => {
    if (!listening) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastSpeechTime) / 1000);
      setSecondsSinceLastSpeech(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [listening, lastSpeechTime]);

  // ✅ FIXED: API Call to Save Interviewer Name
  const saveInterviewerName = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/rooms/update-interviewer-name`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            interviewerName: interviewerName.trim(),
          }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        console.log('💾 Interviewer name saved:', data.message);
      } else {
        console.error('❌ Failed to save interviewer name:', data.error);
      }
    } catch (error) {
      console.error('❌ Network error saving interviewer name:', error);
    }
  };

  // ✅ FIXED: API Call to Save Question
  const saveInterviewerQuestion = async (questionText) => {
    try {
      const response = await fetch(`${API_BASE}/questions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          interviewerName: interviewerName || 'Interviewer',
          questionText,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log('❓ Question saved:', data.questionId);
      } else {
        console.error('❌ Question save error:', data.error);
      }
    } catch (error) {
      console.error('❌ Network error saving question:', error);
    }
  };

  // ✅ FINAL FIX: Flush pending transcript + Mark interview complete safely
  const markInterviewComplete = async () => {
    try {
      console.log('🔚 Ending interview...');

      // 1️⃣ SAVE any UNSAVED live transcript before ending
      const currentText = transcript.trim();
      const pendingTranscript = currentText
        ? currentText.replace(savedTranscriptRef.current, '').trim()
        : '';

      if (pendingTranscript.length > 0) {
        console.log('💾 Saving last pending transcript chunk...', pendingTranscript);
        await saveInterviewerQuestion(pendingTranscript);
        savedTranscriptRef.current =
          (savedTranscriptRef.current + ' ' + pendingTranscript).trim();
      }

      // 2️⃣ Prepare FULL transcript (prefer UI fullTranscript, fallback to savedTranscriptRef)
      const fromSaved = savedTranscriptRef.current?.trim() || '';
      const fromLive = fullTranscript?.trim() || '';
      const finalTranscript = fromLive || fromSaved;

      if (!finalTranscript) {
        console.warn('⚠️ Transcript is empty, completing interview without transcript');
      } else {
        console.log(
          '📜 Final transcript preview:',
          finalTranscript.substring(0, 100) + '...'
        );
      }

      // 3️⃣ Mark interview COMPLETE + send FULL transcript (or null)
      const completeResponse = await fetch(
        `${API_BASE}/interviews/${roomId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: finalTranscript || null,
            completedAt: new Date().toISOString(),
          }),
        }
      );

      const completeData = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(completeData?.error || 'Failed to complete interview');
      }

      console.log('✅ Interview COMPLETED + FULL TRANSCRIPT SAVED');

      // 4️⃣ Stop speech recognition (IMPORTANT)
      SpeechRecognition.stopListening();

      // 5️⃣ Cleanup WebRTC + Socket
      cleanupConnection();

      // 6️⃣ Notify candidate
      socketRef.current?.emit('end-interview', { roomId });

      // 7️⃣ Redirect success
      const wordCount = finalTranscript ? finalTranscript.split(' ').length : 0;
      alert(
        `✅ Interview COMPLETED${
          finalTranscript ? ' & FULL TRANSCRIPT SAVED' : ''
        }!\n\nRoom: ${roomId}\nWords: ${wordCount}`
      );

      window.location.href = '#/calendar-view';
    } catch (error) {
      console.error('❌ Complete error:', error);
      alert(`Failed to end interview: ${error.message}`);
    }
  };

  // ---------- Initialize socket + media ----------
  const initializeConnection = async () => {
    try {
      console.log('📹 Requesting interviewer camera and microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setConnectionStatus('Camera ready');

      console.log('🔌 Creating socket connection to:', SIGNALING_SERVER);
      const socket = io(SIGNALING_SERVER, {
        transports: ['polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      // socket events
      socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
        setConnectionStatus('Connected');
        socket.emit('join-room', { roomId, role: 'interviewer', userName });
      });

      socket.on('room-joined', (data) => {
        console.log('✅ room-joined:', data);
        setConnectionStatus('Waiting for candidate...');
        if (data.otherPeerId) {
          console.log(
            '🔁 Candidate already in room -> initiating offer to',
            data.otherPeerId
          );
          remotePeerIdRef.current = data.otherPeerId;
          setCandidateConnected(true);
          createOffer(data.otherPeerId);
        }
      });

      socket.on('peer-joined', (data) => {
        console.log('✅ peer-joined event (new peer):', data);
        remotePeerIdRef.current = data.socketId;
        setCandidateConnected(true);
        createOffer(data.socketId);
      });

      socket.on('answer', handleAnswer);
      socket.on('ice-candidate', handleIceCandidate);

      socket.on('alert', (alertData) => {
        console.log('🚨 ALERT RECEIVED:', alertData);
        const fullAlert = {
          ...alertData,
          id: Date.now() + Math.floor(Math.random() * 1000),
          timestamp: new Date().toISOString(),
        };
        setAlerts((prev) => [fullAlert, ...prev]);
        if (alertData.type === 'AI_DETECTION_RESULT') {
          console.log('🤖 AI Score:', alertData.aiData?.aiScore);
        }
      });

      socket.on('disconnect', (reason) => {
        console.warn('⚠️ Socket disconnected:', reason);
        setConnectionStatus('Disconnected: ' + reason);
        setCandidateConnected(false);
      });

      socket.on('connect_error', (err) => {
        console.error('❌ Socket connect_error', err);
        setConnectionStatus('Connection error');
      });

      setConnectionStatus('Ready');
    } catch (error) {
      console.error('❌ Connection initialization failed:', error);
      setConnectionStatus('Error: ' + (error.message || error));
    }
  };

  // ---------- Create / Reset PeerConnection ----------
  const createPeerConnection = (peerId) => {
    console.log('🔗 createPeerConnection for', peerId);

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.onnegotiationneeded = null;
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      console.log('📥 ontrack', event);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnectionStatus('✅ Video connected!');
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && socketRef.current) {
        const targetId = remotePeerIdRef.current;
        if (targetId) {
          console.log('🧊 sending ice-candidate to', targetId);
          socketRef.current.emit('ice-candidate', {
            candidate: ev.candidate,
            targetId,
          });
        } else {
          console.warn('⚠️ no target peerId to send ICE to yet');
        }
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        console.log('♻️ onnegotiationneeded triggered');
        const targetId = remotePeerIdRef.current;
        if (!targetId) {
          console.warn('⚠️ No remote peer id for negotiation');
          return;
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('📤 Emitting offer during negotiationneeded to', targetId);
        socketRef.current?.emit('offer', {
          targetId,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.error('❌ renegotiation error', err);
      }
    };

    return pc;
  };

  // ---------- Create Offer ----------
  const createOffer = async (peerId) => {
    try {
      console.log('📤 createOffer -> peerId:', peerId);
      if (!socketRef.current) {
        console.error('❌ Socket not initialized');
        return;
      }

      remotePeerIdRef.current = peerId;
      const pc = createPeerConnection(peerId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit('offer', {
        targetId: peerId,
        offer: pc.localDescription,
      });

      if (pendingIceCandidatesRef.current.length > 0) {
        pendingIceCandidatesRef.current.forEach((c) => {
          socketRef.current.emit('ice-candidate', {
            candidate: c,
            targetId: peerId,
          });
        });
        pendingIceCandidatesRef.current = [];
      }
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  };

  // ---------- Handle Answer ----------
  const handleAnswer = async (data) => {
    console.log('📨 handleAnswer', data);
    try {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('❌ No peerConnection to set remote description on');
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('✅ Remote description set from answer');

      if (pendingIceCandidatesRef.current.length > 0) {
        for (const candidate of pendingIceCandidatesRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('✅ Applied queued ICE candidate');
          } catch (err) {
            console.warn('⚠️ Failed to add queued ICE candidate', err);
          }
        }
        pendingIceCandidatesRef.current = [];
      }
    } catch (err) {
      console.error('❌ Error handling answer:', err);
    }
  };

  // ---------- Handle incoming ICE candidate ----------
  const handleIceCandidate = async (data) => {
    console.log('🧊 Received ICE candidate', !!data?.candidate);
    const pc = peerConnectionRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('✅ ICE candidate added to pc');
      } catch (err) {
        console.error('❌ Error adding ICE candidate', err);
      }
    } else {
      console.log('⏳ Queuing ICE candidate until remoteDescription is set');
      pendingIceCandidatesRef.current.push(data.candidate);
    }
  };

  // ---------- Cleanup ----------
  const cleanupConnection = () => {
    console.log('🧹 cleanupConnection()');
    try {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    } catch (e) {}

    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    } catch (e) {}

    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    } catch (e) {}
  };

  // ---------- Alert helpers ----------
  const clearAlert = (alertId) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };
  const clearAllAlerts = () => setAlerts([]);

  // ---------- Render ----------
  if (step === 'nameEntry') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'Arial',
          backgroundColor: '#f4f4f4',
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 400,
            width: '100%',
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 40,
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          }}
        >
          <h2 style={{ marginBottom: 20 }}>Enter Your Name</h2>
          <input
            type="text"
            placeholder="Your full name"
            value={interviewerName}
            onChange={(e) => setInterviewerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
            autoFocus
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              borderRadius: 6,
              border: '1px solid #ccc',
              marginBottom: 20,
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleNameSubmit}
            disabled={!interviewerName.trim()}
            style={{
              width: '100%',
              padding: 12,
              backgroundColor: '#464feb',
              color: 'white',
              fontSize: 16,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              opacity: interviewerName.trim() ? 1 : 0.5,
              transition: 'opacity 0.3s ease',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'Arial',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>
            👨‍💼 Interviewer Dashboard
          </h1>
          <p
            style={{
              margin: '5px 0 0 0',
              fontSize: '14px',
              color: '#666',
            }}
          >
            Room:{' '}
            <code
              style={{
                backgroundColor: '#e0e0e0',
                padding: '2px 6px',
                borderRadius: '3px',
              }}
            >
              {roomId?.substring(0, 12)}...
            </code>{' '}
            | Transcript: {fullTranscript.split(' ').filter(Boolean).length} words
          </p>
        </div>
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: candidateConnected ? '#4caf50' : '#ff9800',
            color: 'white',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          {candidateConnected
            ? '✅ Candidate Connected'
            : '⏳ Waiting for Candidate'}
        </div>
      </div>

      {/* Video Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          maxWidth: '1400px',
          margin: '0 auto 20px',
        }}
      >
        {/* Local */}
        <div
          style={{
            backgroundColor: '#000',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            position: 'relative',
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '500px', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: '5px 10px',
              borderRadius: '5px',
              fontSize: '12px',
            }}
          >
            You (Interviewer)
          </div>
        </div>

        {/* Remote */}
        <div
          style={{
            backgroundColor: '#000',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            position: 'relative',
          }}
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '500px', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: '5px 10px',
              borderRadius: '5px',
              fontSize: '12px',
            }}
          >
            Candidate
          </div>
        </div>
      </div>

      {/* End interview button */}
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto 20px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={markInterviewComplete}
          style={{
            padding: '15px 30px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(25,118,210,0.3)',
          }}
        >
          ✅ End Interview & Save FULL Transcript
        </button>
      </div>

      {/* Alerts Panel */}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', color: '#333' }}>
            🚨 Monitoring Alerts ({alerts.length})
          </h2>
          {alerts.length > 0 && (
            <button
              onClick={clearAllAlerts}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              Clear All
            </button>
          )}
        </div>

        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            maxHeight: '400px',
            overflowY: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {alerts.length === 0 ? (
            <p
              style={{
                textAlign: 'center',
                color: '#999',
                margin: '40px 0',
              }}
            >
              No alerts yet. Monitoring is active.
            </p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: '15px',
                  marginBottom: '10px',
                  borderRadius: '8px',
                  border: `2px solid ${
                    alert.severity === 'critical'
                      ? '#f44336'
                      : alert.severity === 'high'
                      ? '#ff9800'
                      : alert.severity === 'medium'
                      ? '#ffc107'
                      : '#2196f3'
                  }`,
                  backgroundColor: `${
                    alert.severity === 'critical'
                      ? '#ffebee'
                      : alert.severity === 'high'
                      ? '#fff3e0'
                      : alert.severity === 'medium'
                      ? '#fff9c4'
                      : '#e3f2fd'
                  }`,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 'bold',
                        marginBottom: '5px',
                        color: '#333',
                      }}
                    >
                      {alert.type === 'AI_DETECTION_RESULT' &&
                        '🤖 AI Detection Result'}
                      {alert.type === 'LOOKING_AWAY' &&
                        '👁️ Eye Tracking Alert'}
                      {alert.type === 'TAB_SWITCHED' &&
                        '⚠️ Tab Switch Detected'}
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#555',
                        marginBottom: '8px',
                      }}
                    >
                      {alert.message}
                    </div>
                    {alert.aiData && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#666',
                          backgroundColor: 'white',
                          padding: '8px',
                          borderRadius: '4px',
                          marginTop: '8px',
                        }}
                      >
                        <div>
                          <strong>AI Score:</strong> {alert.aiData.aiScore}%
                        </div>
                        <div>
                          <strong>Method:</strong>{' '}
                          {alert.aiData.detectionMethod}
                        </div>
                        <div>
                          <strong>Words:</strong> {alert.aiData.wordCount}
                        </div>
                        {alert.aiData.textAnalyzed && (
                          <div
                            style={{
                              marginTop: '5px',
                              fontStyle: 'italic',
                              color: '#888',
                            }}
                          >
                            "
                            {alert.aiData.textAnalyzed.substring(0, 100)}
                            ..."
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#999',
                        marginTop: '5px',
                      }}
                    >
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => clearAlert(alert.id)}
                    style={{
                      marginLeft: '10px',
                      padding: '4px 8px',
                      backgroundColor: '#e0e0e0',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        button:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
};

export default InterviewerView;
