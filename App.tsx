import React, { useState, useCallback } from 'react';
import DeviceMatrix from './components/DeviceMatrix';
import TheStage from './components/TheStage';
import TacticalDeck from './components/TacticalDeck';
import Terminal from './components/Terminal';
import NeuralCore from './components/NeuralCore';
import { MOCK_DEVICES } from './constants';
import { Device, AppPreset, CommandAction, DeviceStatus, TerminalLog, AIState } from './types';
import { sendCommandToDevice, connectToDevice, disconnectFromDevice } from './services/deviceBridge';
import { interpretCommand } from './services/geminiService';

const App: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>(MOCK_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [logs, setLogs] = useState<TerminalLog[]>([]);

  // AI State
  const [aiState, setAiState] = useState<AIState>(AIState.IDLE);
  const [narration, setNarration] = useState<string | null>(null);

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
        addLog("Action failed: No device selected", 'error');
        return;
    }
    
    if (selectedDevice.status !== DeviceStatus.ONLINE) {
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

  // Handle Voice Input
  const handleVoiceInput = async (audioData: string, mimeType: string) => {
    if (!selectedDevice) {
        setNarration("Please select a device first.");
        setAiState(AIState.SPEAKING);
        setTimeout(() => {
            setAiState(AIState.IDLE);
            setNarration(null);
        }, 3000);
        return;
    }
    
    setAiState(AIState.PROCESSING);
    addLog("Processing voice command...", 'info');

    try {
        // Use Gemini Flash Lite for fast response
        const command = await interpretCommand({ audioData, mimeType });
        
        if (command.narration) {
            setNarration(command.narration);
            setAiState(AIState.SPEAKING);
            addLog(`AI: ${command.narration}`, 'success');
            
            // Speak audio (Browser TTS)
            const utterance = new SpeechSynthesisUtterance(command.narration);
            // Optional: Choose a more robotic voice if available
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
            if (preferredVoice) utterance.voice = preferredVoice;
            
            utterance.rate = 1.1; // Slightly faster for "tactical" feel

            utterance.onend = () => {
                 setAiState(AIState.IDLE);
                 setNarration(null);
            };
            // Safety timeout in case onend doesn't fire
            setTimeout(() => {
                if (window.speechSynthesis.speaking) {
                    // Don't cancel, just reset UI
                    setAiState(AIState.IDLE);
                    setNarration(null);
                }
            }, 6000);
            
            window.speechSynthesis.speak(utterance);
        } else {
             setAiState(AIState.IDLE);
        }

        if (command.action !== 'UNKNOWN') {
            await executeAction(command.action, command.payload);
        }

    } catch (error) {
        console.error("AI Error:", error);
        addLog("Neural Core processing failed.", 'error');
        setAiState(AIState.IDLE);
        setNarration(null);
    }
  };

  // Allow text injection to also be smart if we wanted, 
  // currently TacticalDeck sends 'TYPE' directly.
  // We can add a "Smart Text" feature later.

  // Connection Handler
  const handleConnectDevice = async (device: Device) => {
    // 1. Update UI to BUSY
    setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: DeviceStatus.BUSY } : d));
    addLog(`Initializing uplink to ${device.name}...`, 'info');
    
    try {
      // 2. Run Connect Script
      await connectToDevice(device, addLog);

      // 3. Update UI to ONLINE only after success
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: DeviceStatus.ONLINE } : d));
      addLog(`Connection established: ${device.name}`, 'success');
    } catch (e) {
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: DeviceStatus.OFFLINE } : d));
      addLog(`Connection failed for ${device.name}`, 'error');
    }
  };

  // Disconnect Handler
  const handleDisconnectDevice = async (device: Device) => {
    addLog(`Terminating uplink for ${device.name}...`, 'info');
    try {
        await disconnectFromDevice(device, addLog);
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: DeviceStatus.OFFLINE } : d));
    } catch (e) {
        addLog(`Force disconnect triggered for ${device.name}`, 'error');
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: DeviceStatus.OFFLINE } : d));
    }
  };

  // Direct actions
  const handleLaunchApp = (app: AppPreset) => {
    executeAction('LAUNCH_APP', app.name);
    addLog(`Launching ${app.name}`, 'command');
  };

  const handleSystemAction = (action: string) => {
    const mappedAction = action as CommandAction['action']; 
    executeAction(mappedAction);
    addLog(`Executing ${action}`, 'command');
  };

  const handleType = (text: string) => {
    executeAction('TYPE', text);
    addLog(`Injecting text sequence`, 'command');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans text-gray-200 relative">
      {/* Sidebar - Device Matrix */}
      <div className="w-80 h-full flex-shrink-0 z-20 border-r border-white/10">
        <DeviceMatrix 
          devices={devices} 
          selectedDeviceId={selectedDeviceId} 
          onSelectDevice={setSelectedDeviceId} 
          onConnectDevice={handleConnectDevice}
          onDisconnectDevice={handleDisconnectDevice}
        />
      </div>

      {/* Main Area Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative z-10">
        
        {/* Stage Area */}
        <div className="flex-1 relative flex flex-col min-h-0">
           <TheStage 
            device={selectedDevice} 
            lastAction={lastAction}
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

      {/* Neural Core Overlay */}
      <NeuralCore 
        onVoiceInput={handleVoiceInput} 
        aiState={aiState} 
        narration={narration} 
      />
    </div>
  );
};

export default App;