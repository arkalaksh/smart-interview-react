import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import io from 'socket.io-client';
import { SIGNALING_SERVER, iceServers, SOCKET_OPTIONS } from '../utils/config';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// ✅ DYNAMIC API URLs (production + local)
const getApiBase = () => {
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    return window.APP_CONFIG.API_BASE_URL;
  }

  const isProduction =
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.includes('localhost');

  return isProduction
    ? 'https://darkcyan-hornet-746720.hostingersite.com/api/auth'
    : 'http://localhost:5000/api/auth';
};

const API_BASE = getApiBase();
const CONVERSATION_BASE = API_BASE.replace('/auth', '/conversation');
const PROXY_URL = API_BASE.replace('/auth', '/auth/ai-detect');

console.log('🔗 CandidateView URLs:', { API_BASE, CONVERSATION_BASE, PROXY_URL, SIGNALING_SERVER, SOCKET_OPTIONS });

const CandidateView = ({ roomId, userName }) => {
  const STORAGE_KEY = `interview-${roomId}-candidate`;

  // ---------- LOAD SAVED STATE OR USE DEFAULTS ----------
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.error('Error loading saved state:', error);
    }
    return {
      currentStep: 'name',
      candidateName: userName || '',
      calibrationCompleted: false,
    };
  };

  const initialState = getInitialState();

  // ---------- FLOW STATES ----------
  const [currentStep, setCurrentStep] = useState(initialState.currentStep);
  const [candidateName, setCandidateName] = useState(initialState.candidateName);
  const [calibrationCompleted, setCalibrationCompleted] = useState(initialState.calibrationCompleted);

  // ---------- Connection and Eye Tracking States ----------
  const [socket, setSocket] = useState(null); // optional UI/debug
  const [connectionStatus, setConnectionStatus] = useState('Not connected');

  const [isLookingAway, setIsLookingAway] = useState(false);
  const [lookAwayCount, setLookAwayCount] = useState(0);

  const [gazeStatus, setGazeStatus] = useState('Not Started');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [isGazeActive, setIsGazeActive] = useState(false);
  const [currentGaze, setCurrentGaze] = useState({ x: 0, y: 0 });

  // ---------- Speech Recognition and AI Detection States ----------
  const [transcribedText, setTranscribedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [aiDetectionScore, setAiDetectionScore] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [detectionMethod, setDetectionMethod] = useState('');

  // ---------- FULL transcript ----------
  const [fullTranscript, setFullTranscript] = useState('');

  // ---------- Refs ----------
  const webcamRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  const lookAwayTimerRef = useRef(null);
  const webgazerInitialized = useRef(false);
  const cleanupExecuted = useRef(false);
  const isLookingAwayRef = useRef(false);

  const pendingIceCandidatesRef = useRef([]);
  const tabCleanupRef = useRef(null);

  // ---------- Transcript refs ----------
  const lastTranscriptRef = useRef('');
  const savedTranscriptRef = useRef('');
  const speechStartedRef = useRef(false);

  // ---------- Speech Recognition Hook ----------
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  // ---------- Calibration points ----------
  const calibrationPoints = [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 10, y: 90 },
    { x: 90, y: 90 },
  ];

  const model = 'roberta-base-openai-detector';

  // ---------- SAVE STATE TO LOCALSTORAGE ----------
  useEffect(() => {
    const stateToSave = {
      currentStep,
      candidateName,
      calibrationCompleted,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [currentStep, candidateName, calibrationCompleted, STORAGE_KEY]);

  // ---------- MOUNT LOGGER ----------
  useEffect(() => {
    console.log('👨‍💼 CANDIDATE VIEW MOUNTED - Room ID:', roomId);
    return () => console.log('🧹 CANDIDATE VIEW UNMOUNTED - Room ID:', roomId);
  }, [roomId]);

  // ---------- SKIP TO MEETING IF ALREADY CALIBRATED ----------
  useEffect(() => {
    if (calibrationCompleted && currentStep === 'calibration') {
      setTimeout(() => setCurrentStep('meeting'), 500);
    }
  }, [calibrationCompleted, currentStep]);

  // ---------- LOAD WEBGAZER ON CALIBRATION STEP ----------
  useEffect(() => {
    if (calibrationCompleted || currentStep !== 'calibration' || webgazerInitialized.current) return;

    const initWebGazer = async () => {
      try {
        await loadWebGazer();
        webgazerInitialized.current = true;
        setTimeout(startCalibration, 1000);
      } catch (error) {
        console.error('Failed to load WebGazer:', error);
        setGazeStatus('Eye tracking unavailable - continuing');
        setCalibrationCompleted(true);
        setTimeout(() => setCurrentStep('meeting'), 1000);
      }
    };

    initWebGazer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, calibrationCompleted]);

  // ---------- INITIALIZE CONNECTION (MEETING STEP) ----------
  useEffect(() => {
    if (currentStep !== 'meeting') return;

    let mounted = true;

    const init = async () => {
      if (!mounted) return;
      await initializeConnection();

      // Setup tab detection once (store cleanup)
      if (!tabCleanupRef.current) {
        tabCleanupRef.current = setupTabDetection();
      }
    };

    init();

    return () => {
      mounted = false;
      if (tabCleanupRef.current) {
        tabCleanupRef.current();
        tabCleanupRef.current = null;
      }
      cleanupConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // ---------- LIVE TRANSCRIPT BUILD ----------
  useEffect(() => {
    if (!listening) return;
    const currentText = transcript.trim();
    if (!currentText) return;

    if (currentText !== lastTranscriptRef.current) {
      setFullTranscript((prev) => {
        const updated = prev
          ? prev + '\n[Candidate Live]: ' + currentText
          : '[Candidate Live]: ' + currentText;
        lastTranscriptRef.current = currentText;
        return updated;
      });
    }
  }, [transcript, listening]);

  // ---------- AUTO-START SPEECH RECOGNITION ----------
  useEffect(() => {
    if (currentStep === 'meeting' && browserSupportsSpeechRecognition && !speechStartedRef.current) {
      console.log('✅ Auto-starting candidate speech recognition...');
      setTimeout(() => {
        startSpeechRecognition();
        speechStartedRef.current = true;
      }, 2000);
    }
  }, [currentStep, browserSupportsSpeechRecognition]);

  // ---------- AUTO-SAVE TRANSCRIPT EVERY 30 SECONDS ----------
  useEffect(() => {
    if (!listening) return;

    const interval = setInterval(async () => {
      const currentText = transcript.trim();
      if (!currentText) return;

      const newChunk = currentText.replace(savedTranscriptRef.current, '').trim();
      if (newChunk.length > 5) {
        console.log('💾 Auto-saving candidate answer chunk (30 sec)...', newChunk);
        await analyzeTextWithAI(newChunk);
        savedTranscriptRef.current = currentText;
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [listening, transcript]);

  // ---------- FIX VIDEO VISIBILITY ----------
  useEffect(() => {
    if (currentStep !== 'meeting') return;

    const interval = setInterval(() => {
      const remoteVideo = document.getElementById('interviewer-remote-video');
      const localVideo = document.getElementById('candidate-local-video');

      if (remoteVideo) {
        remoteVideo.style.display = 'block';
        remoteVideo.style.visibility = 'visible';
      }
      if (localVideo) {
        localVideo.style.display = 'block';
        localVideo.style.visibility = 'visible';
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentStep]);

  // ---------- CLEANUP ON UNMOUNT ----------
  useEffect(() => {
    return () => {
      if (!cleanupExecuted.current) {
        cleanupWebGazer();
        cleanupExecuted.current = true;
      }
    };
  }, []);

  // ---------- DB: save answer ----------
  const saveAnswerToDatabase = async (
    roomId,
    candidateName,
    answerText,
    wordCount,
    aiScore,
    detectionMethod,
    modelUsed
  ) => {
    try {
      const response = await fetch(`${API_BASE}/answers/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          candidateName,
          answerText,
          wordCount,
          aiScore,
          detectionMethod,
          modelUsed,
        }),
      });

      const data = await response.json();
      if (response.ok) console.log('✅ Answer saved to DB with ID:', data.answerId);
      else console.error('❌ Failed to save answer:', data.error);
    } catch (error) {
      console.error('❌ Network error saving answer:', error);
    }
  };

  // ---------- STEP 1: NAME ENTRY ----------
  const handleNameSubmit = async () => {
    if (!candidateName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/rooms/update-candidate-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, candidateName: candidateName.trim() }),
      });

      const data = await response.json();
      if (!response.ok) console.error('Save failed:', data.error);
    } catch (error) {
      console.error('Network error:', error);
    }

    setCurrentStep('calibration');
  };

  // ---------- STEP 2: WEBGAZER ----------
  const loadWebGazer = () => {
    return new Promise((resolve, reject) => {
      if (window.webgazer) {
        setGazeStatus('Ready');
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
            setGazeStatus('Ready');
            resolve();
          } else {
            reject(new Error('WebGazer not found'));
          }
        }, 1500);
      };

      script.onerror = () => reject(new Error('Failed to load WebGazer script'));
      document.body.appendChild(script);
    });
  };

  const waitForFaceDetection = () => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 150; // ~30 sec

      const check = setInterval(() => {
        attempts++;
        try {
          const pred = window.webgazer.getCurrentPrediction();
          if (
            pred &&
            (pred.x || pred.y) &&
            pred.x > 0 &&
            pred.y > 0 &&
            pred.x < window.innerWidth &&
            pred.y < window.innerHeight
          ) {
            console.log('✅ Face detected:', pred);
            clearInterval(check);
            resolve();
            return;
          }
        } catch {}

        if (attempts > maxAttempts) {
          clearInterval(check);
          console.log('⚠️ Face detection timeout - continuing anyway');
          resolve();
        }
      }, 200);
    });
  };

  const startCalibration = async () => {
    if (!window.webgazer) {
      console.log('⚠️ WebGazer not available - skipping calibration');
      setCalibrationCompleted(true);
      setIsCalibrating(false);
      setTimeout(() => setCurrentStep('meeting'), 1000);
      return;
    }

    setIsCalibrating(true);
    setCalibrationStep(0);
    setGazeStatus('Starting camera...');

    try {
      if (window.webgazer.isReady?.()) {
        await window.webgazer.end();
        await new Promise((r) => setTimeout(r, 500));
      }

      await window.webgazer
        .setRegression('ridge')
        .setTracker('TFFacemesh')
        .setGazeListener(() => {}) // clear any old listener
        .saveDataAcrossSessions(false)
        .begin();

      setGazeStatus('Looking for face...');
      await waitForFaceDetection();

      setGazeStatus('Click dot 1 of 4');
      window.webgazer.showPredictionPoints(true);
      window.webgazer.showVideoPreview(false);
      window.webgazer.showFaceOverlay(false);
      window.webgazer.showFaceFeedbackBox(false);
    } catch (error) {
      console.error('Calibration setup failed:', error);
      setGazeStatus('Basic tracking active');
      setCalibrationCompleted(true);
      setIsCalibrating(false);
      setTimeout(() => setCurrentStep('meeting'), 800);
    }
  };

  const handleCalibrationClick = async (point, index) => {
    if (!window.webgazer) return;
    if (calibrationStep !== index) return;

    setGazeStatus(`Calibrating ${index + 1}/4...`);

    const x = (point.x / 100) * window.innerWidth;
    const y = (point.y / 100) * window.innerHeight;

    // multiple clicks for better accuracy
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 50));
      window.webgazer.recordScreenPosition(x, y, 'click');
    }

    if (index === calibrationPoints.length - 1) {
      await finishCalibration();
    } else {
      setCalibrationStep(index + 1);
      setGazeStatus(`Click dot ${index + 2} of 4`);
    }
  };

  const finishCalibration = async () => {
    setIsCalibrating(false);
    setGazeStatus('Finalizing...');

    try {
      window.webgazer.showPredictionPoints(false);

      await new Promise((r) => setTimeout(r, 400));
      ['webgazerVideoFeed', 'webgazerVideoContainer', 'webgazerFaceOverlay', 'webgazerFaceFeedbackBox'].forEach(
        (id) => {
          const el = document.getElementById(id);
          if (el) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
          }
        }
      );
    } catch {}

    setCalibrationCompleted(true);
    setupGazeTracking();
  };

  const setupGazeTracking = () => {
    if (!window.webgazer) return;

    let validCount = 0;

    try {
      window.webgazer.clearGazeListener();
    } catch {}

    window.webgazer.setGazeListener((data) => {
      if (!data) return;

      validCount++;
      const x = Math.round(data.x);
      const y = Math.round(data.y);

      requestAnimationFrame(() => {
        setCurrentGaze({ x, y });
      });

      if (validCount > 10) {
        setIsGazeActive(true);
        setGazeStatus('Active');
      }

      checkGazePosition(x, y);
    });
  };

  const checkGazePosition = (x, y) => {
    const margin = 200;

    const isOnScreen =
      x > -margin && x < window.innerWidth + margin && y > -margin && y < window.innerHeight + margin;

    if (!isOnScreen && !isLookingAwayRef.current) {
      isLookingAwayRef.current = true;
      setIsLookingAway(true);

      lookAwayTimerRef.current = setTimeout(() => {
        sendAlert({
          type: 'LOOKING_AWAY',
          message: 'Candidate looking away',
          severity: 'medium',
          timestamp: new Date().toISOString(),
          gazeData: { x, y },
        });
        setLookAwayCount((prev) => prev + 1);
      }, 2000);
    } else if (isOnScreen && isLookingAwayRef.current) {
      if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
      lookAwayTimerRef.current = null;
      isLookingAwayRef.current = false;
      setIsLookingAway(false);
    }
  };

  // ---------- SPEECH ----------
  const startSpeechRecognition = () => {
    if (!browserSupportsSpeechRecognition) {
      console.error('Browser does not support speech recognition');
      return;
    }

    resetTranscript();
    savedTranscriptRef.current = '';
    lastTranscriptRef.current = '';

    setFullTranscript('');
    setIsRecording(true);
    setTranscribedText('');
    setAiDetectionScore(null);
    setDetectionMethod('');

    SpeechRecognition.startListening({
      continuous: true,
      language: 'en-US',
      interimResults: true,
    });

    console.log('🎤 Candidate speech recognition started');
  };

  const analyzeTextRuleBased = (text) => {
    const textLower = text.toLowerCase();
    const sentences = text.match(/[.!?]+/g);
    let score = 0;

    const indicators = {
      formalPhrases: [
        'furthermore',
        'moreover',
        'in conclusion',
        'it is important to note',
        'consequently',
        'therefore',
        'thus',
        'hence',
        'nevertheless',
        'additionally',
        'specifically',
        'particularly',
        'essentially',
      ],
      complexWords: [
        'utilize',
        'facilitate',
        'implement',
        'optimize',
        'leverage',
        'paradigm',
        'synergy',
        'comprehensive',
        'robust',
        'enhance',
      ],
      humanFillers: ['um', 'uh', 'like', 'you know', 'i mean', 'kind of', 'sort of'],
    };

    indicators.formalPhrases.forEach((phrase) => {
      if (textLower.includes(phrase)) score += 15;
    });

    indicators.complexWords.forEach((word) => {
      if (textLower.includes(word)) score += 10;
    });

    const fillerCount = indicators.humanFillers.reduce((count, filler) => {
      const m = textLower.match(new RegExp(filler, 'g'));
      return count + (m ? m.length : 0);
    }, 0);

    if (fillerCount === 0 && (sentences?.length || 0) > 2) score += 20;
    else if (fillerCount > 3) score -= 20;

    return Math.max(0, Math.min(100, score));
  };

  const tryHuggingFaceAPI = async (text) => {
    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model }),
      });

      if (!response.ok) throw new Error('API Error');
      return await response.json();
    } catch {
      return null;
    }
  };

  const analyzeTextWithAI = async (text) => {
    if (!text || text.trim().length < 10) return;

    setIsAnalyzing(true);

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    try {
      const apiResult = await tryHuggingFaceAPI(text);

      let aiScore;
      let detectionMethodLocal;
      let modelUsed;

      if (apiResult !== null && typeof apiResult.score === 'number') {
        aiScore = apiResult.score;
        detectionMethodLocal = 'Hugging Face API';
        modelUsed = apiResult.model || model;
      } else {
        aiScore = analyzeTextRuleBased(text);
        detectionMethodLocal = 'Rule-based Algorithm';
        modelUsed = 'Local Pattern Matching';
      }

      await saveAnswerToDatabase(
        roomId,
        candidateName,
        text.trim(),
        wordCount,
        aiScore,
        detectionMethodLocal,
        modelUsed
      );

      setAiDetectionScore(aiScore);
      setCurrentModel(modelUsed);
      setDetectionMethod(detectionMethodLocal);

      sendAlert({
        type: 'AI_DETECTION_RESULT',
        message: `AI Detection: ${aiScore}% likelihood`,
        severity: aiScore >= 70 ? 'high' : aiScore >= 50 ? 'medium' : 'low',
        timestamp: new Date().toISOString(),
        aiData: {
          aiScore,
          detectionMethod: detectionMethodLocal,
          model: modelUsed,
          wordCount,
        },
      });
    } catch (error) {
      console.log('AI analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ---------- TAB SWITCH ALERT ----------
  const setupTabDetection = () => {
    const handler = () => {
      if (document.hidden) {
        sendAlert({
          type: 'TAB_SWITCHED',
          message: 'Candidate switched tabs',
          severity: 'critical',
          timestamp: new Date().toISOString(),
        });
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  };

  // ✅ Silent alert: no spam when socket not connected
  const sendAlert = (alertData) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    try {
      socketRef.current.emit('alert', { roomId, ...alertData });
    } catch {}
  };

  // ---------- WEBRTC + SOCKET ----------
  const initializeConnection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });

      localStreamRef.current = stream;

      // attach to webcam
      if (webcamRef.current?.video) {
        webcamRef.current.video.srcObject = stream;
      }

      setConnectionStatus('Connecting...');

      // ✅ IMPORTANT: use SAME options as Interviewer (polling-safe)
      const newSocket = io(SIGNALING_SERVER, SOCKET_OPTIONS);
      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id);
        setConnectionStatus('Connected ✓');

        newSocket.emit('join-room', {
          roomId,
          role: 'candidate',
          userName: candidateName || userName || 'Candidate',
        });
      });

      // Candidate does not create offer (interviewer creates offer).
      newSocket.on('room-joined', (data) => {
        console.log('✅ Room joined:', data);
        setConnectionStatus('Waiting for interviewer...');
      });

      newSocket.on('peer-joined', (data) => {
        console.log('✅ Peer joined:', data);
        setConnectionStatus('Interviewer connected');
      });

      newSocket.on('offer', handleOffer);
      newSocket.on('ice-candidate', handleIceCandidate);

      newSocket.on('disconnect', (reason) => {
        console.warn('🔌 Disconnected:', reason);
        setConnectionStatus('Reconnecting...');
      });

      newSocket.on('connect_error', (err) => {
        console.error('❌ Socket connect_error:', err);
        setConnectionStatus('Connection error');
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        setConnectionStatus('Reconnected ✓');
        newSocket.emit('join-room', {
          roomId,
          role: 'candidate',
          userName: candidateName || userName || 'Candidate',
        });
      });
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus('Error: ' + (error.message || error));
    }
  };

  const createPeerConnection = (peerId) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    localStreamRef.current?.getTracks()?.forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (event) => {
      console.log('📥 Remote stream received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnectionStatus('✅ Video connected!');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          targetId: peerId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log('⚠️ Peer connection state:', pc.connectionState);
      }
    };

    return pc;
  };

  const handleOffer = async (data) => {
    try {
      console.log('📨 Received offer from:', data.senderId);

      const pc = createPeerConnection(data.senderId);

      // If somehow not stable, still accept offer safely for 1:1
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      // ✅ Add queued ICE after remote desc
      if (pendingIceCandidatesRef.current.length > 0) {
        for (const c of pendingIceCandidatesRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {}
        }
        pendingIceCandidatesRef.current = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('answer', {
        targetId: data.senderId,
        answer: pc.localDescription,
      });

      setConnectionStatus('✅ Answer sent');
    } catch (error) {
      console.error('❌ Offer error:', error);
    }
  };

  const handleIceCandidate = async (data) => {
    const pc = peerConnectionRef.current;
    if (!data?.candidate || !pc) return;

    // queue ICE until remoteDescription is set
    if (!pc.remoteDescription || !pc.remoteDescription.type) {
      pendingIceCandidatesRef.current.push(data.candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('❌ ICE error:', error);
    }
  };

  const cleanupConnection = () => {
    try {
      if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
      lookAwayTimerRef.current = null;

      if (listening) SpeechRecognition.stopListening();

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setSocket(null);
    } catch (e) {
      console.warn('cleanupConnection error:', e);
    }
  };

  const cleanupWebGazer = () => {
    if (window.webgazer) {
      try {
        window.webgazer.clearGazeListener();
        window.webgazer.end();
      } catch {}
    }
  };

  // ---------- END INTERVIEW ----------
  const endInterviewForCandidate = async () => {
    if (!roomId) {
      alert('Room id missing');
      return;
    }

    try {
      console.log('🔚 Candidate ending interview...');

      // Save pending transcript chunk
      const currentText = transcript.trim();
      const pendingTranscript = currentText
        ? currentText.replace(savedTranscriptRef.current, '').trim()
        : '';

      if (pendingTranscript.length > 5) {
        console.log('💾 Saving final pending candidate transcript...', pendingTranscript);
        await analyzeTextWithAI(pendingTranscript);
        savedTranscriptRef.current = (savedTranscriptRef.current + ' ' + pendingTranscript.trim()).trim();
      }

      // Prepare final transcript
      const fromSaved = savedTranscriptRef.current?.trim() || '';
      const fromLive = fullTranscript?.trim() || '';
      const finalCandidateTranscript = fromLive || fromSaved;

      // Mark interview complete
      const res = await fetch(`${API_BASE}/interviews/${roomId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateTranscript: finalCandidateTranscript || null,
          completedAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to mark interview complete:', data.error);
        alert(data.error || 'Failed to complete interview');
        return;
      }

      // Generate combined transcript (optional)
      try {
        await fetch(`${CONVERSATION_BASE}/generate-transcript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId }),
        });
        console.log('✅ Combined QA transcript generated');
      } catch (e) {
        console.warn('Transcript generation failed (ignored):', e);
      }

      SpeechRecognition.stopListening();
      cleanupConnection();
      cleanupWebGazer();

      // Notify interviewer
      socketRef.current?.emit('end-interview', { roomId });

      const wordCount = finalCandidateTranscript
        ? finalCandidateTranscript.split(' ').filter(Boolean).length
        : 0;

      alert(
        `✅ Interview COMPLETED & FULL TRANSCRIPT SAVED!\n\nRoom: ${roomId}\nYour words: ${wordCount}\nAI Score: ${aiDetectionScore ? aiDetectionScore.toFixed(1) : 'N/A'}`
      );

      window.location.href = '#/calendar-view';
    } catch (err) {
      console.error('Network error completing interview:', err);
      alert('Network error while completing interview');
    }
  };

  const handleResetCalibration = () => {
    if (window.confirm('Reset calibration? You will need to calibrate again.')) {
      setCalibrationCompleted(false);
      setCurrentStep('calibration');
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleSkipCalibration = () => {
    console.log('⏭️ Calibration skipped by user');
    setCalibrationCompleted(true);
    setIsCalibrating(false);
    setGazeStatus('Skipped');
    setTimeout(() => setCurrentStep('meeting'), 500);
  };

  // ---------- RENDER ----------
  if (currentStep === 'name') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontFamily: 'Arial',
          padding: '20px',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>👁️</div>
            <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>Join Interview</h2>
            <p style={{ color: '#666', fontSize: '14px', margin: '0' }}>
              Step 1 of 3: Enter your name
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 'bold',
                color: '#555',
                fontSize: '14px',
              }}
            >
              Your Full Name
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              placeholder="Enter your name"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
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
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            }}
          >
            Continue to Calibration
          </button>

          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#e3f2fd',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#1976d2',
            }}
          >
            <strong>Next:</strong> Eye tracking calibration (30 sec) <em>or skip</em>
          </div>

          <p
            style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#999',
              marginTop: '15px',
            }}
          >
            Room code: <code>{roomId?.substring(0, 8)}...</code>
          </p>
        </div>
      </div>
    );
  }

  if (currentStep === 'calibration' && !calibrationCompleted) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.95)',
          zIndex: 9999,
          fontFamily: 'Arial',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            textAlign: 'center',
            zIndex: 10001,
            width: '90%',
            maxWidth: 600,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 28 }}>Eye Gaze Calibration</h2>
          <p style={{ fontSize: 20, color: '#ffc107', margin: '15px 0', fontWeight: 'bold' }}>
            {gazeStatus}
          </p>
          <p style={{ fontSize: 16, color: '#ccc', margin: 0 }}>
            {isCalibrating ? (
              <strong>Look at the red dot and click it.</strong>
            ) : (
              'Loading...'
            )}
          </p>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            color: 'white',
            zIndex: 10001,
          }}
        >
          <button
            onClick={handleSkipCalibration}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              marginRight: '10px',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
            }}
          >
            Skip & Continue
          </button>

          <button
            onClick={handleResetCalibration}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)',
            }}
          >
            Retry
          </button>
        </div>

        {isCalibrating &&
          calibrationPoints.map((point, index) => (
            <div
              key={index}
              onClick={() => handleCalibrationClick(point, index)}
              style={{
                position: 'absolute',
                left: `${point.x}%`,
                top: `${point.y}%`,
                width: calibrationStep === index ? '70px' : '40px',
                height: calibrationStep === index ? '70px' : '40px',
                borderRadius: '50%',
                backgroundColor: calibrationStep === index ? '#dc3545' : '#555',
                cursor: calibrationStep === index ? 'pointer' : 'default',
                transform: 'translate(-50%, -50%)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: 28,
                border: calibrationStep === index ? '5px solid #ffc107' : '2px solid #333',
                boxShadow: calibrationStep === index ? '0 0 30px rgba(220, 53, 69, 1)' : 'none',
              }}
            >
              {index + 1}
            </div>
          ))}
      </div>
    );
  }

  // ---------- STEP 3: MEETING ----------
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
          <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>🧑‍💻 Candidate Dashboard</h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
            Room:{' '}
            <code style={{ backgroundColor: '#e0e0e0', padding: '2px 6px', borderRadius: '3px' }}>
              {roomId?.substring(0, 12)}...
            </code>{' '}
            | Transcript: {fullTranscript.split(' ').filter(Boolean).length} words
            {aiDetectionScore !== null && (
              <span
                style={{
                  marginLeft: 10,
                  color: aiDetectionScore >= 70 ? '#f44336' : '#4caf50',
                  fontWeight: 'bold',
                }}
              >
                AI: {aiDetectionScore.toFixed(1)}%
              </span>
            )}
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>
            Status: {connectionStatus} {isAnalyzing ? ' | Analyzing...' : ''}{' '}
            {isRecording ? ' | 🎤 Recording' : ''}
          </p>
        </div>

        <div
          style={{
            padding: '10px 20px',
            backgroundColor:
              connectionStatus.toLowerCase().includes('connected') ||
              connectionStatus.toLowerCase().includes('video')
                ? '#4caf50'
                : '#ff9800',
            color: 'white',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          {connectionStatus}
        </div>
      </div>

      {calibrationCompleted && (
        <button
          onClick={handleResetCalibration}
          style={{
            position: 'fixed',
            top: 10,
            left: 10,
            padding: '8px 12px',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 'bold',
            zIndex: 1000,
          }}
        >
          Reset Calibration
        </button>
      )}

      {/* Video Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        {/* Interviewer video */}
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
            id="interviewer-remote-video"
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '500px', objectFit: 'cover', display: 'block' }}
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
            Interviewer
          </div>
        </div>

        {/* Candidate video */}
        <div
          style={{
            backgroundColor: '#000',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: isLookingAway ? '5px solid #dc3545' : 'none',
            position: 'relative',
          }}
        >
          <Webcam
            id="candidate-local-video"
            ref={webcamRef}
            audio={false}
            style={{ width: '100%', height: '500px', objectFit: 'cover', display: 'block' }}
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
            {candidateName || 'You'} {isLookingAway ? '(Looking Away)' : ''}
          </div>

          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: '5px 10px',
              borderRadius: '5px',
              fontSize: '10px',
            }}
          >
            Eye Tracking: {gazeStatus} {isGazeActive ? `(${currentGaze.x}, ${currentGaze.y})` : ''}
          </div>
        </div>
      </div>

      {/* End Interview */}
      <div
        style={{
          maxWidth: '1400px',
          margin: '20px auto',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={endInterviewForCandidate}
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
          ✅ End Interview & Save FULL Transcript + AI Results
        </button>
      </div>

      <style>{`
        #webgazerVideoFeed, #webgazerVideoContainer, #webgazerFaceOverlay, #webgazerFaceFeedbackBox {
          display: none !important;
          visibility: hidden !important;
        }
        #interviewer-remote-video, #candidate-local-video {
          display: block !important;
          visibility: visible !important;
        }
        button:hover { opacity: 0.92; }
      `}</style>
    </div>
  );
};

export default CandidateView;
