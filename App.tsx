import React, { useState, useEffect, useCallback } from 'react';
import DeviceMatrix from './components/DeviceMatrix';
import TheStage from './components/TheStage';
import TacticalDeck from './components/TacticalDeck';
import NeuralCore from './components/NeuralCore';
import Terminal from './components/Terminal';
import { MOCK_DEVICES } from './constants';
import { Device, AIState, AppPreset, CommandAction, DeviceStatus, TerminalLog } from './types';
import { interpretCommand } from './services/geminiService';
import { sendCommandToDevice, connectToDevice } from './services/deviceBridge';

const App: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>(MOCK_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AIState>(AIState.IDLE);
  const [overlayText, setOverlayText] = useState<string | null>(null);
  const [aiNarration, setAiNarration] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [logs, setLogs] = useState<TerminalLog[]>([]);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  // Logging Helper
  const addLog = useCallback((text: string, type: TerminalLog['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      text,
      type
    }]);
  }, []);

  // Core Action Handler
  const executeAction = useCallback(async (actionType: CommandAction['action'], payload?: string) => {
    if (!selectedDevice) {
        setAiNarration("No device selected. Aborting.");
        addLog("Action failed: No device selected", 'error');
        return;
    }
    
    if (selectedDevice.status !== DeviceStatus.ONLINE) {
        setAiNarration("Device offline. Please connect first.");
        addLog(`Cannot execute ${actionType}: Device ${selectedDevice.name} is offline`, 'error');
        return;
    }

    setLastAction(`${actionType} ${payload || ''}`);
    
    const commandObj: CommandAction = { action: actionType, payload };
    
    // Pass addLog to bridge to render commands in terminal
    await sendCommandToDevice(selectedDevice, commandObj, addLog);

    setTimeout(() => {
        // setLastAction(null); 
    }, 2000);
  }, [selectedDevice, addLog]);

  // Connection Handler
  const handleConnectDevice = async (device: Device) => {
    // 1. Update UI to BUSY
    setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: DeviceStatus.BUSY } : d));
    setAiNarration(`Initializing uplink to ${device.name}...`);
    
    try {
      // 2. Run Connect Script (Simulated)
      await connectToDevice(device, addLog);

      // 3. Update UI to ONLINE only after success
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: DeviceStatus.ONLINE } : d));
      setAiNarration(`Connection established: ${device.name}`);
    } catch (e) {
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: DeviceStatus.OFFLINE } : d));
      addLog(`Connection failed for ${device.name}`, 'error');
      setAiNarration(`Connection failed.`);
    }
  };

  // Listen for custom event from NeuralCore
  useEffect(() => {
    const startListenHandler = () => {
      setAiState(AIState.LISTENING);
      setOverlayText(null);
      setAiNarration(null);
    };
    window.addEventListener('neural-start-listen', startListenHandler);
    return () => window.removeEventListener('neural-start-listen', startListenHandler);
  }, []);

  // Handle Voice Command
  const handleVoiceCommand = async (text: string) => {
    setAiState(AIState.PROCESSING);
    setOverlayText(text);

    try {
      const command: CommandAction = await interpretCommand(text);

      setAiState(AIState.SPEAKING);
      setAiNarration(command.narration);

      if ('speechSynthesis' in window && command.narration) {
        const utterance = new SpeechSynthesisUtterance(command.narration);
        utterance.rate = 1.1;
        utterance.pitch = 0.9;
        utterance.onend = () => setAiState(AIState.IDLE);
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(() => setAiState(AIState.IDLE), 2000);
      }

      if (command.action !== 'UNKNOWN') {
        executeAction(command.action, command.payload);
      } 
    } catch (e) {
      setAiState(AIState.IDLE);
      setAiNarration("Error processing command.");
      addLog(`AI Error: ${e}`, 'error');
    }
  };

  // Direct actions
  const handleLaunchApp = (app: AppPreset) => {
    executeAction('LAUNCH_APP', app.name);
    setAiNarration(`Launching ${app.name}`);
  };

  const handleSystemAction = (action: string) => {
    const mappedAction = action as CommandAction['action']; 
    executeAction(mappedAction);
    setAiNarration(`Executing ${action}`);
  };

  const handleType = (text: string) => {
    executeAction('TYPE', text);
    setAiNarration("Injecting text sequence");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans text-gray-200">
      {/* Sidebar - Device Matrix */}
      <div className="w-80 h-full flex-shrink-0 z-20 border-r border-white/10">
        <DeviceMatrix 
          devices={devices} 
          selectedDeviceId={selectedDeviceId} 
          onSelectDevice={setSelectedDeviceId} 
          onConnectDevice={handleConnectDevice}
        />
      </div>

      {/* Main Area Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative z-10">
        
        {/* Stage Area - Added flex-col and min-h-0 to contain TheStage */}
        <div className="flex-1 relative flex flex-col min-h-0">
           <TheStage 
            device={selectedDevice} 
            overlayText={overlayText} 
            lastAction={lastAction}
          />
          <NeuralCore 
            onCommand={handleVoiceCommand} 
            aiState={aiState}
            narration={aiNarration}
          />
        </div>

        {/* Terminal Area (Bottom) */}
        <Terminal logs={logs} />
      </div>

      {/* Right Panel - Tactical Deck */}
      <div className="h-full z-20 border-l border-white/10">
        <TacticalDeck 
          onLaunchApp={handleLaunchApp}
          onSystemAction={handleSystemAction}
          onType={handleType}
          disabled={!selectedDevice || selectedDevice.status !== DeviceStatus.ONLINE}
        />
      </div>
    </div>
  );
};

export default App;