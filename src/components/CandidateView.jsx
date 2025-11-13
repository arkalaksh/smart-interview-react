import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import io from 'socket.io-client';
import { SIGNALING_SERVER, iceServers } from '../utils/config';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const CandidateView = ({ roomId, userName }) => {
  // Connection and Eye Tracking States
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [isLookingAway, setIsLookingAway] = useState(false);
  const [lookAwayCount, setLookAwayCount] = useState(0);
  const [gazeStatus, setGazeStatus] = useState('Not Started');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [isGazeActive, setIsGazeActive] = useState(false);
  const [currentGaze, setCurrentGaze] = useState({ x: 0, y: 0 });

  // Speech Recognition and AI Detection States
  const [transcribedText, setTranscribedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [aiDetectionScore, setAiDetectionScore] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [detectionMethod, setDetectionMethod] = useState('');

  // Refs
  const webcamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const lookAwayTimerRef = useRef(null);
  const webgazerInitialized = useRef(false);
  const cleanupExecuted = useRef(false);
  const isLookingAwayRef = useRef(false);

  // Speech Recognition Hook
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const calibrationPoints = [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 10, y: 90 },
    { x: 90, y: 90 }
  ];

  // Initialize connection and WebGazer
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
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadGazer = async () => {
      if (webgazerInitialized.current || !mounted) return;
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
  }, []);

  // ==================== SPEECH TO TEXT ====================
  
  const startSpeechRecognition = () => {
    if (!browserSupportsSpeechRecognition) {
      alert('Your browser does not support speech recognition. Please use Chrome or Edge.');
      return;
    }
    
    console.log('🎤 Starting speech recognition...');
    resetTranscript();
    setIsRecording(true);
    setTranscribedText('');
    setAiDetectionScore(null);
    setDetectionMethod('');
    
    SpeechRecognition.startListening({ 
      continuous: true,
      language: 'en-US',
      interimResults: true
    });
  };

  const stopSpeechRecognition = async () => {
    console.log('🛑 Stopping speech recognition...');
    SpeechRecognition.stopListening();
    setIsRecording(false);
    
    if (transcript.trim().length > 0) {
      setTranscribedText(transcript);
      console.log('📝 Transcript captured:', transcript.length, 'characters');
      await analyzeTextWithAI(transcript);
    } else {
      console.log('⚠️ No transcript to analyze');
      alert('No speech detected. Please try speaking again.');
    }
  };

  // ==================== RULE-BASED AI DETECTION (FALLBACK) ====================
  
  const analyzeTextRuleBased = (text) => {
    console.log('🔍 Using rule-based AI detection (fallback)...');
    
    const textLower = text.toLowerCase();
    const words = text.split(/\s+/);
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    let score = 0;
    const indicators = {
      // AI tends to use formal phrases
      formalPhrases: [
        'furthermore', 'moreover', 'in conclusion', 'it is important to note',
        'consequently', 'therefore', 'thus', 'hence', 'indeed', 'nevertheless',
        'additionally', 'specifically', 'particularly', 'essentially'
      ],
      // AI uses complex/formal words
      complexWords: [
        'utilize', 'facilitate', 'implement', 'optimize', 'leverage',
        'paradigm', 'synergy', 'comprehensive', 'robust', 'enhance',
        'demonstrate', 'indicate', 'significant', 'substantial'
      ],
      // Human speech has filler words
      humanFillers: [
        'um', 'uh', 'like', 'you know', 'i mean', 'kind of', 'sort of',
        'basically', 'actually', 'literally', 'honestly', 'well'
      ],
      // AI rarely uses contractions
      contractions: ["don't", "can't", "won't", "isn't", "aren't", "hasn't", "haven't"]
    };
    
    // Check for formal phrases (+15 each)
    indicators.formalPhrases.forEach(phrase => {
      if (textLower.includes(phrase)) score += 15;
    });
    
    // Check for complex words (+10 each)
    indicators.complexWords.forEach(word => {
      if (textLower.includes(word)) score += 10;
    });
    
    // Check for human fillers (lack of them is AI indicator)
    const fillerCount = indicators.humanFillers.reduce((count, filler) => {
      return count + (textLower.match(new RegExp(`\\b${filler}\\b`, 'g')) || []).length;
    }, 0);
    
    if (fillerCount === 0 && sentences.length > 2) {
      score += 20; // No fillers = likely AI
    } else if (fillerCount > 3) {
      score -= 20; // Many fillers = likely human
    }
    
    // Check contractions (AI rarely uses them)
    const contractionCount = indicators.contractions.reduce((count, contraction) => {
      return count + (textLower.includes(contraction) ? 1 : 0);
    }, 0);
    
    if (contractionCount === 0 && words.length > 30) {
      score += 15; // No contractions in long text = likely AI
    }
    
    // Check sentence consistency (AI tends to have uniform sentence length)
    if (sentences.length > 1) {
      const lengths = sentences.map(s => s.trim().length);
      const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
      const stdDev = Math.sqrt(variance);
      
      // Low variance = consistent length = likely AI
      if (stdDev < 20 && avgLength > 50) {
        score += 15;
      }
    }
    
    // Check average sentence length (AI tends to be 80-150 chars)
    const avgSentenceLength = text.length / sentences.length;
    if (avgSentenceLength > 80 && avgSentenceLength < 150) {
      score += 10;
    }
    
    // Check for personal pronouns (AI is less personal)
    const personalPronouns = (text.match(/\b(i|me|my|mine|we|us|our)\b/gi) || []).length;
    const pronounRatio = personalPronouns / words.length;
    
    if (pronounRatio < 0.02 && words.length > 30) {
      score += 15; // Very impersonal = likely AI
    }
    
    // Ensure score is between 0-100
    const finalScore = Math.max(0, Math.min(100, score));
    
    console.log('Rule-based detection score:', finalScore);
    console.log('Indicators found:', {
      fillers: fillerCount,
      contractions: contractionCount,
      avgSentenceLength: avgSentenceLength.toFixed(1)
    });
    
    return finalScore;
  };

  // ==================== AI DETECTION WITH FALLBACK ====================
  
  const analyzeTextWithAI = async (text) => {
    if (!text || text.trim().length < 20) {
      alert('Please speak at least a few sentences for AI detection to work.');
      return;
    }
    
    setIsAnalyzing(true);
    
    // First, try Hugging Face API
    try {
      console.log('🔍 Attempting Hugging Face AI detection...');
      const apiResult = await tryHuggingFaceAPI(text);
      
      if (apiResult !== null) {
        setAiDetectionScore(apiResult.score);
        setCurrentModel(apiResult.model);
        setDetectionMethod('Hugging Face API');
        
        if (apiResult.score > 60) {
          sendAlert({
            type: 'AI_GENERATED_RESPONSE',
            message: `Possible AI-generated answer detected (${apiResult.score}% confidence)`,
            severity: apiResult.score > 80 ? 'critical' : 'medium',
            timestamp: new Date().toISOString(),
            aiData: {
              percentage: apiResult.score,
              model: apiResult.model,
              method: 'API',
              textSample: text.substring(0, 200)
            }
          });
        }
        
        setIsAnalyzing(false);
        return;
      }
    } catch (error) {
      console.log('⚠️ Hugging Face API unavailable:', error.message);
    }
    
    // Fallback to rule-based detection
    console.log('🔄 Using rule-based detection as fallback...');
    const ruleScore = analyzeTextRuleBased(text);
    
    setAiDetectionScore(ruleScore);
    setCurrentModel('Rule-based Algorithm');
    setDetectionMethod('Local Analysis');
    
    if (ruleScore > 60) {
      sendAlert({
        type: 'AI_GENERATED_RESPONSE',
        message: `Possible AI-generated answer detected (${ruleScore}% confidence - Rule-based)`,
        severity: ruleScore > 80 ? 'critical' : 'medium',
        timestamp: new Date().toISOString(),
        aiData: {
          percentage: ruleScore,
          method: 'rule-based',
          textSample: text.substring(0, 200)
        }
      });
    }
    
    setIsAnalyzing(false);
  };

  // ==================== HUGGING FACE API WITH RETRY ====================
  
  const tryHuggingFaceAPI = async (text, retries = 3) => {
    const models = [
      'roberta-base-openai-detector',
      'Hello-SimpleAI/chatgpt-detector-roberta',
      'andreas122001/roberta-base-ai-detector'
    ];
    
    for (const model of models) {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          console.log(`Attempt ${attempt + 1}/${retries} with model: ${model}`);
          
          const response = await fetch(
            `https://api-inference.huggingface.co/models/${model}`,
            {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                inputs: text,
                options: {
                  wait_for_model: true,
                  use_cache: false
                }
              })
            }
          );
          
          if (response.status === 503) {
            const data = await response.json();
            if (data.error && data.error.includes('loading')) {
              const waitTime = data.estimated_time || 20;
              console.log(`Model loading, waiting ${waitTime} seconds...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
              continue; // Retry
            }
          }
          
          if (!response.ok) {
            console.log(`Model ${model} returned status ${response.status}`);
            continue; // Try next model
          }
          
          const result = await response.json();
          
          if (result.error) {
            console.log(`Model ${model} error:`, result.error);
            continue;
          }
          
          if (Array.isArray(result) && result.length > 0) {
            const fakeResult = result.find(r => 
              r.label?.toLowerCase().includes('fake') ||
              r.label?.toLowerCase().includes('ai') ||
              r.label === 'LABEL_1'
            );
            
            if (fakeResult) {
              const score = Math.round(fakeResult.score * 100);
              console.log(`✅ Success with ${model}: ${score}%`);
              return { score, model };
            }
          }
          
        } catch (error) {
          console.log(`Error with ${model} (attempt ${attempt + 1}):`, error.message);
          if (attempt < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
          }
        }
      }
    }
    
    return null; // All models failed
  };

  // ==================== EYE TRACKING & CONNECTION FUNCTIONS ====================
  // [Keep all your existing functions: loadWebGazer, startCalibration, etc.]
  
  const loadWebGazer = async () => {
    return new Promise((resolve, reject) => {
      if (window.webgazer) {
        setGazeStatus('Ready to calibrate');
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
      script.async = true;
      script.onload = () => {
        setTimeout(() => {
          if (window.webgazer) {
            window.webgazer.showVideoPreview(false);
            window.webgazer.showFaceOverlay(false);
            window.webgazer.showFaceFeedbackBox(false);
            setGazeStatus('Ready to calibrate');
            resolve();
          } else {
            reject(new Error('WebGazer not found'));
          }
        }, 500);
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const startCalibration = async () => {
    if (!window.webgazer) {
      alert('WebGazer not loaded. Please refresh.');
      return;
    }
    setIsCalibrating(true);
    setCalibrationStep(0);
    setGazeStatus('Initializing...');
    try {
      if (window.webgazer.isReady?.()) {
        await window.webgazer.end();
        await new Promise(r => setTimeout(r, 500));
      }
      await window.webgazer.setRegression('ridge').setTracker('TFFacemesh').saveDataAcrossSessions(false).begin();
      setGazeStatus('Detecting face...');
      await waitForFaceDetection();
      setGazeStatus('Calibrating - Step 1/4');
      window.webgazer.showPredictionPoints(true);
      window.webgazer.showVideoPreview(false);
      window.webgazer.showFaceOverlay(false);
      window.webgazer.showFaceFeedbackBox(false);
    } catch (error) {
      setGazeStatus('Error: ' + error.message);
      setIsCalibrating(false);
      alert('Calibration failed.');
    }
  };

  const waitForFaceDetection = () => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        const pred = window.webgazer.getCurrentPrediction();
        if (pred?.x && pred?.y) {
          clearInterval(check);
          resolve();
        } else if (attempts >= 50) {
          clearInterval(check);
          reject(new Error('Timeout'));
        }
      }, 200);
    });
  };

  const handleCalibrationClick = async (point, index) => {
    if (!window.webgazer || calibrationStep !== index) return;
    const x = (point.x / 100) * window.innerWidth;
    const y = (point.y / 100) * window.innerHeight;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 50));
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
    setIsCalibrating(false);
    setGazeStatus('Starting tracking...');
    window.webgazer.showPredictionPoints(false);
    await new Promise(r => setTimeout(r, 1000));
    setupGazeTracking();
  };

  const setupGazeTracking = () => {
    let validCount = 0;
    window.webgazer.clearGazeListener();
    window.webgazer.setGazeListener((data) => {
      if (!data) return;
      validCount++;
      const x = Math.round(data.x);
      const y = Math.round(data.y);
      requestAnimationFrame(() => setCurrentGaze({ x, y }));
      if (validCount === 10) {
        setIsGazeActive(true);
        setGazeStatus('✅ Tracking Active');
      }
      if (validCount >= 10) checkGazePosition(x, y);
    });
  };

  const checkGazePosition = (x, y) => {
    const margin = 200;
    const isOnScreen = x > -margin && x < window.innerWidth + margin && y > -margin && y < window.innerHeight + margin;
    if (!isOnScreen && !isLookingAwayRef.current) {
      isLookingAwayRef.current = true;
      setIsLookingAway(true);
      lookAwayTimerRef.current = setTimeout(() => {
        sendAlert({
          type: 'LOOKING_AWAY',
          message: 'Candidate looking away',
          severity: 'medium',
          timestamp: new Date().toISOString(),
          gazeData: { x, y }
        });
        setLookAwayCount(prev => prev + 1);
      }, 2000);
    } else if (isOnScreen && isLookingAwayRef.current) {
      if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
      isLookingAwayRef.current = false;
      setIsLookingAway(false);
    }
  };

  const setupTabDetection = () => {
    const handler = () => {
      if (document.hidden) {
        sendAlert({
          type: 'TAB_SWITCHED',
          message: 'Candidate switched tabs',
          severity: 'critical',
          timestamp: new Date().toISOString()
        });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  };

  const sendAlert = (alertData) => {
    if (!socketRef.current?.connected) {
      console.log('Alert:', alertData);
      return;
    }
    socketRef.current.emit('alert', { roomId, ...alertData });
  };

  const initializeConnection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      localStreamRef.current = stream;
      if (webcamRef.current?.video) webcamRef.current.video.srcObject = stream;
      setConnectionStatus('Camera ready');

      const newSocket = io(SIGNALING_SERVER);
      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on('connect', () => {
        setConnectionStatus('Connected');
        newSocket.emit('join-room', { roomId, role: 'candidate', userName });
      });
      newSocket.on('room-joined', () => setConnectionStatus('Waiting for interviewer...'));
      newSocket.on('peer-joined', () => setConnectionStatus('Interviewer connected'));
      newSocket.on('offer', handleOffer);
      newSocket.on('ice-candidate', handleIceCandidate);
    } catch (error) {
      setConnectionStatus('Error: ' + error.message);
    }
  };

  const createPeerConnection = (peerId) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnectionStatus('✅ Video connected!');
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', { candidate: event.candidate, targetId: peerId });
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
      socketRef.current.emit('answer', { targetId: data.senderId, answer });
      setConnectionStatus('Connecting...');
    } catch (error) {
      console.error('Offer error:', error);
    }
  };

  const handleIceCandidate = async (data) => {
    const pc = peerConnectionRef.current;
    if (pc?.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('ICE error:', error);
      }
    }
  };

  const cleanupConnection = () => {
    if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    if (socketRef.current) socketRef.current.disconnect();
  };

  const cleanupWebGazer = () => {
    if (window.webgazer) {
      try {
        window.webgazer.clearGazeListener();
        window.webgazer.end();
      } catch (e) {}
    }
  };

  // ==================== RENDER ====================

  if (isCalibrating) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999 }}>
        <div style={{ position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)', color: 'white', textAlign: 'center', zIndex: 10001 }}>
          <h2 style={{ margin: 0 }}>👁️ Eye Gaze Calibration</h2>
          <p style={{ fontSize: '18px', color: '#ffc107', margin: '10px 0' }}>{gazeStatus}</p>
          <p style={{ fontSize: '14px', color: '#ccc' }}><strong>Look at each RED DOT and click it</strong></p>
        </div>
        {calibrationPoints.map((point, index) => (
          <div key={index} onClick={() => handleCalibrationClick(point, index)} style={{
            position: 'absolute', left: `${point.x}%`, top: `${point.y}%`,
            width: calibrationStep === index ? '60px' : '40px',
            height: calibrationStep === index ? '60px' : '40px',
            borderRadius: '50%', backgroundColor: calibrationStep === index ? '#dc3545' : '#666',
            cursor: calibrationStep === index ? 'pointer' : 'not-allowed',
            transform: 'translate(-50%, -50%)', animation: calibrationStep === index ? 'pulse 1s infinite' : 'none',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: '24px',
            border: calibrationStep === index ? '4px solid yellow' : '2px solid #444',
            boxShadow: calibrationStep === index ? '0 0 20px rgba(220, 53, 69, 0.8)' : 'none'
          }}>{index + 1}</div>
        ))}
        <style>{`@keyframes pulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.2); }}`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1>Candidate - Room: {roomId}</h1>
      
      {/* Connection Status */}
      <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', marginBottom: '20px' }}>
        <div><strong>Connection:</strong> {connectionStatus}</div>
        <div style={{ marginTop: '8px' }}>
          <strong>Eye Tracking:</strong> 
          <span style={{ color: isGazeActive ? 'green' : 'orange', marginLeft: '8px', fontWeight: 'bold' }}>
            {gazeStatus}
          </span>
          {isLookingAway && <span style={{ color: 'red', marginLeft: '10px', fontWeight: 'bold' }}>⚠️ LOOKING AWAY</span>}
        </div>
        <div style={{ marginTop: '10px' }}>
          {!isGazeActive && !isCalibrating && (
            <button onClick={startCalibration} disabled={gazeStatus === 'Not Started'} style={{
              padding: '12px 24px', backgroundColor: gazeStatus === 'Not Started' ? '#ccc' : '#007bff',
              color: 'white', border: 'none', borderRadius: '5px',
              cursor: gazeStatus === 'Not Started' ? 'not-allowed' : 'pointer',
              fontWeight: 'bold', fontSize: '16px'
            }}>👁️ Start Calibration</button>
          )}
        </div>
      </div>

      {isLookingAway && (
        <div style={{
          padding: '20px', backgroundColor: '#dc3545', color: 'white', borderRadius: '8px',
          marginBottom: '20px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold',
          animation: 'blink 1s infinite'
        }}>🚨 LOOK BACK AT THE SCREEN!</div>
      )}

      {/* Speech & AI Detection */}
      <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>🎤 Answer Monitoring</h3>
        
        <div style={{ padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '6px', marginBottom: '15px', fontSize: '13px', border: '1px solid #2196f3' }}>
          <strong>ℹ️ Detection Method:</strong> Tries Hugging Face API first, falls back to rule-based analysis if unavailable
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Status:</strong> 
          <span style={{ color: listening ? 'green' : 'gray', marginLeft: '8px', fontWeight: 'bold' }}>
            {listening ? '🔴 Recording' : '⚫ Stopped'}
          </span>
        </div>
        
        {isAnalyzing && (
          <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', border: '2px solid #ffc107' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>🔄 Analyzing Answer...</div>
            <div style={{ fontSize: '12px', color: '#856404' }}>Trying API, will use fallback if needed</div>
          </div>
        )}
        
        {aiDetectionScore !== null && !isAnalyzing && (
          <div style={{ padding: '20px', backgroundColor: aiDetectionScore > 60 ? '#ffebee' : '#e8f5e9', borderRadius: '10px', marginBottom: '15px', border: `3px solid ${aiDetectionScore > 60 ? '#ef5350' : '#66bb6a'}` }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>AI Detection Result:</div>
            <div style={{ color: aiDetectionScore > 60 ? '#d32f2f' : '#388e3c', fontSize: '32px', fontWeight: 'bold' }}>
              {aiDetectionScore}% AI-Generated
            </div>
            <div style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '6px', fontSize: '12px', color: '#666', marginTop: '10px' }}>
              <div><strong>Method:</strong> {detectionMethod}</div>
              <div><strong>Model:</strong> {currentModel}</div>
              <div><strong>Text Length:</strong> {transcribedText.length} chars</div>
            </div>
            {aiDetectionScore > 60 && (
              <div style={{ padding: '12px', backgroundColor: '#ffcdd2', borderRadius: '6px', fontSize: '14px', color: '#c62828', fontWeight: '600', marginTop: '10px', border: '1px solid #ef5350' }}>
                ⚠️ <strong>High AI Probability!</strong> Interviewer has been notified.
              </div>
            )}
            {aiDetectionScore <= 60 && (
              <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '6px', fontSize: '14px', color: '#2e7d32', fontWeight: '600', marginTop: '10px' }}>
                ✅ Answer appears human-generated
              </div>
            )}
          </div>
        )}
        
        {listening && transcript && (
          <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', fontSize: '14px', marginBottom: '15px', border: '2px solid #4caf50' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#2e7d32' }}>📝 Live Transcript:</div>
            <div>{transcript}</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
              Words: {transcript.split(' ').length} | Characters: {transcript.length}
            </div>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {!listening ? (
            <button onClick={startSpeechRecognition} disabled={!browserSupportsSpeechRecognition || isAnalyzing} style={{
              flex: 1, padding: '15px', backgroundColor: (!browserSupportsSpeechRecognition || isAnalyzing) ? '#ccc' : '#28a745',
              color: 'white', border: 'none', borderRadius: '8px',
              cursor: (!browserSupportsSpeechRecognition || isAnalyzing) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold', fontSize: '16px'
            }}>🎤 Start Recording</button>
          ) : (
            <button onClick={stopSpeechRecognition} disabled={isAnalyzing} style={{
              flex: 1, padding: '15px', backgroundColor: isAnalyzing ? '#ccc' : '#dc3545',
              color: 'white', border: 'none', borderRadius: '8px',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold', fontSize: '16px'
            }}>⏹️ Stop & Analyze</button>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
          <h3>You (Candidate)</h3>
          <Webcam ref={webcamRef} audio={false} style={{ width: '100%', borderRadius: '8px', border: isLookingAway ? '5px solid #dc3545' : '2px solid #28a745' }} />
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
          <h3>Interviewer</h3>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '8px', backgroundColor: '#000' }} />
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        #webgazerVideoFeed, #webgazerVideoContainer, #webgazerFaceOverlay, #webgazerFaceFeedbackBox { display: none !important; }
        button:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      `}</style>
    </div>
  );
};

export default CandidateView;
