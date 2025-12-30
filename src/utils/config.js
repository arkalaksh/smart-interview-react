// ✅ PRODUCTION + LOCAL AUTO-DETECT
const isProduction = typeof window !== 'undefined' && 
  window.location.hostname !== 'localhost' && 
  window.location.hostname !== '127.0.0.1' && 
  !window.location.hostname.includes('localhost');

export const SIGNALING_SERVER = isProduction 
  ? 'https://darkcyan-hornet-746720.hostingersite.com'
  : 'http://localhost:5000';

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
  isProduction: isProduction ? '✅ PRODUCTION' : '🔧 LOCAL',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'Server'
});
