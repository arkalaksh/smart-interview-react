import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import io from 'socket.io-client';
import { SIGNALING_SERVER, iceServers } from '../utils/config';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
// import TranscriptSaver from './TranscriptSaver';


const CandidateView = ({ roomId, userName: propUserName }) => {
  // ==================== PERSIST STATE KEY ====================
  const STORAGE_KEY = `interview_${roomId}_candidate`;

  // ==================== LOAD SAVED STATE OR USE DEFAULTS ====================
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
       // console.log('✅ Restored saved state:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('❌ Error loading saved state:', error);
    }
    return {
      currentStep: 'name',
      candidateName: propUserName || '',
      calibrationCompleted: false
    };
  };

  const initialState = getInitialState();

  // ==================== FLOW STATES ====================
  const [currentStep, setCurrentStep] = useState(initialState.currentStep);
  const [candidateName, setCandidateName] = useState(initialState.candidateName);
  const [calibrationCompleted, setCalibrationCompleted] = useState(initialState.calibrationCompleted);

  // Connection and Eye Tracking States
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Not connected');
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

  // Pause Detection States
  // const [lastSpeechTime, setSecondsSinceLastSpeech] = useState(Date.now());
  // const [secondsSinceLastSpeech, setSecondsSinceLastSpeech] = useState(0);

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
  // const pauseTimerRef = useRef(null);
  const lastTranscriptRef = useRef('');
  // const PAUSE_THRESHOLD = 10000;
  const speechStartedRef = useRef(false);  // ✅ ADD THIS LINE

  const batchTimerRef = useRef(null);



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

  const proxyUrl = 'http://localhost:5000/api/auth/ai-detect';
  const model = 'roberta-base-openai-detector';

  // ==================== SAVE STATE TO LOCALSTORAGE ====================
  
  useEffect(() => {
    const stateToSave = {
      currentStep,
      candidateName,
      calibrationCompleted
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    console.log('💾 Saved state to localStorage:', stateToSave);
    
  }, [currentStep, candidateName, calibrationCompleted, STORAGE_KEY]);

  // ==================== COMPONENT MOUNT LOGGER ====================
  
  useEffect(() => {
    console.log('🔵 ========== CANDIDATE VIEW MOUNTED ==========');
    console.log('Room ID:', roomId);
    console.log('Current Step:', currentStep);
    console.log('Candidate Name:', candidateName);
    console.log('Calibration Completed:', calibrationCompleted);
    
    return () => {
      console.log('🔴 ========== CANDIDATE VIEW UNMOUNTED ==========');
    };
  }, []);

  // ==================== SKIP TO MEETING IF ALREADY CALIBRATED ====================
  
  useEffect(() => {
    if (calibrationCompleted && currentStep === 'calibration') {
      console.log('✅ Calibration already completed, skipping to meeting...');
      setTimeout(() => {
        setCurrentStep('meeting');
      }, 500);
    }
  }, [calibrationCompleted, currentStep]);

  // ==================== LOAD WEBGAZER ON CALIBRATION STEP ====================
  
  useEffect(() => {
    // Skip if already calibrated
    if (calibrationCompleted) {
      console.log('⏭️ Skipping WebGazer - already calibrated');
      return;
    }

    if (currentStep !== 'calibration' || webgazerInitialized.current) return;
    
    console.log('👁️ ========== LOADING WEBGAZER ==========');
    
    const initWebGazer = async () => {
      try {
        await loadWebGazer();
        webgazerInitialized.current = true;
        
        console.log('✅ WebGazer loaded! Auto-starting calibration in 1 second...');
        setTimeout(() => {
          startCalibration();
        }, 1000);
        
      } catch (error) {
        console.error('❌ Failed to load WebGazer:', error);
        alert('Failed to load eye tracking. Please refresh.');
      }
    };
    
    initWebGazer();
    
  }, [currentStep, calibrationCompleted]);

// ==================== LOG SPEECH STATUS TO CONSOLE ====================

// useEffect(() => {
//   if (!listening || !transcript) return;
  
//   const wordCount = transcript.trim().split(/\s+/).length;
  
//   console.log('🎤 Recording:', wordCount, 'words');
//   // console.log('⏱️ Pause:', secondsSinceLastSpeech, 's / 10s');
  
//   if (isAnalyzing) {
//     console.log('⏳ Analyzing answer...');
//   } else if (secondsSinceLastSpeech >= 10) {
//     console.log('🔍 Will analyze soon...');
//   }
  
//   if (aiDetectionScore !== null) {
//     console.log('📊 Last AI Detection Score:', aiDetectionScore + '%');
//     console.log('🔧 Detection Method:', detectionMethod);
//   }
  
// }, [listening, transcript, secondsSinceLastSpeech, isAnalyzing, aiDetectionScore, detectionMethod]);


  // ==================== INITIALIZE CONNECTION (RUNS ON MEETING STEP) ====================
  
  useEffect(() => {
    if (currentStep !== 'meeting') return;
    
    console.log('🔌 Meeting step - Initializing connection...');
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
  }, [currentStep]);

  // ==================== AUTO-START SPEECH RECOGNITION ====================
  
  useEffect(() => {
    if (currentStep === 'meeting' && browserSupportsSpeechRecognition && !speechStartedRef.current) {
      console.log('✅ Auto-starting speech recognition...');
      setTimeout(() => {
        startSpeechRecognition();
        speechStartedRef.current = true;
      }, 2000); // Wait 2 seconds after entering meeting
    }
  }, [currentStep, browserSupportsSpeechRecognition]);

  // ==================== PAUSE DETECTION ====================
  
  // useEffect(() => {
  //   if (!listening || !transcript) return;

  //   if (pauseTimerRef.current) {
  //     clearTimeout(pauseTimerRef.current);
  //   }

  //   if (transcript !== lastTranscriptRef.current && transcript.trim().length > 0) {
  //     lastTranscriptRef.current = transcript;
  //     setLastSpeechTime(Date.now());

  //     pauseTimerRef.current = setTimeout(() => {
  //       const wordCount = transcript.trim().split(/\s+/).length;
        
  //       if (wordCount >= 5) {
  //         console.log(`🔍 10-second pause detected. Analyzing ${wordCount} words...`);
  //         const textToAnalyze = transcript.trim();
  //         analyzeTextWithAI(textToAnalyze);
  //         resetTranscript();
  //         lastTranscriptRef.current = '';
  //         setSecondsSinceLastSpeech(0);
  //       }
  //     }, PAUSE_THRESHOLD);
  //   }

  //   return () => {
  //     if (pauseTimerRef.current) {
  //       clearTimeout(pauseTimerRef.current);
  //     }
  //   };
  // }, [transcript, listening]);

  // useEffect(() => {
  //   if (!listening) return;
    
  //   const interval = setInterval(() => {
  //     const elapsed = Math.floor((Date.now() - lastSpeechTime) / 1000);
  //     setSecondsSinceLastSpeech(elapsed);
  //   }, 1000);
    
  //   return () => clearInterval(interval);
  // }, [listening, lastSpeechTime]);


  useEffect(() => {
  if (!listening) return;

  // Get interval from .env (fallback to 3 minutes)
  const intervalMinutes = parseInt(process.env.REACT_APP_SPEECH_SAVE_INTERVAL_MINUTES || '3');
  const BATCH_DURATION = intervalMinutes * 60 * 1000; // Convert to ms

  // Start a fresh timer
  if (batchTimerRef.current) clearInterval(batchTimerRef.current);

  batchTimerRef.current = setInterval(() => {
    const spoken = transcript.trim();

    if (spoken.length > 0) {
      console.log(`⏱️ ${intervalMinutes}-minute batch saving:`, spoken);

      analyzeTextWithAI(spoken);   // save & analyze
      resetTranscript();           // clear speech buffer
    }
  }, BATCH_DURATION);

  return () => {
    if (batchTimerRef.current) clearInterval(batchTimerRef.current);
  };
}, [listening, transcript]);


  // ==================== FIX VIDEO VISIBILITY ====================

  useEffect(() => {
    if (currentStep !== 'meeting') return;
    
    console.log('🔧 Monitoring video visibility...');
    
    const interval = setInterval(() => {
      const remoteVideo = document.getElementById('interviewer-remote-video');
      const localVideo = document.getElementById('candidate-local-video');
      
      if (remoteVideo && (remoteVideo.style.display === 'none' || remoteVideo.style.visibility === 'hidden')) {
        console.warn('⚠️ Interviewer video hidden! Restoring...');
        remoteVideo.style.display = 'block';
        remoteVideo.style.visibility = 'visible';
      }
      
      if (localVideo && (localVideo.style.display === 'none' || localVideo.style.visibility === 'hidden')) {
        console.warn('⚠️ Candidate video hidden! Restoring...');
        localVideo.style.display = 'block';
        localVideo.style.visibility = 'visible';
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentStep]);

  // ==================== CLEANUP ON UNMOUNT ====================
  
  useEffect(() => {
    return () => {
      if (!cleanupExecuted.current) {
        cleanupWebGazer();
        cleanupExecuted.current = true;
      }
    };
  }, []);

  //===================== save the answers to db ==============
const saveAnswerToDatabase = async ({ roomId, candidateName, answerText, wordCount, aiScore, detectionMethod, modelUsed }) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/answers/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        candidateName,
        answerText,
        wordCount,
        aiScore,
        detectionMethod,
        modelUsed
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('💾 Answer saved to DB with ID:', data.answerId);
      
      // ✅ GENERATE COMBINED TRANSCRIPT
      try {
        const transcriptRes = await fetch('http://localhost:5000/api/conversation/generate-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId })
        });
        
        const transcriptData = await transcriptRes.json();
        if (transcriptRes.ok) {
          console.log('📝 Combined transcript updated:', transcriptData.message);
        } else {
          console.warn('⚠️ Transcript generation failed:', transcriptData.error);
        }
      } catch (transcriptErr) {
        console.error('❌ Transcript generation error:', transcriptErr);
      }
    } else {
      console.error('❌ Failed to save answer:', data.error);
    }
  } catch (error) {
    console.error('❌ Network error saving answer:', error);
  }
};



  // ==================== STEP 1: NAME ENTRY ====================
 const handleNameSubmit = async () => {
  if (!candidateName.trim()) {
    alert('Please enter your name');
    return;
  }
  
  console.log('✅ Name entered:', candidateName);
  
  // 🚀 Save candidate name to database
  try {
    const response = await fetch('http://localhost:5000/api/auth/rooms/update-candidate-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, candidateName: candidateName.trim() })
    });
    
    const data = await response.json(); // ✅ PARSE RESPONSE
    
    if (response.ok) {
      console.log('💾 Candidate name saved:', data.message);
    } else {
      console.error('❌ Save failed:', data.error || 'Unknown error'); // ✅ BETTER ERROR
      console.warn('⚠️ Failed to save name (continuing anyway)');
    }
  } catch (error) {
    console.error('❌ Network error:', error);
  }
  
  console.log('➡️ Moving to calibration');
  setCurrentStep('calibration');
};


  // ==================== STEP 2: WEBGAZER & CALIBRATION ====================

  const loadWebGazer = () => {
    console.log('👁️ Loading WebGazer...');
    
    return new Promise((resolve, reject) => {
      if (window.webgazer) {
        console.log('✅ WebGazer already loaded');
        setGazeStatus('Ready');
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
      script.async = true;
      
      script.onload = () => {
        console.log('✅ WebGazer script loaded');
        setTimeout(() => {
          if (window.webgazer) {
            window.webgazer.showVideoPreview(false);
            window.webgazer.showFaceOverlay(false);
            window.webgazer.showFaceFeedbackBox(false);
            setGazeStatus('Ready');
            console.log('✅ WebGazer ready');
            resolve();
          } else {
            reject(new Error('WebGazer not found'));
          }
        }, 1500);
      };
      
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const startCalibration = async () => {
    console.log('🎯 ========== STARTING CALIBRATION ==========');
    
    if (!window.webgazer) {
      alert('Eye tracking not loaded. Refreshing...');
      window.location.reload();
      return;
    }
    
    setIsCalibrating(true);
    setCalibrationStep(0);
    setGazeStatus('Initializing camera...');
    
    try {
      if (window.webgazer.isReady?.()) {
        await window.webgazer.end();
        await new Promise(r => setTimeout(r, 500));
      }
      
      console.log('🚀 Starting WebGazer...');
      await window.webgazer
        .setRegression('ridge')
        .setTracker('TFFacemesh')
        .saveDataAcrossSessions(false)
        .begin();
      
      console.log('✅ WebGazer started');
      setGazeStatus('Detecting face...');
      
      await waitForFaceDetection();
      
      console.log('✅ Face detected!');
      setGazeStatus('Click dot 1 of 4');
      
      window.webgazer.showPredictionPoints(true);
      window.webgazer.showVideoPreview(false);
      window.webgazer.showFaceOverlay(false);
      window.webgazer.showFaceFeedbackBox(false);
      
    } catch (error) {
      console.error('❌ Calibration failed:', error);
      setGazeStatus('Error: ' + error.message);
      setIsCalibrating(false);
      alert('Calibration failed. Allow camera access and try again.');
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
        } else if (attempts >= 100) {
          clearInterval(check);
          reject(new Error('Face detection timeout'));
        }
      }, 200);
    });
  };

  const handleCalibrationClick = async (point, index) => {
    if (!window.webgazer || calibrationStep !== index) return;
    
    console.log(`🎯 Calibration ${index + 1}/4`);
    setGazeStatus(`Calibrating ${index + 1}/4...`);
    
    const x = (point.x / 100) * window.innerWidth;
    const y = (point.y / 100) * window.innerHeight;
    
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 50));
      window.webgazer.recordScreenPosition(x, y, 'click');
    }
    
    if (calibrationStep < calibrationPoints.length - 1) {
      setCalibrationStep(prev => prev + 1);
      setGazeStatus(`Click dot ${calibrationStep + 2} of 4`);
    } else {
      await finishCalibration();
    }
  };

  const finishCalibration = async () => {
    console.log('🏁 Finishing calibration...');
    
    setIsCalibrating(false);
    setGazeStatus('Finalizing...');
    window.webgazer.showPredictionPoints(false);
    
    await new Promise(r => setTimeout(r, 500));
    
    // Hide WebGazer UI elements
    ['webgazerVideoFeed', 'webgazerVideoContainer', 'webgazerFaceOverlay', 'webgazerFaceFeedbackBox'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      }
    });
    
    // ✅ MARK CALIBRATION AS COMPLETED
    setCalibrationCompleted(true);
    console.log('✅ Calibration marked as completed');
    
    setupGazeTracking();
  };

  const setupGazeTracking = () => {
    console.log('👁️ Setting up gaze tracking...');
    
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
        setGazeStatus('✅ Active');
        console.log('✅ Eye tracking active! Moving to meeting...');
        
        setTimeout(() => {
          setCurrentStep('meeting');
        }, 1000);
      }
      
      if (validCount >= 10 && currentStep === 'meeting') {
        checkGazePosition(x, y);
      }
    });
  };

  const checkGazePosition = (x, y) => {
    const margin = 200;
    const isOnScreen = x > -margin && x < window.innerWidth + margin && 
                       y > -margin && y < window.innerHeight + margin;
    
    if (!isOnScreen && !isLookingAwayRef.current) {
      isLookingAwayRef.current = true;
      setIsLookingAway(true);
      
      lookAwayTimerRef.current = setTimeout(() => {
        sendAlert({
          roomId,
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

  // ==================== [KEEP ALL YOUR OTHER FUNCTIONS THE SAME] ====================
  
  const startSpeechRecognition = () => {
    if (!browserSupportsSpeechRecognition) {
      console.error('❌ Browser does not support speech recognition');
      return;
    }
    
    console.log('🎤 Starting speech recognition...');
    resetTranscript();
    setIsRecording(true);
    setTranscribedText('');
    setAiDetectionScore(null);
    setDetectionMethod('');
    // setLastSpeechTime(Date.now());
    // setSecondsSinceLastSpeech(0);
    
    SpeechRecognition.startListening({ 
      continuous: true,
      language: 'en-US',
      interimResults: true
    });
  };

  const stopSpeechRecognition = async () => {
    console.log('🛑 Stopping speech recognition');
    SpeechRecognition.stopListening();
    setIsRecording(false);
    
    if (transcript.trim().length > 0) {
      setTranscribedText(transcript);
      await analyzeTextWithAI(transcript);
    }
  };

  const analyzeTextRuleBased = (text) => {
    const textLower = text.toLowerCase();
    const words = text.split(/\s+/);
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    let score = 0;
    const indicators = {
      formalPhrases: [
        'furthermore', 'moreover', 'in conclusion', 'it is important to note',
        'consequently', 'therefore', 'thus', 'hence', 'indeed', 'nevertheless',
        'additionally', 'specifically', 'particularly', 'essentially'
      ],
      complexWords: [
        'utilize', 'facilitate', 'implement', 'optimize', 'leverage',
        'paradigm', 'synergy', 'comprehensive', 'robust', 'enhance'
      ],
      humanFillers: [
        'um', 'uh', 'like', 'you know', 'i mean', 'kind of', 'sort of'
      ]
    };
    
    indicators.formalPhrases.forEach(phrase => {
      if (textLower.includes(phrase)) score += 15;
    });
    
    indicators.complexWords.forEach(word => {
      if (textLower.includes(word)) score += 10;
    });
    
    const fillerCount = indicators.humanFillers.reduce((count, filler) => {
      return count + (textLower.match(new RegExp(`\\b${filler}\\b`, 'g')) || []).length;
    }, 0);
    
    if (fillerCount === 0 && sentences.length > 2) score += 20;
    else if (fillerCount > 3) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  };

const analyzeTextWithAI = async (text) => {
  if (!text || text.trim().length < 10) return;

  console.log('🔍 Analyzing text...');
  setIsAnalyzing(true);

  const wordCount = text.trim().split(/\s+/).length;
  
  try {
    const apiResult = await tryHuggingFaceAPI(text);
    
    let aiScore, detectionMethod, modelUsed;
    if (apiResult !== null) {
      aiScore = apiResult.score;
      detectionMethod = "Hugging Face API";
      modelUsed = apiResult.model;
    } else {
      aiScore = analyzeTextRuleBased(text);
      detectionMethod = "Rule-based Algorithm";
      modelUsed = "Local Pattern Matching";
    }

    // Save answer and AI results to the database
    await saveAnswerToDatabase({
      roomId,
      candidateName,
      answerText: text.trim(),
      wordCount,
      aiScore,
      detectionMethod,
      modelUsed
    });

    setAiDetectionScore(aiScore);
    setCurrentModel(modelUsed);
    setDetectionMethod(detectionMethod);

    sendAlert({
      roomId,
      type: "AI_DETECTION_RESULT",
      message: `AI Detection: ${aiScore}% likelihood`,
      severity: aiScore > 70 ? "high" : aiScore > 50 ? "medium" : "low",
      timestamp: new Date().toISOString(),
      aiData: {
        aiScore,
        detectionMethod,
        model: modelUsed,
        textAnalyzed: text.substring(0, 300),
        fullTextLength: text.length,
        wordCount
      },
    });

  } catch (error) {
    console.log('⚠️ API unavailable, using rule-based');
  }

  setIsAnalyzing(false);
};


  const tryHuggingFaceAPI = async (text) => {
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model }),
      });
      
      if (!response.ok) throw new Error('API Error');
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const setupTabDetection = () => {
    const handler = () => {
      if (document.hidden) {
        sendAlert({
          roomId,
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
      console.error('❌ Socket not connected');
      return;
    }
    
    try {
      socketRef.current.emit('alert', alertData);
      console.log('✅ Alert sent:', alertData.type);
    } catch (error) {
      console.error('❌ Error sending alert:', error);
    }
  };

  const initializeConnection = async () => {
    console.log('🔌 Initializing connection...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      localStreamRef.current = stream;
      if (webcamRef.current?.video) webcamRef.current.video.srcObject = stream;
      setConnectionStatus('Connecting...');

      const newSocket = io(SIGNALING_SERVER, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id);
        setConnectionStatus('Connected');
        newSocket.emit('join-room', { roomId, role: 'candidate', userName: candidateName });
      });
      
      newSocket.on('room-joined', (data) => {
        console.log('✅ Joined room');
        setConnectionStatus('Waiting for interviewer...');
      });
      
      newSocket.on('peer-joined', (data) => {
        console.log('✅ Interviewer joined');
        setConnectionStatus('Interviewer connected');
      });
      
      newSocket.on('offer', handleOffer);
      newSocket.on('ice-candidate', handleIceCandidate);
      
      newSocket.on('disconnect', (reason) => {
        console.warn('⚠️ Disconnected:', reason);
        setConnectionStatus('Disconnected');
      });
      
    } catch (error) {
      console.error('❌ Connection error:', error);
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
        console.log('✅ Remote video connected');
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
    console.log('📨 Received offer');
    const pc = createPeerConnection(data.senderId);
    
    try {
      if (pc.signalingState !== 'stable') return;
      
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit('answer', { targetId: data.senderId, answer: pc.localDescription });
      
      setConnectionStatus('Connecting...');
    } catch (error) {
      console.error('❌ Offer error:', error);
    }
  };

  const handleIceCandidate = async (data) => {
    const pc = peerConnectionRef.current;
    if (pc?.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('❌ ICE error:', error);
      }
    }
  };

  const cleanupConnection = () => {
    console.log('🧹 Cleaning up...');
    
    // if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
    if (listening) SpeechRecognition.stopListening();
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

  // ==================== ADD RESET BUTTON (OPTIONAL) ====================
  
  const handleResetCalibration = () => {
    if (window.confirm('Reset calibration? You will need to calibrate again.')) {
      console.log('🔄 Resetting calibration...');
      setCalibrationCompleted(false);
      setCurrentStep('calibration');
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // ==================== RENDER ====================

  // STEP 1: NAME ENTRY
  if (currentStep === 'name') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Arial',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '450px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>👁️</div>
            <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>Join Interview</h2>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Step 1 of 3: Enter your name</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555', fontSize: '14px' }}>
              Your Full Name *
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleNameSubmit(); }}
              placeholder="Enter your name"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          </div>

          <button
            onClick={handleNameSubmit}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
          >
            Continue to Calibration →
          </button>

          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#e3f2fd',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#1976d2'
          }}>
            <strong>📋 Next:</strong> Eye tracking calibration (~30 sec)
          </div>

          <p style={{ textAlign: 'center', fontSize: '11px', color: '#999', marginTop: '15px' }}>
            🔒 Room: <code>{roomId.substring(0, 8)}...</code>
          </p>
        </div>
      </div>
    );
  }

  // STEP 2: CALIBRATION
  if (currentStep === 'calibration' && !calibrationCompleted) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999 }}>
        <div style={{ position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)', color: 'white', textAlign: 'center', zIndex: 10001, width: '90%', maxWidth: '600px' }}>
          <h2 style={{ margin: 0, fontSize: '28px' }}>👁️ Eye Gaze Calibration</h2>
          <p style={{ fontSize: '20px', color: '#ffc107', margin: '15px 0', fontWeight: 'bold' }}>{gazeStatus}</p>
          <p style={{ fontSize: '16px', color: '#ccc' }}>
            {isCalibrating ? <>👆 <strong>Look at the RED DOT and CLICK it</strong></> : <>⏳ Loading...</>}
          </p>
        </div>
        
        {isCalibrating && calibrationPoints.map((point, index) => (
          <div key={index} onClick={() => handleCalibrationClick(point, index)} style={{
            position: 'absolute', left: `${point.x}%`, top: `${point.y}%`,
            width: calibrationStep === index ? '70px' : '40px',
            height: calibrationStep === index ? '70px' : '40px',
            borderRadius: '50%', backgroundColor: calibrationStep === index ? '#dc3545' : '#555',
            cursor: calibrationStep === index ? 'pointer' : 'default',
            transform: 'translate(-50%, -50%)', animation: calibrationStep === index ? 'pulse 1s infinite' : 'none',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: '28px',
            border: calibrationStep === index ? '5px solid #ffc107' : '2px solid #333',
            boxShadow: calibrationStep === index ? '0 0 30px rgba(220, 53, 69, 1)' : 'none'
          }}>{index + 1}</div>
        ))}
        
        <style>{`@keyframes pulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.15); }}`}</style>
      </div>
    );
  }

  // STEP 3: MEETING
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      
      {/* Socket Status */}
      {/* <div style={{ 
        position: 'fixed', top: '10px', right: '10px',
        backgroundColor: socketRef.current?.connected ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)',
        padding: '5px 10px', borderRadius: '5px',
        fontSize: '10px', color: '#666',
        border: `1px solid ${socketRef.current?.connected ? 'green' : 'red'}`,
        zIndex: 1000
      }}>
        Socket: {socketRef.current?.connected ? '✅ Connected' : '❌ Disconnected'}
        {listening && ` | 🎤 ${transcript.split(' ').length} words`}
      </div> */}

      {/* ✅ OPTIONAL: Reset Calibration Button */}
      {calibrationCompleted && (
        <button
          onClick={handleResetCalibration}
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            padding: '8px 12px',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold',
            zIndex: 1000
          }}
        >
          🔄 Reset Calibration
        </button>
      )}

      {/* Speech Status */}
      {/* {listening && transcript && (
        <div style={{
          position: 'fixed', top: '50px', right: '10px',
          backgroundColor: secondsSinceLastSpeech >= 8 ? 'rgba(255,165,0,0.2)' : 'rgba(0,123,255,0.1)',
          padding: '10px 15px', borderRadius: '8px',
          border: `2px solid ${secondsSinceLastSpeech >= 8 ? 'orange' : '#007bff'}`,
          fontSize: '12px', fontWeight: 'bold',
          zIndex: 1000,
          maxWidth: '280px'
        }}>
          <div style={{ marginBottom: '5px', color: '#333' }}>
            🎤 Recording: <strong>{transcript.trim().split(/\s+/).length}</strong> words
          </div>
          <div style={{ color: secondsSinceLastSpeech >= 8 ? 'orange' : '#666', marginBottom: '5px' }}>
            {isAnalyzing ? '⏳ Analyzing...' : 
             secondsSinceLastSpeech >= 10 ? '🔍 Will analyze...' : 
             `⏱️ Pause: ${secondsSinceLastSpeech}s / 10s`}
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #ddd' }}>
            💡 Stop speaking for 10s to analyze
          </div>
          {aiDetectionScore !== null && (
            <div style={{ 
              marginTop: '8px', 
              padding: '6px', 
              backgroundColor: aiDetectionScore > 70 ? 'rgba(255,0,0,0.15)' : 
                               aiDetectionScore > 50 ? 'rgba(255,165,0,0.15)' : 'rgba(0,255,0,0.15)',
              borderRadius: '4px',
              fontSize: '11px',
              borderLeft: `3px solid ${aiDetectionScore > 70 ? 'red' : aiDetectionScore > 50 ? 'orange' : 'green'}`
            }}>
              <div style={{ fontWeight: 'bold' }}>Last:</div>
              <div>Score: <strong>{aiDetectionScore}%</strong></div>
              <div style={{ fontSize: '9px', color: '#666' }}>{detectionMethod}</div>
            </div>
          )}
        </div>
      )} */}

      {/* VIDEO GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Interviewer Video */}
        <div style={{ backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', position: 'relative' }}>
          <video 
            id="interviewer-remote-video"
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            style={{ width: '100%', height: '500px', objectFit: 'cover', display: 'block' }} 
          />
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '5px', fontSize: '12px' }}>
            Interviewer
          </div>
        </div>

        {/* Candidate Video */}
        <div style={{ 
          backgroundColor: '#000', 
          borderRadius: '12px', 
          overflow: 'hidden', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
          border: isLookingAway ? '5px solid #dc3545' : 'none',
          position: 'relative'
        }}>
          <Webcam 
            id="candidate-local-video"
            ref={webcamRef} 
            audio={false} 
            style={{ width: '100%', height: '500px', objectFit: 'cover', display: 'block' }} 
          />
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '5px', fontSize: '12px' }}>
            {candidateName} {isLookingAway && '⚠️ Looking Away'}
          </div>
          <div style={{ position: 'absolute', top: '10px', right: '10px', color: 'white', backgroundColor: 'rgba(0,255,0,0.6)', padding: '5px 10px', borderRadius: '5px', fontSize: '10px' }}>
            👁️ Eye Tracking {calibrationCompleted ? 'Active (Persisted)' : 'Active'}
          </div>
        </div>
        
      </div>

      <style>{`
        #webgazerVideoFeed, 
        #webgazerVideoContainer, 
        #webgazerFaceOverlay, 
        #webgazerFaceFeedbackBox { 
          display: none !important; 
          visibility: hidden !important;
        }
        
        #interviewer-remote-video,
        #candidate-local-video {
          display: block !important;
          visibility: visible !important;
        }
        
        button:hover { transform: translateY(-2px); transition: all 0.3s ease; }
      `}</style>
       {/* Transcript saving helper */}
    {/* {currentStep === 'meeting' && <TranscriptSaver roomId={roomId} senderRole="candidate" />} */}
    </div>
  );
};

export default CandidateView;
