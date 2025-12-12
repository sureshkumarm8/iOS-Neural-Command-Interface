import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { Keyboard, Lock, Smartphone, Maximize, ArrowRight, Bot, User } from 'lucide-react';
import * as Icons from 'lucide-react';

interface TacticalDeckProps {
  chatHistory: ChatMessage[];
  onChatInput: (text: string) => void;
  onSystemAction: (action: string) => void;
  disabled: boolean;
}

const TacticalDeck: React.FC<TacticalDeckProps> = ({ chatHistory, onChatInput, onSystemAction, disabled }) => {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={`flex flex-col h-full bg-glass-100 backdrop-blur-xl border-l border-white/10 p-5 w-96 transition-opacity duration-300 ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
           <h2 className="text-xl font-mono font-bold tracking-widest text-white uppercase">Uplink</h2>
           <p className="text-xs text-gray-400 font-mono">NEURAL COMMUNICATION</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-neon-blue animate-pulse"></div>
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

      {/* Chat Window (Replaces App Drawer) */}
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
            <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="mt-auto">
        <form onSubmit={handleSendText} className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter command..."
            className="w-full bg-black/30 border border-white/10 rounded-lg py-3 pl-10 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors font-mono"
            disabled={disabled}
          />
          <Keyboard size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <button 
            type="submit"
            disabled={!inputText.trim() || disabled}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md bg-neon-blue/20 text-neon-blue hover:bg-neon-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRight size={14} />
          </button>
        </form>
      </div>

    </div>
  );
};

export default TacticalDeck;