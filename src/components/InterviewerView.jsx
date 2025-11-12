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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  };

  const initializeConnection = async () => {
    try {
      console.log('📷 Getting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      
      localStreamRef.current = stream;
      
      if (webcamRef.current && webcamRef.current.video) {
        webcamRef.current.video.srcObject = stream;
      }
      
      console.log('✅ Got camera');
      setConnectionStatus('Camera ready');

      const newSocket = io(SIGNALING_SERVER);
      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('✅ Connected to server');
        setConnectionStatus('Connected to server');
        
        newSocket.emit('join-room', {
          roomId: roomId,
          role: 'interviewer',
          userName: userName
        });
      });

      newSocket.on('room-joined', (data) => {
        console.log('Joined room:', data);
        setConnectionStatus('Waiting for candidate...');
        
        if (data.otherPeerId) {
          setRemotePeerId(data.otherPeerId);
          setTimeout(() => {
            createAndSendOffer(data.otherPeerId);
          }, 1000);
        }
      });

      newSocket.on('peer-joined', (data) => {
        console.log('Candidate joined:', data);
        setRemotePeerId(data.peerId);
        setConnectionStatus('Candidate joined, connecting...');
        
        setTimeout(() => {
          createAndSendOffer(data.peerId);
        }, 1000);
      });

      // ============ ALERT HANDLER ============
      newSocket.on('alert', (data) => {
        console.log('🚨🚨🚨 ALERT RECEIVED FROM CANDIDATE:', data);
        console.log('Alert type:', data.type);
        console.log('Alert message:', data.message);
        console.log('Alert timestamp:', data.timestamp);
        
        // Add to alerts list
        setAlerts(prev => {
          const newAlerts = [data, ...prev].slice(0, 50); // Keep last 50
          console.log('Total alerts now:', newAlerts.length);
          return newAlerts;
        });
        
        // Update statistics
        setAlertStats(prev => {
          const newStats = { ...prev };
          
          if (data.type === 'LOOKING_AWAY') {
            newStats.lookingAway++;
            console.log('Looking away alerts:', newStats.lookingAway);
          } else if (data.type === 'TAB_SWITCHED') {
            newStats.tabSwitched++;
            console.log('Tab switch alerts:', newStats.tabSwitched);
          } else if (data.type === 'TEST_ALERT') {
            newStats.testAlerts++;
            console.log('Test alerts:', newStats.testAlerts);
          }
          
          return newStats;
        });
        
        // Play alert sound
        playAlertSound();
        
        // Show browser notification
        if (Notification.permission === 'granted') {
          const notification = new Notification('🚨 Interview Alert', {
            body: data.message,
            icon: '⚠️',
            tag: 'interview-alert'
          });
          
          setTimeout(() => notification.close(), 5000);
        }
        
        console.log('✅ Alert processed successfully');
      });

      newSocket.on('offer', handleOffer);
      newSocket.on('answer', handleAnswer);
      newSocket.on('ice-candidate', handleIceCandidate);

    } catch (error) {
      console.error('Init error:', error);
      setConnectionStatus('Error: ' + error.message);
    }
  };

  const playAlertSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      console.log('🔊 Alert sound played');
    } catch (error) {
      console.error('Audio error:', error);
    }
  };

  const createPeerConnection = (peerId) => {
    if (peerConnectionRef.current) {
      console.log('Reusing existing peer connection');
      return peerConnectionRef.current;
    }

    console.log('🔗 Creating peer connection');
    
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
      console.log('➕ Added local track:', track.kind);
    });

    pc.ontrack = (event) => {
      console.log('📥 Received remote track:', event.track.kind);
      
      if (remoteVideoRef.current) {
        if (!remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject = event.streams[0];
          console.log('✅ Set remote video stream');
          setConnectionStatus('✅ Connected!');
        }
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
      console.log('🌐 ICE State:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('✅ Connected!');
      } else if (pc.iceConnectionState === 'failed') {
        setConnectionStatus('❌ Connection failed');
      }
    };

    return pc;
  };

  const createAndSendOffer = async (peerId) => {
    console.log('📤 Creating offer for:', peerId);
    
    const pc = createPeerConnection(peerId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('✅ Created offer');

      socketRef.current.emit('offer', {
        targetId: peerId,
        offer: offer
      });
      console.log('📤 Sent offer');

      setConnectionStatus('Sent offer, waiting for answer...');
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  };

  const handleOffer = async (data) => {
    console.log('📥 Received offer (interviewer should not receive offers)');
    // Interviewer creates offers, doesn't receive them
  };

  const handleAnswer = async (data) => {
    console.log('📥 Received answer from candidate');
    const pc = peerConnectionRef.current;
    
    if (!pc) {
      console.error('❌ No peer connection exists');
      return;
    }

    try {
      console.log('Current signaling state:', pc.signalingState);
      
      if (pc.signalingState !== 'have-local-offer') {
        console.log('⚠️ Not in correct state, ignoring answer');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('✅ Set remote description from answer');
      setConnectionStatus('Answer received, connecting...');
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (data) => {
    const pc = peerConnectionRef.current;
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    }
  };

  const cleanup = () => {
    console.log('Cleaning up...');
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'LOOKING_AWAY':
        return '👀';
      case 'TAB_SWITCHED':
        return '🔄';
      case 'TEST_ALERT':
        return '🧪';
      default:
        return '⚠️';
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'critical':
        return { bg: '#f8d7da', border: '#dc3545', text: '#721c24' };
      case 'high':
        return { bg: '#fff3cd', border: '#ffc107', text: '#856404' };
      case 'medium':
        return { bg: '#fff3cd', border: '#ffc107', text: '#856404' };
      default:
        return { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460' };
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <h1>Interviewer Dashboard - Room: {roomId}</h1>
      
      <div style={{
        padding: '15px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div><strong>Status:</strong> {connectionStatus}</div>
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          <strong>Alert Statistics:</strong> 
          <span style={{ marginLeft: '10px' }}>👀 Looking Away: {alertStats.lookingAway}</span>
          <span style={{ marginLeft: '10px' }}>🔄 Tab Switched: {alertStats.tabSwitched}</span>
          <span style={{ marginLeft: '10px' }}>🧪 Test: {alertStats.testAlerts}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left side - Videos */}
        <div>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>Candidate Video</h3>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ 
                width: '100%', 
                borderRadius: '8px',
                backgroundColor: '#000'
              }}
            />
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px' }}>
            <h3>You (Interviewer)</h3>
            <Webcam
              ref={webcamRef}
              audio={false}
              style={{ 
                width: '100%', 
                borderRadius: '8px',
                backgroundColor: '#000'
              }}
            />
          </div>
        </div>

        {/* Right side - Alerts Panel */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', maxHeight: '800px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginTop: 0 }}>🚨 Live Alerts ({alerts.length})</h3>
          
          {alerts.length === 0 ? (
            <div style={{ 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#28a745',
              fontSize: '16px',
              textAlign: 'center',
              padding: '40px 20px'
            }}>
              <div>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>✅</div>
                <div><strong>No Violations Detected</strong></div>
                <div style={{ fontSize: '14px', marginTop: '5px', color: '#666' }}>
                  Candidate is following interview protocols
                </div>
              </div>
            </div>
          ) : (
            <div style={{ 
              flex: 1,
              overflowY: 'auto',
              marginTop: '15px'
            }}>
              {alerts.map((alert, index) => {
                const colors = getAlertColor(alert.severity);
                return (
                  <div
                    key={index}
                    style={{
                      padding: '15px',
                      marginBottom: '12px',
                      backgroundColor: colors.bg,
                      border: `2px solid ${colors.border}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      animation: index === 0 ? 'slideIn 0.3s ease-out' : 'none'
                    }}
                  >
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: colors.text, 
                      marginBottom: '8px',
                      fontSize: '15px'
                    }}>
                      {getAlertIcon(alert.type)} {alert.type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ marginBottom: '8px', color: colors.text }}>
                      {alert.message}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      ⏰ {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default InterviewerView;
