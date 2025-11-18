import { nanoid } from 'nanoid';

// Generate non-guessable room ID (21 characters by default)
export const generateRoomId = () => {
  const roomId = nanoid();
  console.log('🔐 Generated room ID:', roomId);
  return roomId;
};

// Generate candidate invitation link
export const generateCandidateLink = (roomId) => {
  const baseUrl = window.location.origin;
  const link = `${baseUrl}/interview/candidate/${roomId}`;
  console.log('🔗 Generated candidate link:', link);
  return link;
};
