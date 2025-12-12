import React, { useEffect, useRef } from 'react';
import { TerminalLog } from '../types';
import { Terminal as TerminalIcon } from 'lucide-react';

interface TerminalProps {
  logs: TerminalLog[];
}

const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-48 flex-shrink-0 bg-black/90 backdrop-blur-md border-t border-white/10 flex flex-col font-mono text-sm shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-30">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <div className="flex items-center">
            <TerminalIcon size={14} className="text-neon-blue mr-2" />
            <span className="text-gray-400 text-xs tracking-wider uppercase">System Terminal</span>
        </div>
        <div className="flex space-x-1">
            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent font-mono text-xs md:text-sm"
      >
        {logs.length === 0 && (
            <div className="text-gray-600 italic">Waiting for command input...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex group">
            <span className="text-gray-600 mr-3 flex-shrink-0 select-none">[{log.timestamp}]</span>
            <span className={`break-all ${
              log.type === 'command' ? 'text-neon-blue font-bold' :
              log.type === 'success' ? 'text-neon-green' :
              log.type === 'error' ? 'text-neon-red' :
              'text-gray-300'
            }`}>
              {log.type === 'command' ? '> ' : ''}{log.text}
            </span>
          </div>
        ))}
        {/* Blinking Cursor */}
        <div className="flex items-center mt-1">
            <span className="text-neon-blue font-bold mr-2">{'>'}</span>
            <span className="w-2 h-4 bg-neon-blue animate-pulse"></span>
        </div>
      </div>
    </div>
  );
};

export default Terminal;