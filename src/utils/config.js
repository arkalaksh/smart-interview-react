// ✅ PRODUCTION + LOCAL AUTO-DETECT + HOSTINGER WEBSOCKET FIX
const isProduction = typeof window !== 'undefined' && 
  window.location.hostname !== 'localhost' && 
  window.location.hostname !== '127.0.0.1' && 
  !window.location.hostname.includes('localhost');

// ✅ HOSTINGER WEBSOCKET BYPASS: Force polling on shared hosting
const getSignalingServer = () => {
  if (!isProduction) {
    return 'http://localhost:5000';
  }
  
  // Hostinger detection + WebSocket bypass
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isHostinger = hostname.includes('hostingersite.com') || hostname.includes('hostinger');
  
  if (isHostinger) {
    console.log('🔧 Hostinger detected → Using POLLING ONLY');
    return 'https://darkcyan-hornet-746720.hostingersite.com';
  }
  
  return 'https://darkcyan-hornet-746720.hostingersite.com';
};

export const SIGNALING_SERVER = getSignalingServer();

// ✅ SOCKET.IO TRANSPORT OVERRIDE for Hostinger
export const SOCKET_OPTIONS = {
  transports: ['polling', 'websocket'],  // Polling FIRST
  upgrade: false,                        // Disable WebSocket upgrade on Hostinger
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 8,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
};

export const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

// ✅ DEBUG INFO (Console मध्ये दिसेल)
console.log('🚀 WebRTC Config Loaded:', {
  SIGNALING_SERVER,
  SOCKET_OPTIONS,
  isProduction: isProduction ? '✅ PRODUCTION' : '🔧 LOCAL',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'Server',
  hostingerMode: typeof window !== 'undefined' && window.location.hostname.includes('hostingersite.com') ? '🔧 POLLING ONLY' : '🚀 FULL MODE'
});
