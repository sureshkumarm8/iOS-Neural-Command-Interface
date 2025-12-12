import { Device, DeviceStatus, AppPreset } from './types';

export const MOCK_DEVICES: Device[] = [
  {
    id: 'd1',
    name: "iphone16p",
    type: 'iPhone',
    ip: '10.139.233.204',
    osVersion: 'iOS 18.1',
    batteryLevel: 92,
    status: DeviceStatus.OFFLINE
  },
  {
    id: 'd2',
    name: "iphone17",
    type: 'iPhone',
    ip: '10.139.233.136',
    osVersion: 'iOS 18.2 Beta',
    batteryLevel: 78,
    status: DeviceStatus.OFFLINE
  },
  {
    id: 'd3',
    name: "ipadPro",
    type: 'iPad',
    ip: '10.139.233.66',
    osVersion: 'iPadOS 18.0',
    batteryLevel: 45,
    status: DeviceStatus.OFFLINE
  }
];

export const APP_PRESETS: AppPreset[] = [
  { id: 'app1', name: 'Settings', bundleId: 'com.apple.Preferences', icon: 'Settings', category: 'system' },
  { id: 'app2', name: 'Safari', bundleId: 'com.apple.mobilesafari', icon: 'Compass', category: 'system' },
  { id: 'app3', name: 'Photos', bundleId: 'com.apple.mobileslideshow', icon: 'Image', category: 'media' },
  { id: 'app4', name: 'Instagram', bundleId: 'com.burbn.instagram', icon: 'Camera', category: 'social' },
  { id: 'app5', name: 'TikTok', bundleId: 'com.zhiliaoapp.musically', icon: 'Music2', category: 'social' },
  { id: 'app6', name: 'Spotify', bundleId: 'com.spotify.client', icon: 'Headphones', category: 'media' },
  { id: 'app7', name: 'Youtube', bundleId: 'com.google.ios.youtube', icon: 'PlayCircle', category: 'media' },
  { id: 'app8', name: 'Maps', bundleId: 'com.apple.Maps', icon: 'Map', category: 'utility' },
  { id: 'app9', name: 'Notes', bundleId: 'com.apple.mobilenotes', icon: 'FileText', category: 'utility' },
];