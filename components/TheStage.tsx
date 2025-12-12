import React, { useEffect, useState, useRef } from 'react';
import { Device, DeviceStatus } from '../types';
import { WifiOff, Lock, Home, Loader2, Wifi } from 'lucide-react';

interface TheStageProps {
  device: Device | undefined;
  overlayText: string | null; // For subtitles
  lastAction: string | null;
}

const TheStage: React.FC<TheStageProps> = ({ device, overlayText, lastAction }) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Simulate MJPEG Stream Loop (fake 5 FPS)
  useEffect(() => {
    if (!device || device.status !== DeviceStatus.ONLINE) return;

    const interval = setInterval(() => {
      setFrameIndex(prev => prev + 1);
    }, 200);

    return () => clearInterval(interval);
  }, [device]);

  // Drawing the "screen"
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !device) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (device.status !== DeviceStatus.ONLINE) {
        return;
    }

    // Draw Mock UI based on "Last Action" or Random
    // Gradient Background for phone screen
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1e293b'); // Dark Slate
    gradient.addColorStop(1, '#0f172a'); // Darker Slate
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mock Content
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.roundRect(20, 60, canvas.width - 40, 100, 15);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.roundRect(20, 180, canvas.width - 40, 100, 15);
    ctx.fill();

    // Time
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Inter';
    ctx.textAlign = 'center';
    const now = new Date();
    ctx.fillText(`${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`, canvas.width / 2, 40);

    // Dynamic Element based on action to simulate responsiveness
    if (lastAction?.includes('Safari')) {
        ctx.fillStyle = '#fff';
        ctx.fillText("Safari Browser", canvas.width / 2, canvas.height / 2);
    } else if (lastAction?.includes('Instagram')) {
        ctx.fillStyle = '#E1306C';
        ctx.fillText("Instagram", canvas.width / 2, canvas.height / 2);
    } else if (lastAction?.includes('Settings')) {
        ctx.fillStyle = '#9ca3af';
        ctx.fillText("Settings", canvas.width / 2, canvas.height / 2);
    }

    // "Live" indicator in corner of canvas
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(canvas.width - 20, 20, 4, 0, Math.PI * 2);
    ctx.fill();

  }, [frameIndex, device, lastAction]);


  if (!device) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="text-center text-gray-500 font-mono border border-white/5 bg-white/5 p-8 rounded-3xl shadow-inner">
          <p className="mb-2 text-lg">NO TARGET SELECTED</p>
          <p className="text-xs opacity-50">Select a device from the Matrix to begin interception.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/20 via-slate-900/50 to-black pointer-events-none z-0"></div>

      {/* Header Info */}
      <div className="relative z-10 flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{device.name}</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
                device.status === DeviceStatus.ONLINE ? 'bg-neon-green' : 
                device.status === DeviceStatus.BUSY ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'
            }`}></div>
            <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">
                {device.status === DeviceStatus.BUSY ? 'ESTABLISHING UPLINK...' : device.status}
            </p>
          </div>
        </div>
        {device.status === DeviceStatus.ONLINE && (
            <div className="flex items-center space-x-4">
                <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono animate-pulse">
                    REC ●
                </div>
            </div>
        )}
      </div>

      {/* The Device Frame Container - flex-1 to take available space, centered */}
      <div className="flex-1 flex items-center justify-center relative z-10 overflow-hidden">
        
        {/* Phone Bezel */}
        <div className={`relative flex-shrink-0 transition-all duration-500 ${device.type === 'iPad' ? 'w-[600px] h-[450px]' : 'w-[320px] h-[650px]'} bg-gray-900 rounded-[3rem] border-8 border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10 scale-90 lg:scale-100`}>
          
          {device.status === DeviceStatus.OFFLINE ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black text-gray-600">
               <WifiOff size={48} className="mb-4 opacity-30" />
               <span className="font-mono text-sm tracking-widest opacity-50">OFFLINE</span>
               <span className="text-xs text-gray-700 mt-2">Connect to device to view stream</span>
            </div>
          ) : device.status === DeviceStatus.BUSY ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black text-neon-blue">
               <Loader2 size={48} className="mb-4 animate-spin opacity-80" />
               <span className="font-mono text-sm tracking-widest animate-pulse">CONNECTING...</span>
               <span className="text-xs text-neon-blue/50 mt-2 font-mono">{device.ip}</span>
            </div>
          ) : (
            <>
              {/* Canvas mimicking MJPEG stream */}
              <canvas 
                ref={canvasRef} 
                width={device.type === 'iPad' ? 600 : 320} 
                height={device.type === 'iPad' ? 450 : 650} 
                className="w-full h-full object-cover opacity-90"
              />
              
              {/* Subtitle Overlay */}
              {overlayText && (
                <div className="absolute bottom-12 left-4 right-4 text-center pointer-events-none">
                  <span className="inline-block bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-xl text-lg font-medium shadow-lg animate-float">
                    "{overlayText}"
                  </span>
                </div>
              )}
            </>
          )}

          {/* Dynamic Island / Notch */}
          {device.type === 'iPhone' && (
             <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-20"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TheStage;