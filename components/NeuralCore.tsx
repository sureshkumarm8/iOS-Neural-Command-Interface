import React, { useState, useRef } from 'react';
import { Mic, Loader2, Volume2 } from 'lucide-react';
import { AIState } from '../types';

interface NeuralCoreProps {
  onVoiceInput: (audioData: string, mimeType: string) => void;
  aiState: AIState;
  narration: string | null;
}

const NeuralCore: React.FC<NeuralCoreProps> = ({ onVoiceInput, aiState, narration }) => {
  const [isHovered, setIsHovered] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  const startListening = async () => {
    if (aiState !== AIState.IDLE) return;
    isRecordingRef.current = true;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Check if user released button while we were getting permission
      if (!isRecordingRef.current) {
         stream.getTracks().forEach(track => track.stop());
         return;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const totalSize = chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
        
        // If audio is too short or empty, ignore
        if (totalSize < 1000) { 
            console.warn("Audio too short, ignoring.");
            return;
        }

        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          onVoiceInput(base64String, mimeType);
        };
        
        // Cleanup tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Microphone access denied:", err);
      isRecordingRef.current = false;
    }
  };

  const stopListening = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
        // If we haven't started recording yet (still initializing), 
        // the isRecordingRef check in startListening will handle cleanup.
        if (streamRef.current) {
             streamRef.current.getTracks().forEach(track => track.stop());
             streamRef.current = null;
        }
    }
  };

  // Determine Visual State
  const isListening = aiState === AIState.LISTENING || (isRecordingRef.current);

  return (
    <div 
      className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Narration Bubble */}
      {narration && (
        <div className="mb-4 bg-black/80 backdrop-blur-md border border-neon-blue/30 px-6 py-2 rounded-full text-neon-blue font-mono text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-fade-in-up">
          <span className="mr-2">⚡</span> {narration}
        </div>
      )}

      {/* The Core Orb */}
      <button
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onMouseLeave={stopListening} // Stop if mouse leaves button
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        className={`relative group w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
            aiState === AIState.PROCESSING ? 'scale-110' :
            isListening ? 'scale-125' : 
            isHovered ? 'scale-110' : 'scale-100'
        }`}
      >
        {/* Outer Glow Ring */}
        <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${
             aiState === AIState.PROCESSING ? 'bg-purple-500/40 animate-pulse' :
             isListening ? 'bg-red-500/40' :
             aiState === AIState.SPEAKING ? 'bg-neon-green/40' :
             'bg-neon-blue/20 group-hover:bg-neon-blue/40'
        }`}></div>
        
        {/* Core Container */}
        <div className={`relative w-full h-full rounded-full bg-black/50 backdrop-blur-xl border-2 flex items-center justify-center overflow-hidden transition-colors duration-300 ${
            aiState === AIState.PROCESSING ? 'border-purple-400' :
            isListening ? 'border-red-400' :
            aiState === AIState.SPEAKING ? 'border-neon-green' :
            'border-neon-blue/50 group-hover:border-neon-blue'
        }`}>
            
            {/* Inner Visuals */}
            {aiState === AIState.PROCESSING ? (
                <Loader2 size={32} className="text-purple-400 animate-spin" />
            ) : isListening ? (
                <div className="flex items-center space-x-1">
                    <div className="w-1 h-4 bg-red-400 animate-pulse"></div>
                    <div className="w-1 h-8 bg-red-400 animate-pulse delay-75"></div>
                    <div className="w-1 h-6 bg-red-400 animate-pulse delay-150"></div>
                    <div className="w-1 h-4 bg-red-400 animate-pulse"></div>
                </div>
            ) : aiState === AIState.SPEAKING ? (
                 <Volume2 size={32} className="text-neon-green animate-pulse" />
            ) : (
                <Mic size={32} className="text-neon-blue opacity-80 group-hover:opacity-100 transition-opacity" />
            )}
        </div>

        {/* Status Ring - Rotating */}
        {aiState === AIState.IDLE && (
            <div className="absolute inset-[-4px] rounded-full border border-dashed border-white/20 animate-spin-slow pointer-events-none"></div>
        )}
      </button>

      <div className="mt-4 text-center">
         <p className="text-[10px] font-mono tracking-[0.2em] text-gray-500 uppercase">
             {aiState === AIState.IDLE ? 'Hold to Speak' : 
              aiState === AIState.LISTENING ? 'Listening...' :
              aiState === AIState.PROCESSING ? 'Analyzing...' :
              'Transmitting'}
         </p>
      </div>
    </div>
  );
};

export default NeuralCore;