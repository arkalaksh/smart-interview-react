// export const SIGNALING_SERVER = 'https://darkcyan-hornet-746720.hostingersite.com';
export const SIGNALING_SERVER = 'https://darkcyan-hornet-746720.hostingersite.com:5000';

export const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};
