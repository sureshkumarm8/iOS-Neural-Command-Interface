import React, { useState, useRef } from 'react';
import { Mic, MicOff, BrainCircuit, Activity } from 'lucide-react';
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 
                       MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
                       
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // remove prefix "data:audio/xyz;base64,"
          const base64 = base64String.split(',')[1];
          onVoiceInput(base64, type);
        };
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      
      // Notify parent/system that recording started (handled via direct interaction here for visual state)
      // Note: In this architecture, we dispatch event for App to update state to LISTENING
      window.dispatchEvent(new CustomEvent('neural-start-listen'));

    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Microphone access required for Neural Core.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleListening = () => {
    if (aiState === AIState.IDLE || aiState === AIState.SPEAKING) {
       startRecording();
    } else if (aiState === AIState.LISTENING) {
       stopRecording();
    }
  };

  // Helper to determine Orb Color/Effect
  const getOrbStyle = () => {
    switch (aiState) {
      case AIState.LISTENING:
        return 'bg-neon-red shadow-[0_0_40px_rgba(244,63,94,0.6)] animate-pulse-fast scale-110';
      case AIState.PROCESSING:
        return 'bg-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.6)] animate-spin-slow';
      case AIState.SPEAKING:
        return 'bg-neon-green shadow-[0_0_40px_rgba(52,211,153,0.6)] animate-pulse';
      default: // IDLE
        return 'bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-white/20 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]';
    }
  };

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center">
      
      {/* Narration Bubble */}
      {narration && (
        <div className="mb-4 bg-black/70 backdrop-blur-md border border-neon-blue/30 text-neon-blue px-4 py-2 rounded-xl text-sm font-mono shadow-lg animate-float max-w-sm text-center">
           {`> ${narration}`}
        </div>
      )}

      {/* The Orb */}
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        // Also support click toggle for accessibility or if preferred
        onClick={(e) => { 
            // Optional: If user prefers click-to-toggle instead of hold
            // Implementation left simple for now: Hold to record or Click to start/stop
        }} 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 border border-white/20 backdrop-blur-md ${getOrbStyle()}`}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent to-white/20 pointer-events-none"></div>
        
        {aiState === AIState.PROCESSING ? (
          <BrainCircuit size={32} className="text-white animate-pulse" />
        ) : aiState === AIState.LISTENING ? (
          <Activity size={32} className="text-white animate-pulse" />
        ) : (
          <Mic size={28} className={`text-white transition-opacity ${isHovered ? 'opacity-100' : 'opacity-70'}`} />
        )}
      </button>

      <div className="mt-3 text-xs font-mono tracking-widest text-gray-400 uppercase">
        {aiState === AIState.IDLE ? 'Hold to Speak' : aiState}
      </div>
    </div>
  );
};

export default NeuralCore;