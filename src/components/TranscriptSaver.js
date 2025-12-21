// import React, { useRef, useEffect } from 'react';
// import debounce from 'lodash.debounce';
// import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// const TranscriptSaver = ({ roomId, senderRole }) => {
//   const { transcript, listening } = useSpeechRecognition();
//   const cumulativeTranscriptRef = useRef('');
//   const lastSavedTranscriptRef = useRef('');

//   // Update cumulative transcript
//   useEffect(() => {
//     if (transcript && transcript.trim().length > 0) {
//       // Append only if transcript longer
//       if (transcript.length > cumulativeTranscriptRef.current.length) {
//         cumulativeTranscriptRef.current = transcript;
//       }
//     }
//   }, [transcript]);

//   // Debounced save function
//   const saveFullTranscript = debounce(async () => {
//     const fullText = cumulativeTranscriptRef.current.trim();
//     if (!fullText || fullText === lastSavedTranscriptRef.current) return;

//     lastSavedTranscriptRef.current = fullText;

//     try {
//       const res = await fetch('https://darkcyan-hornet-746720.hostingersite.com/api/conversation/save-full', {
//         method: 'POST',
//         headers: {'Content-Type': 'application/json'},
//         body: JSON.stringify({ roomId, senderRole, transcriptText: fullText }),
//       });

//       if (res.ok) {
//         console.log('Transcript saved successfully');
//       } else {
//         console.error('Failed to save transcript');
//       }
//     } catch (e) {
//       console.error('Network error saving transcript', e);
//     }
//   }, 8000); // every 8 seconds

//   // Trigger save on transcript change
//   useEffect(() => {
//     saveFullTranscript();
//   }, [transcript]);

//   return null; // This component just handles saving
// };

// export default TranscriptSaver;
