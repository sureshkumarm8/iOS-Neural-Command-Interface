import React, { useState } from 'react';
import { AppPreset } from '../types';
import { APP_PRESETS } from '../constants';
import * as Icons from 'lucide-react';
import { Keyboard, Lock, Smartphone, Maximize, ArrowRight } from 'lucide-react';

interface TacticalDeckProps {
  onLaunchApp: (app: AppPreset) => void;
  onSystemAction: (action: string) => void;
  onType: (text: string) => void;
  disabled: boolean;
}

const TacticalDeck: React.FC<TacticalDeckProps> = ({ onLaunchApp, onSystemAction, onType, disabled }) => {
  const [inputText, setInputText] = useState('');

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onType(inputText);
      setInputText('');
    }
  };

  return (
    <div className={`flex flex-col h-full bg-glass-100 backdrop-blur-xl border-l border-white/10 p-5 w-80 transition-opacity duration-300 ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-mono font-bold tracking-widest text-white uppercase">Tactical Deck</h2>
        <p className="text-xs text-gray-400 font-mono">COMMAND & CONTROL</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onSystemAction('HOME')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-blue/50 transition-all group">
            <Smartphone size={20} className="mb-2 text-gray-300 group-hover:text-neon-blue" />
            <span className="text-xs text-gray-300">HOME</span>
          </button>
          <button onClick={() => onSystemAction('LOCK')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-red/50 transition-all group">
            <Lock size={20} className="mb-2 text-gray-300 group-hover:text-neon-red" />
            <span className="text-xs text-gray-300">LOCK</span>
          </button>
          <button onClick={() => onSystemAction('APP_SWITCHER')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-green/50 transition-all group">
            <Maximize size={20} className="mb-2 text-gray-300 group-hover:text-neon-green" />
            <span className="text-xs text-gray-300">SWITCHER</span>
          </button>
          <button onClick={() => onSystemAction('SCREENSHOT')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-yellow-400/50 transition-all group">
            <Icons.Camera size={20} className="mb-2 text-gray-300 group-hover:text-yellow-400" />
            <span className="text-xs text-gray-300">SNAP</span>
          </button>
        </div>
      </div>

      {/* App Drawer */}
      <div className="mb-8 flex-1 overflow-hidden flex flex-col">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">App Drawer</h3>
        <div className="grid grid-cols-4 gap-3 overflow-y-auto pr-1 pb-2">
          {APP_PRESETS.map((app) => {
            // Dynamically get icon component, fallback to Box
            const IconComponent = (Icons as any)[app.icon] || Icons.Box;

            return (
              <button
                key={app.id}
                onClick={() => onLaunchApp(app)}
                className="flex flex-col items-center justify-center aspect-square rounded-xl bg-white/5 hover:bg-white/20 transition-all hover:scale-105 group"
                title={app.name}
              >
                <IconComponent size={20} className="text-gray-300 group-hover:text-white" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Text Injection */}
      <div className="mt-auto">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Text Injection</h3>
        <form onSubmit={handleSendText} className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type to inject..."
            className="w-full bg-black/30 border border-white/10 rounded-lg py-3 pl-10 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors font-mono"
          />
          <Keyboard size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md bg-neon-blue/20 text-neon-blue hover:bg-neon-blue hover:text-white transition-colors"
          >
            <ArrowRight size={14} />
          </button>
        </form>
      </div>

    </div>
  );
};

export default TacticalDeck;
