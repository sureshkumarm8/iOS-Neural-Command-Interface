import React from 'react';
import { Smartphone, Tablet, Wifi, WifiOff, Battery, Link, Loader2 } from 'lucide-react';
import { Device, DeviceStatus } from '../types';

interface DeviceMatrixProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onSelectDevice: (id: string) => void;
  onConnectDevice: (device: Device) => void;
}

const DeviceMatrix: React.FC<DeviceMatrixProps> = ({ devices, selectedDeviceId, onSelectDevice, onConnectDevice }) => {
  return (
    <div className="flex flex-col h-full bg-glass-100 backdrop-blur-xl border-r border-white/10 p-4">
      <div className="mb-6 flex items-center space-x-2">
        <div className="w-2 h-2 bg-neon-blue rounded-full animate-pulse"></div>
        <h2 className="text-xl font-mono font-bold tracking-widest text-white uppercase">Device Matrix</h2>
      </div>

      <div className="space-y-3 overflow-y-auto pr-2">
        {devices.map((device) => {
          const isSelected = selectedDeviceId === device.id;
          const isOnline = device.status === DeviceStatus.ONLINE;
          const isBusy = device.status === DeviceStatus.BUSY;

          return (
            <div
              key={device.id}
              className={`w-full group relative flex items-center p-3 rounded-xl border transition-all duration-300 ${
                isSelected
                  ? 'bg-white/10 border-neon-blue/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'bg-glass-100 border-white/5 hover:bg-white/5 hover:border-white/20'
              }`}
            >
              {/* Click area for selection */}
              <div 
                className="absolute inset-0 cursor-pointer z-0" 
                onClick={() => onSelectDevice(device.id)}
              />

              {/* Status Indicator Dot */}
              <div
                className={`absolute right-3 top-3 w-2 h-2 rounded-full transition-colors duration-500 ${
                  isOnline
                    ? 'bg-neon-green shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : isBusy 
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-gray-600'
                }`}
              />

              {/* Icon */}
              <div className={`p-3 rounded-lg mr-4 relative z-10 pointer-events-none ${isSelected ? 'bg-neon-blue/20 text-neon-blue' : 'bg-gray-800 text-gray-400'}`}>
                {device.type === 'iPad' ? <Tablet size={24} /> : <Smartphone size={24} />}
              </div>

              {/* Info */}
              <div className="flex-1 pointer-events-none z-10">
                <h3 className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                  {device.name}
                </h3>
                <div className="flex items-center space-x-2 text-xs text-gray-500 font-mono mt-1">
                  <span>{device.ip}</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-500 font-mono mt-0.5">
                   <Battery size={10} className={device.batteryLevel < 20 ? 'text-neon-red' : ''} />
                   <span>{device.batteryLevel}%</span>
                   <span className="text-gray-600">|</span>
                   <span>{device.osVersion}</span>
                </div>
              </div>

              {/* Connect Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectDevice(device);
                }}
                disabled={isBusy}
                className={`relative z-20 p-2 rounded-lg transition-all ml-2 border border-transparent ${
                  isBusy 
                    ? 'bg-white/5 text-yellow-400' 
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10'
                }`}
                title="Connect / Refresh Link"
              >
                {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
              </button>
            </div>
          );
        })}
      </div>
      
      <div className="mt-auto pt-4 border-t border-white/10 text-xs text-gray-500 font-mono text-center">
        SYSTEM STATUS: NORMAL
      </div>
    </div>
  );
};

export default DeviceMatrix;