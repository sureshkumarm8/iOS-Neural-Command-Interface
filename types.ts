export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BUSY = 'BUSY'
}

export interface Device {
  id: string;
  name: string;
  type: 'iPhone' | 'iPad';
  ip: string;
  osVersion: string;
  batteryLevel: number;
  status: DeviceStatus;
}

export interface AppPreset {
  id: string;
  name: string;
  bundleId: string;
  icon: string; // URL or Lucide Icon Name
  category: 'social' | 'system' | 'media' | 'utility';
}

export interface CommandAction {
  action: 'LAUNCH_APP' | 'KILL_APP' | 'HOME' | 'LOCK' | 'SCREENSHOT' | 'TYPE' | 'OPEN_URL' | 'RESTART' | 'UNINSTALL' | 'UNKNOWN';
  payload?: string; // bundleId, text, or url
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  text: string;
  type: 'info' | 'command' | 'success' | 'error';
}