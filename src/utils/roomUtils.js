import { nanoid } from 'nanoid';
// utils/roomUtils.js

export const generateRoomId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `INT-${timestamp}-${randomStr}`;
};

export const generateCandidateLink = (roomId) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/interview/candidate/${roomId}`;
};

export const generateInterviewerLink = (roomId) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/interview/interviewer/${roomId}`;
};
