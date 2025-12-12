import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, AIState } from '../types';
import { Keyboard, Lock, Smartphone, Maximize, ArrowRight, Bot, User, Mic, Square, Loader2 } from 'lucide-react';
import * as Icons from 'lucide-react';

interface TacticalDeckProps {
  chatHistory: ChatMessage[];
  onChatInput: (text: string) => void;
  onVoiceInput: (audioData: string, mimeType: string) => void;
  aiState: AIState;
  onSystemAction: (action: string) => void;
  disabled: boolean;
}

const TacticalDeck: React.FC<TacticalDeckProps> = ({ chatHistory, onChatInput, onVoiceInput, aiState, onSystemAction, disabled }) => {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onChatInput(inputText);
      setInputText('');
    }
  };

  const startRecording = async () => {
    if (disabled) return;
    setIsRecording(true);
    chunksRef.current = [];

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Try to request a specific mime type if supported, otherwise default
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' };
        }

        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const totalSize = chunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
            // Increased threshold to 1KB to ensure valid audio data
             if (totalSize < 1000) { 
                console.warn("Audio too short/empty, ignoring.");
                return;
            }

            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const blob = new Blob(chunksRef.current, { type: mimeType });
            
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              // Extract base64 part
              const base64String = (reader.result as string).split(',')[1];
              onVoiceInput(base64String, mimeType);
            };

            // Cleanup
             if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };

        mediaRecorder.start();
    } catch (err) {
        console.error("Microphone access denied:", err);
        setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-glass-100 backdrop-blur-xl border-l border-white/10 p-5 w-96 transition-opacity duration-300 ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
           <h2 className="text-xl font-mono font-bold tracking-widest text-white uppercase">Uplink</h2>
           <p className="text-xs text-gray-400 font-mono">NEURAL COMMUNICATION</p>
        </div>
        <div className={`w-2 h-2 rounded-full animate-pulse ${aiState === AIState.PROCESSING || aiState === AIState.SPEAKING ? 'bg-purple-500' : 'bg-neon-blue'}`}></div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Override</h3>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => onSystemAction('HOME')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-blue/50 transition-all group" title="Home">
            <Smartphone size={16} className="text-gray-300 group-hover:text-neon-blue" />
          </button>
          <button onClick={() => onSystemAction('LOCK')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-red/50 transition-all group" title="Lock">
            <Lock size={16} className="text-gray-300 group-hover:text-neon-red" />
          </button>
          <button onClick={() => onSystemAction('APP_SWITCHER')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-green/50 transition-all group" title="Switcher">
            <Maximize size={16} className="text-gray-300 group-hover:text-neon-green" />
          </button>
          <button onClick={() => onSystemAction('SCREENSHOT')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-yellow-400/50 transition-all group" title="Screenshot">
            <Icons.Camera size={16} className="text-gray-300 group-hover:text-yellow-400" />
          </button>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 overflow-hidden flex flex-col bg-black/20 rounded-xl border border-white/5 mb-4 relative">
        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none"></div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {chatHistory.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                    <Bot size={32} className="mb-2" />
                    <span className="text-xs font-mono uppercase tracking-widest">Channel Open</span>
                 </div>
            )}
            
            {chatHistory.map((msg) => {
                const isAi = msg.sender === 'ai';
                return (
                    <div key={msg.id} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm relative ${
                            isAi 
                            ? 'bg-white/10 text-gray-200 rounded-tl-sm border border-white/5' 
                            : 'bg-neon-blue/20 text-neon-blue rounded-tr-sm border border-neon-blue/20'
                        }`}>
                             <div className="flex items-center space-x-2 mb-1 opacity-50">
                                {isAi ? <Bot size={10} /> : <User size={10} />}
                                <span className="text-[10px] font-mono uppercase">{isAi ? 'CORE' : 'CMD'}</span>
                             </div>
                             <p className="leading-relaxed">{msg.text}</p>
                        </div>
                    </div>
                )
            })}
            
            {aiState === AIState.PROCESSING && (
                <div className="flex justify-start">
                     <div className="bg-white/5 text-gray-400 rounded-2xl rounded-tl-sm px-4 py-3 border border-white/5 flex items-center space-x-2">
                         <Loader2 size={14} className="animate-spin text-purple-400" />
                         <span className="text-xs animate-pulse">Analyzing...</span>
                     </div>
                </div>
            )}
            
            <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="mt-auto">
        <form onSubmit={handleSendText} className="relative">
            {isRecording ? (
                 <div className="w-full bg-red-500/10 border border-red-500/50 rounded-lg py-3 px-4 flex items-center justify-between text-red-400 animate-pulse transition-all">
                     <div className="flex items-center space-x-2">
                         <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                         <span className="text-sm font-mono tracking-widest uppercase">Listening...</span>
                     </div>
                     <button type="button" onClick={stopRecording} className="p-1 hover:bg-red-500/20 rounded text-white transition-colors">
                         <Square size={16} fill="currentColor" />
                     </button>
                 </div>
            ) : (
                <>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter command..."
                    className="w-full bg-black/30 border border-white/10 rounded-lg py-3 pl-10 pr-20 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors font-mono"
                    disabled={disabled || aiState === AIState.PROCESSING}
                  />
                  <Keyboard size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                  
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                      {inputText.trim() ? (
                          <button 
                            type="submit"
                            disabled={disabled || aiState === AIState.PROCESSING}
                            className="p-1.5 rounded-md bg-neon-blue/20 text-neon-blue hover:bg-neon-blue hover:text-white transition-colors disabled:opacity-50"
                          >
                            <ArrowRight size={14} />
                          </button>
                      ) : (
                          <button 
                            type="button"
                            onClick={startRecording}
                            disabled={disabled || aiState === AIState.PROCESSING}
                            className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                            title="Voice Command"
                          >
                            <Mic size={16} />
                          </button>
                      )}
                  </div>
                </>
            )}
        </form>
      </div>

    </div>
  );
};

export default TacticalDeck;