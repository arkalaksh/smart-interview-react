import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import io from 'socket.io-client';
import { SIGNALING_SERVER, iceServers } from '../utils/config';

const CandidateView = ({ roomId, userName }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [isLookingAway, setIsLookingAway] = useState(false);
  const [lookAwayCount, setLookAwayCount] = useState(0);
  const [gazeStatus, setGazeStatus] = useState('Not Started');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [isGazeActive, setIsGazeActive] = useState(false);
  const [currentGaze, setCurrentGaze] = useState({ x: 0, y: 0 });

  const webcamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const lookAwayTimerRef = useRef(null);
  const webgazerInitialized = useRef(false); // Changed from hasInitialized
  const gazeCheckCount = useRef(0);
  const cleanupExecuted = useRef(false);

  const calibrationPoints = [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 10, y: 90 },
    { x: 90, y: 90 }
  ];

  // Separate effect for connection (runs once)
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mounted) return;
      await initializeConnection();
      setupTabDetection();
    };

    init();

    return () => {
      mounted = false;
      cleanupConnection();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Separate effect for WebGazer (runs once, properly handles cleanup)
  useEffect(() => {
    let mounted = true;

    const loadGazer = async () => {
      if (webgazerInitialized.current || !mounted) {
        console.log('WebGazer already initialized or unmounted');
        return;
      }

      await loadWebGazer();
      webgazerInitialized.current = true;
    };

    loadGazer();

    return () => {
      mounted = false;
      if (!cleanupExecuted.current) {
        cleanupWebGazer();
        cleanupExecuted.current = true;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWebGazer = async () => {
    return new Promise((resolve, reject) => {
      if (window.webgazer) {
        console.log('✅ WebGazer already loaded');
        setGazeStatus('Ready to calibrate');
        resolve();
        return;
      }

      console.log('📥 Loading WebGazer...');
      const script = document.createElement('script');
      script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
      script.async = true;
      
      script.onload = () => {
        console.log('✅ WebGazer script loaded');
        // Wait for WebGazer to fully initialize
        setTimeout(() => {
          if (window.webgazer) {
            setGazeStatus('Ready to calibrate');
            resolve();
          } else {
            reject(new Error('WebGazer not found after load'));
          }
        }, 500);
      };
      
      script.onerror = (error) => {
        console.error('❌ Failed to load WebGazer:', error);
        setGazeStatus('Failed to load');
        reject(error);
      };
      
      document.body.appendChild(script);
    });
  };

  const startCalibration = async () => {
    if (!window.webgazer) {
      alert('WebGazer not loaded. Please refresh the page.');
      return;
    }

    console.log('🎯 Starting calibration...');
    setIsCalibrating(true);
    setCalibrationStep(0);
    setGazeStatus('Initializing camera...');

    try {
      // Clear any existing listeners/data
      if (window.webgazer.isReady && window.webgazer.isReady()) {
        console.log('Stopping existing WebGazer...');
        await window.webgazer.end();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Initialize WebGazer
      console.log('Starting WebGazer...');
      await window.webgazer
        .setRegression('ridge')
        .setTracker('TFFacemesh')
        .saveDataAcrossSessions(false)
        .begin();

      console.log('✅ WebGazer started, waiting for face detection...');
      setGazeStatus('Detecting face...');

      // Wait for face detection to initialize (CRITICAL)
      await waitForFaceDetection();

      console.log('✅ Face detected! Ready to calibrate');
      setGazeStatus('Calibrating - Step 1/4');

      // Configure display
      window.webgazer.showPredictionPoints(true);
      window.webgazer.showVideoPreview(false);
      window.webgazer.showFaceOverlay(false);

    } catch (error) {
      console.error('❌ Calibration start error:', error);
      setGazeStatus('Error: ' + error.message);
      setIsCalibrating(false);
      alert('Calibration failed. Make sure your face is visible and try again.');
    }
  };

  // CRITICAL: Wait for WebGazer to detect face before calibrating
  const waitForFaceDetection = () => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 10 seconds timeout

      const checkReady = setInterval(() => {
        attempts++;

        // Check if WebGazer is getting prediction data
        const prediction = window.webgazer.getCurrentPrediction();
        
        if (prediction !== null && prediction.x && prediction.y) {
          console.log('✅ First prediction received:', prediction);
          clearInterval(checkReady);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkReady);
          reject(new Error('Face detection timeout. Ensure your face is visible and well-lit.'));
        } else {
          console.log(`⏳ Waiting for face detection... (${attempts}/${maxAttempts})`);
        }
      }, 200);
    });
  };

  const handleCalibrationClick = async (point, index) => {
    if (!window.webgazer || calibrationStep !== index) return;

    const x = (point.x / 100) * window.innerWidth;
    const y = (point.y / 100) * window.innerHeight;

    console.log(`📍 Calibration point ${index + 1}/4 at (${Math.round(x)}, ${Math.round(y)})`);

    // Record multiple samples
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      window.webgazer.recordScreenPosition(x, y, 'click');
    }

    if (calibrationStep < calibrationPoints.length - 1) {
      setCalibrationStep(prev => prev + 1);
      setGazeStatus(`Calibrating - Step ${calibrationStep + 2}/4`);
    } else {
      await finishCalibration();
    }
  };

  const finishCalibration = async () => {
    console.log('✅ Calibration complete!');
    setIsCalibrating(false);
    setGazeStatus('Starting tracking...');
    
    window.webgazer.showPredictionPoints(false);
    
    // Wait a moment for calibration to settle
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setupGazeTracking();
  };

  const setupGazeTracking = () => {
    console.log('👁️ Setting up gaze tracking...');
    
    let nullCount = 0;
    let validCount = 0;

    // Clear any existing listener first
    window.webgazer.clearGazeListener();

    // Set new listener
    window.webgazer.setGazeListener((data, timestamp) => {
      if (!data) {
        nullCount++;
        if (nullCount % 50 === 0) {
          console.log(`⚠️ No gaze data: ${nullCount} frames`);
        }
        return;
      }

      // Got valid data
      nullCount = 0;
      validCount++;

      const x = Math.round(data.x);
      const y = Math.round(data.y);
      
      setCurrentGaze({ x, y });

      // Log first few predictions
      if (validCount <= 5) {
        console.log(`✅ Gaze prediction #${validCount}:`, x, y);
      }

      // Activate tracking after getting consistent data
      if (validCount === 10) {
        setIsGazeActive(true);
        setGazeStatus('✅ Tracking Active');
        console.log('🎉 Eye tracking fully active!');
      }

      // Start checking gaze position
      if (validCount >= 10) {
        checkGazePosition(x, y);
      }
    });

    console.log('✅ Gaze listener set');
  };

  const checkGazePosition = (x, y) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const margin = 300;
    
    const isOnScreen = 
      x > -margin && 
      x < screenWidth + margin && 
      y > -margin && 
      y < screenHeight + margin;

    if (!isOnScreen && !lookAwayTimerRef.current) {
      console.log('⚠️ Eyes off screen:', x, y);
      setIsLookingAway(true);
      
      lookAwayTimerRef.current = setTimeout(() => {
        console.log('🚨 ALERT: Looking away!');
        
        sendAlert({
          type: 'LOOKING_AWAY',
          message: 'Candidate looking away from screen',
          severity: 'medium',
          timestamp: new Date().toISOString(),
          gazeData: { x, y, screenWidth, screenHeight }
        });
        
        setLookAwayCount(prev => prev + 1);
      }, 3000);
    } else if (isOnScreen && lookAwayTimerRef.current) {
      console.log('✅ Eyes back on screen');
      clearTimeout(lookAwayTimerRef.current);
      lookAwayTimerRef.current = null;
      setIsLookingAway(false);
    }
  };

  const setupTabDetection = () => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🚨 Tab switched!');
        sendAlert({
          type: 'TAB_SWITCHED',
          message: 'Candidate switched tabs',
          severity: 'critical',
          timestamp: new Date().toISOString()
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    console.log('✅ Tab detection active');

    // Return cleanup function (important for React 18)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  };

  const sendAlert = (alertData) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Socket not connected');
      console.log('Alert data that would be sent:', alertData);
      return;
    }

    console.log('📤 Sending alert:', alertData.type);
    socketRef.current.emit('alert', {
      roomId: roomId,
      ...alertData
    });
    console.log('✅ Alert emitted');
  };

  const sendTestAlert = () => {
    const testData = {
      type: 'TEST_ALERT',
      message: 'Test alert from candidate',
      severity: 'low',
      timestamp: new Date().toISOString()
    };
    
    console.log('🧪 Sending test alert:', testData);
    sendAlert(testData);
    alert('Test alert sent! Check console and interviewer view.');
  };

  const initializeConnection = async () => {
    try {
      console.log('📷 Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      localStreamRef.current = stream;
      
      if (webcamRef.current?.video) {
        webcamRef.current.video.srcObject = stream;
      }
      
      console.log('✅ Camera ready');
      setConnectionStatus('Camera ready');

      console.log('🔌 Connecting to signaling server...');
      const newSocket = io(SIGNALING_SERVER);
      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('✅ Socket connected');
        setConnectionStatus('Connected');
        
        newSocket.emit('join-room', {
          roomId: roomId,
          role: 'candidate',
          userName: userName
        });
      });

      newSocket.on('room-joined', () => {
        console.log('✅ Joined room');
        setConnectionStatus('Waiting for interviewer...');
      });

      newSocket.on('peer-joined', () => {
        console.log('✅ Interviewer joined');
        setConnectionStatus('Interviewer connected');
      });

      newSocket.on('offer', handleOffer);
      newSocket.on('ice-candidate', handleIceCandidate);

    } catch (error) {
      console.error('❌ Connection error:', error);
      setConnectionStatus('Error: ' + error.message);
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
        setConnectionStatus('✅ Video connected!');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          targetId: peerId
        });
      }
    };

    return pc;
  };

  const handleOffer = async (data) => {
    const pc = createPeerConnection(data.senderId);

    try {
      if (pc.signalingState !== 'stable') return;

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('answer', {
        targetId: data.senderId,
        answer: answer
      });

      setConnectionStatus('Connecting...');
    } catch (error) {
      console.error('Offer error:', error);
    }
  };

  const handleIceCandidate = async (data) => {
    const pc = peerConnectionRef.current;
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('ICE error:', error);
      }
    }
  };

  const cleanupConnection = () => {
    console.log('🧹 Cleaning up connection...');
    if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (socketRef.current) socketRef.current.disconnect();
  };

  const cleanupWebGazer = () => {
    console.log('🧹 Cleaning up WebGazer...');
    if (window.webgazer) {
      try {
        window.webgazer.clearGazeListener();
        window.webgazer.end();
      } catch (e) {
        console.error('WebGazer cleanup error:', e);
      }
    }
  };

  if (isCalibrating) {
    return (
      <div style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(0,0,0,0.95)', 
        zIndex: 9999 
      }}>
        <div style={{ 
          position: 'absolute', 
          top: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          textAlign: 'center',
          zIndex: 10001
        }}>
          <h2 style={{ margin: 0 }}>👁️ Eye Gaze Calibration</h2>
          <p style={{ fontSize: '18px', color: '#ffc107', margin: '10px 0' }}>
            {gazeStatus}
          </p>
          <p style={{ fontSize: '14px', color: '#ccc' }}>
            <strong>Look at each RED DOT and click it</strong>
          </p>
        </div>

        {calibrationPoints.map((point, index) => (
          <div
            key={index}
            onClick={() => handleCalibrationClick(point, index)}
            style={{
              position: 'absolute',
              left: `${point.x}%`,
              top: `${point.y}%`,
              width: calibrationStep === index ? '60px' : '40px',
              height: calibrationStep === index ? '60px' : '40px',
              borderRadius: '50%',
              backgroundColor: calibrationStep === index ? '#dc3545' : '#666',
              cursor: calibrationStep === index ? 'pointer' : 'not-allowed',
              transform: 'translate(-50%, -50%)',
              animation: calibrationStep === index ? 'pulse 1s infinite' : 'none',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '24px',
              border: calibrationStep === index ? '4px solid yellow' : '2px solid #444',
              boxShadow: calibrationStep === index ? '0 0 20px rgba(220, 53, 69, 0.8)' : 'none'
            }}
          >
            {index + 1}
          </div>
        ))}

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1>Candidate - Room: {roomId}</h1>
      
      <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', marginBottom: '20px' }}>
        <div><strong>Connection:</strong> {connectionStatus}</div>
        <div style={{ marginTop: '8px' }}>
          <strong>Eye Tracking:</strong> 
          <span style={{ 
            color: isGazeActive ? 'green' : 'orange', 
            marginLeft: '8px',
            fontWeight: 'bold'
          }}>
            {gazeStatus}
          </span>
          {isLookingAway && (
            <span style={{ color: 'red', marginLeft: '10px', fontWeight: 'bold' }}>
              ⚠️ LOOKING AWAY
            </span>
          )}
        </div>
        {isGazeActive && (
          <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
            Gaze: ({currentGaze.x}, {currentGaze.y})
          </div>
        )}
        <div style={{ marginTop: '8px' }}>
          <strong>Alerts Sent:</strong> {lookAwayCount}
        </div>
        
        <div style={{ marginTop: '10px' }}>
          {!isGazeActive && !isCalibrating && (
            <button onClick={startCalibration} disabled={gazeStatus === 'Not Started'} style={{
              padding: '12px 24px',
              backgroundColor: gazeStatus === 'Not Started' ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: gazeStatus === 'Not Started' ? 'not-allowed' : 'pointer',
              marginRight: '10px',
              fontWeight: 'bold',
              fontSize: '16px'
            }}>
              👁️ Start Calibration
            </button>
          )}
          
          <button onClick={sendTestAlert} style={{
            padding: '8px 16px',
            backgroundColor: '#ffc107',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
            🧪 Test Alert
          </button>
        </div>

        {!isGazeActive && !isCalibrating && (
          <div style={{ 
            marginTop: '10px', 
            padding: '12px', 
            backgroundColor: '#fff3cd', 
            borderRadius: '4px',
            border: '1px solid #ffc107'
          }}>
            <strong>ℹ️ Eye tracking not active</strong>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>
              {gazeStatus === 'Not Started' 
                ? 'Loading WebGazer... Please wait.' 
                : 'Click "Start Calibration" and look at 4 corner points.'}
            </p>
          </div>
        )}
      </div>

      {isLookingAway && (
        <div style={{
          padding: '20px',
          backgroundColor: '#dc3545',
          color: 'white',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: 'bold',
          animation: 'blink 1s infinite'
        }}>
          🚨 LOOK BACK AT THE SCREEN!
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
          <h3>You (Candidate)</h3>
          <Webcam
            ref={webcamRef}
            audio={false}
            style={{ 
              width: '100%', 
              borderRadius: '8px', 
              border: isLookingAway ? '5px solid #dc3545' : '2px solid #28a745' 
            }}
          />
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
          <h3>Interviewer</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', borderRadius: '8px', backgroundColor: '#000' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default CandidateView;
//right one but replace calibratlit button