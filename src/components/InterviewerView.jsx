import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import io from 'socket.io-client';
import { SIGNALING_SERVER, iceServers } from '../utils/config';

const InterviewerView = ({ roomId, userName }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [remotePeerId, setRemotePeerId] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState({
    lookingAway: 0,
    tabSwitched: 0,
    testAlerts: 0
  });

  const webcamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    initializeConnection();
    requestNotificationPermission();

    return () => cleanup();
  }, []);

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  };

  const initializeConnection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });

      localStreamRef.current = stream;

      if (webcamRef.current && webcamRef.current.video) {
        webcamRef.current.video.srcObject = stream;
      }

      setConnectionStatus('Camera ready');

      const newSocket = io(SIGNALING_SERVER);
      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on('connect', () => {
        setConnectionStatus('Connected to server');
        newSocket.emit('join-room', {
          roomId,
          role: 'interviewer',
          userName
        });
      });

      newSocket.on('room-joined', (data) => {
        setConnectionStatus('Waiting for candidate...');
        if (data.otherPeerId) {
          setRemotePeerId(data.otherPeerId);
          setTimeout(() => createAndSendOffer(data.otherPeerId), 1000);
        }
      });

      newSocket.on('peer-joined', (data) => {
        setRemotePeerId(data.peerId);
        setConnectionStatus('Candidate joined, connecting...');
        setTimeout(() => createAndSendOffer(data.peerId), 1000);
      });

      newSocket.on('alert', (data) => {
        setAlerts(prev => [data, ...prev].slice(0, 50)); // last 50 alerts

        setAlertStats(prev => {
          const newStats = { ...prev };
          if (data.type === 'AI_GENERATED_RESPONSE') {
            newStats.aiDetection = (newStats.aiDetection || 0) + 1;
          } else if (data.type === 'LOOKING_AWAY') {
            newStats.lookingAway++;
          } else if (data.type === 'TAB_SWITCHED') {
            newStats.tabSwitched++;
          } else if (data.type === 'TEST_ALERT') {
            newStats.testAlerts++;
          }
          return newStats;
        });

        playAlertSound();

        if (Notification.permission === 'granted') {
          const notification = new Notification('🚨 Interview Alert', {
            body: data.message,
            icon: '⚠️',
            tag: 'interview-alert'
          });

          setTimeout(() => notification.close(), 5000);
        }
      });

      newSocket.on('offer', () => {
        // Interviewer doesn't receive offers, only send
      });

      newSocket.on('answer', (data) => {
        const pc = peerConnectionRef.current;
        if (!pc) return;
        pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
        setConnectionStatus('Answer received, connecting...');
      });

      newSocket.on('ice-candidate', (data) => {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
        }
      });

    } catch (error) {
      setConnectionStatus('Error: ' + error.message);
    }
  };

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  const createPeerConnection = (peerId) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnectionStatus('✅ Connected!');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          targetId: peerId
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('✅ Connected!');
      } else if (pc.iceConnectionState === 'failed') {
        setConnectionStatus('❌ Connection failed');
      }
    };

    return pc;
  };

  const createAndSendOffer = async (peerId) => {
    const pc = createPeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('offer', {
        targetId: peerId,
        offer: offer
      });
      setConnectionStatus('Sent offer, waiting for answer...');
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'LOOKING_AWAY': return '👀';
      case 'TAB_SWITCHED': return '🔄';
      case 'TEST_ALERT': return '🧪';
      case 'AI_GENERATED_RESPONSE': return '🤖';
      default: return '⚠️';
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'critical': return { bg: '#f8d7da', border: '#dc3545', text: '#721c24' };
      case 'high': return { bg: '#fff3cd', border: '#ffc107', text: '#856404' };
      case 'medium': return { bg: '#fff3cd', border: '#ffc107', text: '#856404' };
      default: return { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460' };
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <h1>Interviewer Dashboard - Room: {roomId}</h1>

      <div style={{ padding: 15, backgroundColor: 'white', borderRadius: 8, marginBottom: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div><strong>Status:</strong> {connectionStatus}</div>
        <div style={{ marginTop: 10, fontSize: 14, color: '#666' }}>
          <strong>Alert Statistics:</strong> 
          <span style={{ marginLeft: 10 }}>👀 Looking Away: {alertStats.lookingAway}</span>
          <span style={{ marginLeft: 10 }}>🔄 Tab Switched: {alertStats.tabSwitched}</span>
          <span style={{ marginLeft: 10 }}>🧪 Test Alerts: {alertStats.testAlerts}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Videos Section */}
        <div>
          <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 8, marginBottom: 20 }}>
            <h3>Candidate Video</h3>
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 8, backgroundColor: '#000' }} />
          </div>

          <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 8 }}>
            <h3>You (Interviewer)</h3>
            <Webcam ref={webcamRef} audio={false} style={{ width: '100%', borderRadius: 8, backgroundColor: '#000' }} />
          </div>
        </div>

        {/* Alerts Panel */}
        <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 8, maxHeight: 800, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <h3>🚨 Live Alerts ({alerts.length})</h3>

          {alerts.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#28a745', fontSize: 16, textAlign: 'center', padding: 40 }}>
              <div>
                <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
                <div><strong>No Violations Detected</strong></div>
                <div style={{ fontSize: 14, marginTop: 5, color: '#666' }}>Candidate is following interview protocols</div>
              </div>
            </div>
          ) : (
            alerts.map((alert, index) => {
              const colors = getAlertColor(alert.severity);
              return (
                <div key={index} style={{
                  padding: 15, marginBottom: 12, backgroundColor: colors.bg,
                  border: `2px solid ${colors.border}`, borderRadius: 8, fontSize: 14
                }}>
                  <div style={{ fontWeight: 'bold', color: colors.text, marginBottom: 8, fontSize: 15 }}>
                    {getAlertIcon(alert.type)} {alert.type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ marginBottom: 8, color: colors.text }}>{alert.message}</div>
                  {alert.aiData && alert.aiData.percentage !== undefined && (
                    <div style={{ fontWeight: '600', color: '#007bff', marginBottom: 8 }}>
                      AI Detection Confidence: {alert.aiData.percentage}%
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#666' }}>
                    ⏰ {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {opacity: 0; transform: translateX(20px);}
          to {opacity: 1; transform: translateX(0);}
        }
      `}</style>
    </div>
  );
};

export default InterviewerView;
