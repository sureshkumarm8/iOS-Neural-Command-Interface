import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, BrainCircuit } from 'lucide-react';
import { AIState } from '../types';

interface NeuralCoreProps {
  onCommand: (text: string) => void;
  aiState: AIState;
  narration: string | null;
}

const NeuralCore: React.FC<NeuralCoreProps> = ({ onCommand, aiState, narration }) => {
  const [isHovered, setIsHovered] = useState(false);
  const recognitionRef = useRef<any>(null); // Type 'any' used because SpeechRecognition is experimental

  // Speech Recognition Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log("Heard:", transcript);
        onCommand(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Error:", event.error);
        // Reset via parent in real app, simplified here
      };
    } else {
        console.warn("Speech Recognition API not supported in this browser.");
    }
  }, [onCommand]);

  const toggleListening = () => {
    if (aiState === AIState.IDLE) {
       recognitionRef.current?.start();
       // Parent should set state to LISTENING immediately, but we can't trigger it directly here
       // without passing a state setter. However, onCommand trigger handles the logic flow.
       // For this demo, we assume parent handles state transitions or we use a callback
       // Actually, we need to signal the parent to change state.
       // Since props drive state, we need a way to tell parent "I started listening".
       // *Optimization*: For this specific component, we will just start recognition. 
       // The parent isn't controlling 'start listening', the user is.
       // We'll call a prop `onRequestListening` if we strictly followed unidirectional flow,
       // but here we just trigger the native API and let the parent handle the `onCommand` result.
       // To visualize "Listening" state immediately:
       (window as any).dispatchEvent(new CustomEvent('neural-start-listen'));
    } else {
       recognitionRef.current?.stop();
    }
  };

  // Helper to determine Orb Color/Effect
  const getOrbStyle = () => {
    switch (aiState) {
      case AIState.LISTENING:
        return 'bg-neon-blue shadow-[0_0_40px_rgba(6,182,212,0.6)] animate-pulse-fast scale-110';
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
        onClick={toggleListening}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 border border-white/20 backdrop-blur-md ${getOrbStyle()}`}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent to-white/20 pointer-events-none"></div>
        
        {aiState === AIState.PROCESSING ? (
          <BrainCircuit size={32} className="text-white animate-pulse" />
        ) : aiState === AIState.LISTENING ? (
          <div className="flex space-x-1 items-end h-8">
             <div className="w-1 bg-white animate-[pulse_0.5s_ease-in-out_infinite] h-4"></div>
             <div className="w-1 bg-white animate-[pulse_0.5s_ease-in-out_infinite_0.1s] h-8"></div>
             <div className="w-1 bg-white animate-[pulse_0.5s_ease-in-out_infinite_0.2s] h-6"></div>
             <div className="w-1 bg-white animate-[pulse_0.5s_ease-in-out_infinite_0.3s] h-8"></div>
             <div className="w-1 bg-white animate-[pulse_0.5s_ease-in-out_infinite_0.4s] h-4"></div>
          </div>
        ) : (
          <Mic size={28} className={`text-white transition-opacity ${isHovered ? 'opacity-100' : 'opacity-70'}`} />
        )}
      </button>

      <div className="mt-3 text-xs font-mono tracking-widest text-gray-400 uppercase">
        {aiState === AIState.IDLE ? 'Neural Core Online' : aiState}
      </div>
    </div>
  );
};

export default NeuralCore;
