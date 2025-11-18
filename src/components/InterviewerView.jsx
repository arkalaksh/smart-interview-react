import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SIGNALING_SERVER, iceServers } from '../utils/config';

const InterviewerView = ({ roomId, userName }) => {
  console.log('👨‍💼 InterviewerView loaded - Room ID:', roomId, 'User:', userName);

  // Connection States
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [alerts, setAlerts] = useState([]);
  const [candidateConnected, setCandidateConnected] = useState(false);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  // ==================== CONNECTION INITIALIZATION ====================
  
  useEffect(() => {
    console.log('🔌 Interviewer initializing connection...');
    let mounted = true;
    
    const init = async () => {
      if (!mounted) return;
      await initializeConnection();
    };
    
    init();
    
    return () => {
      console.log('🧹 Interviewer cleaning up...');
      mounted = false;
      cleanupConnection();
    };
  }, []);

  const initializeConnection = async () => {
    console.log('🔌 ========== INTERVIEWER CONNECTION INIT ==========');
    
    try {
      console.log('📹 Requesting interviewer camera and microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      console.log('✅ Media stream obtained');
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('✅ Local video attached');
      }
      
      setConnectionStatus('Camera ready');

      console.log('🔌 Creating socket connection to:', SIGNALING_SERVER);
      const newSocket = io(SIGNALING_SERVER, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      socketRef.current = newSocket;
      setSocket(newSocket);
      console.log('✅ Socket instance created');

      newSocket.on('connect', () => {
        console.log('✅ ========== INTERVIEWER SOCKET CONNECTED ==========');
        console.log('🆔 Socket ID:', newSocket.id);
        setConnectionStatus('Connected');
        
        console.log('🚪 Joining room as INTERVIEWER:', roomId);
        newSocket.emit('join-room', { roomId, role: 'interviewer', userName });
      });
      
      newSocket.on('room-joined', (data) => {
        console.log('✅ Interviewer joined room:', data);
        setConnectionStatus('Waiting for candidate...');
      });
      
      newSocket.on('peer-joined', (data) => {
        console.log('✅ Candidate joined:', data);
        setConnectionStatus('Candidate connected');
        setCandidateConnected(true);
        
        // Interviewer creates offer
        createOffer(data.socketId);
      });
      
      newSocket.on('answer', handleAnswer);
      newSocket.on('ice-candidate', handleIceCandidate);
      
      // ==================== 🔥 ALERT HANDLER ====================
      newSocket.on('alert', (alertData) => {
        console.log('🚨 ========== ALERT RECEIVED ==========');
        console.log('Alert Type:', alertData.type);
        console.log('Alert Data:', alertData);
        
        // Add to alerts list
        setAlerts(prev => [{
          ...alertData,
          id: Date.now(),
          timestamp: new Date().toISOString()
        }, ...prev]);
        
        // Show notification
        if (alertData.type === 'AI_DETECTION_RESULT') {
          console.log('🤖 AI Detection Result:', alertData.aiData?.aiScore + '%');
        } else if (alertData.type === 'LOOKING_AWAY') {
          console.log('👁️ Candidate looking away detected');
        } else if (alertData.type === 'TAB_SWITCHED') {
          console.log('⚠️ Candidate switched tabs!');
        }
      });
      
      newSocket.on('disconnect', (reason) => {
        console.warn('⚠️ Socket disconnected:', reason);
        setConnectionStatus('Disconnected: ' + reason);
        setCandidateConnected(false);
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        setConnectionStatus('Connection error');
      });
      
    } catch (error) {
      console.error('❌ Connection initialization failed:', error);
      setConnectionStatus('Error: ' + error.message);
    }
  };

  const createOffer = async (peerId) => {
    console.log('📤 Creating offer for peer:', peerId);
    
    const pc = createPeerConnection(peerId);
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('📤 Sending offer to candidate');
      socketRef.current.emit('offer', { 
        targetId: peerId, 
        offer: pc.localDescription 
      });
      
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  };

  const createPeerConnection = (peerId) => {
    console.log('🔗 Creating peer connection for:', peerId);
    
    if (peerConnectionRef.current) {
      console.log('✅ Using existing peer connection');
      return peerConnectionRef.current;
    }
    
    console.log('🆕 Creating new RTCPeerConnection');
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;
    
    console.log('📤 Adding local tracks to peer connection');
    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
      console.log('✅ Added track:', track.kind);
    });
    
    pc.ontrack = (event) => {
      console.log('📥 Remote track received:', event.track.kind);
      if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnectionStatus('✅ Video connected!');
        console.log('✅ Remote video stream attached');
      }
    };
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log('🧊 Sending ICE candidate to peer');
        socketRef.current.emit('ice-candidate', { 
          candidate: event.candidate, 
          targetId: peerId 
        });
      }
    };
    
    console.log('✅ Peer connection created successfully');
    return pc;
  };

  const handleAnswer = async (data) => {
    console.log('📨 Received answer from candidate');
    
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('❌ No peer connection available');
      return;
    }
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('✅ Remote description set');
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (data) => {
    console.log('🧊 Received ICE candidate');
    
    const pc = peerConnectionRef.current;
    if (pc?.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('✅ ICE candidate added');
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    } else {
      console.warn('⚠️ Cannot add ICE candidate: No remote description');
    }
  };

  const cleanupConnection = () => {
    console.log('🧹 ========== CLEANING UP INTERVIEWER CONNECTIONS ==========');
    
    if (peerConnectionRef.current) {
      console.log('🔌 Closing peer connection');
      peerConnectionRef.current.close();
    }
    
    if (localStreamRef.current) {
      console.log('📹 Stopping local media tracks');
      localStreamRef.current.getTracks().forEach(t => {
        t.stop();
        console.log('⏹️ Stopped track:', t.kind);
      });
    }
    
    if (socketRef.current) {
      console.log('🔌 Disconnecting socket');
      socketRef.current.disconnect();
    }
    
    console.log('✅ Cleanup complete');
  };

  const clearAlert = (alertId) => {
    console.log('🗑️ Clearing alert:', alertId);
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const clearAllAlerts = () => {
    console.log('🗑️ Clearing all alerts');
    setAlerts([]);
  };

  // ==================== RENDER ====================

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      
      {/* Header */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>
            👨‍💼 Interviewer Dashboard
          </h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
            Room: <code style={{ backgroundColor: '#e0e0e0', padding: '2px 6px', borderRadius: '3px' }}>{roomId.substring(0, 12)}...</code>
          </p>
        </div>
        <div style={{
          padding: '10px 20px',
          backgroundColor: candidateConnected ? '#4caf50' : '#ff9800',
          color: 'white',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          {candidateConnected ? '✅ Candidate Connected' : '⏳ Waiting for Candidate'}
        </div>
      </div>

      {/* Video Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '1400px', margin: '0 auto 20px' }}>
        
        {/* Interviewer Video (Local) */}
        <div style={{ backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', position: 'relative' }}>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '500px', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '5px', fontSize: '12px' }}>
            You (Interviewer)
          </div>
        </div>

        {/* Candidate Video (Remote) */}
        <div style={{ backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', position: 'relative' }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '500px', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '5px', fontSize: '12px' }}>
            Candidate
          </div>
        </div>
      </div>

      {/* Alerts Panel */}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
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
                fontWeight: 'bold'
              }}
            >
              Clear All
            </button>
          )}
        </div>

        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          padding: '20px',
          maxHeight: '400px',
          overflowY: 'auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {alerts.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', margin: '40px 0' }}>
              No alerts yet. Monitoring is active.
            </p>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} style={{
                padding: '15px',
                marginBottom: '10px',
                borderRadius: '8px',
                border: `2px solid ${
                  alert.severity === 'critical' ? '#f44336' :
                  alert.severity === 'high' ? '#ff9800' :
                  alert.severity === 'medium' ? '#ffc107' : '#2196f3'
                }`,
                backgroundColor: `${
                  alert.severity === 'critical' ? '#ffebee' :
                  alert.severity === 'high' ? '#fff3e0' :
                  alert.severity === 'medium' ? '#fff9c4' : '#e3f2fd'
                }`,
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>
                      {alert.type === 'AI_DETECTION_RESULT' && '🤖 AI Detection Result'}
                      {alert.type === 'LOOKING_AWAY' && '👁️ Eye Tracking Alert'}
                      {alert.type === 'TAB_SWITCHED' && '⚠️ Tab Switch Detected'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#555', marginBottom: '8px' }}>
                      {alert.message}
                    </div>
                    {alert.aiData && (
                      <div style={{ fontSize: '12px', color: '#666', backgroundColor: 'white', padding: '8px', borderRadius: '4px', marginTop: '8px' }}>
                        <div><strong>AI Score:</strong> {alert.aiData.aiScore}%</div>
                        <div><strong>Method:</strong> {alert.aiData.detectionMethod}</div>
                        <div><strong>Words:</strong> {alert.aiData.wordCount}</div>
                        {alert.aiData.textAnalyzed && (
                          <div style={{ marginTop: '5px', fontStyle: 'italic', color: '#888' }}>
                            "{alert.aiData.textAnalyzed.substring(0, 100)}..."
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
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
                      fontSize: '12px'
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
