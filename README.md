# iOS Neural Command Interface

A futuristic, glassmorphism-styled Single Page Application (SPA) dashboard for iOS device automation and control. This interface acts as a "Tactical Command Center," featuring real-time device status, simulated screen mirroring, and an AI-powered neural core for voice commands.

![UI Concept](https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop) 
*(Concept art implies the aesthetic: Dark Mode, Neon Accents, Translucent Panels)*

## 🚀 Key Features

### 1. Device Matrix (Sidebar)
- **Visual Inventory**: Vertical list of available devices (iPhone/iPad) with battery and OS info.
- **Status Monitoring**: 
  - 🟢 **Online**: Ready for commands.
  - 🟡 **Busy**: Establishing connection (animated pulse).
  - 🔴/⚫ **Offline**: Disconnected.
- **Connection Logic**: Simulates a cryptographic handshake and tunnel establishment before enabling control.

### 2. The Stage (Center)
- **Live Stream Simulation**: Renders a "screen mirroring" view using Canvas.
- **Dynamic Overlays**: Displays AI-recognized text as cinematic subtitles over the device screen.
- **Context Awareness**: The screen visual changes based on the last executed action (e.g., launching Safari vs Instagram).

### 3. Tactical Deck (Right Panel)
- **Quick Actions**: Large, touch-friendly buttons for core OS functions (Home, Lock, Screenshot, App Switcher).
- **App Drawer**: Grid of preset apps parsed from configuration, allowing one-click launches.
- **Text Injection**: Input field to type on the desktop and inject keystrokes into the iOS device.

### 4. Neural Core (AI Voice)
- **Voice Control**: Powered by **Google Gemini 2.5 Flash**.
- **Natural Language**: Interpret commands like *"Open Safari and type hello world"* into structured JSON actions.
- **Visual Feedback**: 
  - 🔵 **Listening**: Soundwave animation.
  - 🟣 **Processing**: Spinning neural circuit.
  - 🟢 **Speaking**: Pulsing response.

### 5. System Terminal (Bottom)
- **Real-time Logs**: Displays the raw shell commands (e.g., `./send_to_ios_wireless.sh`) being generated.
- **Authenticity**: Features scrolling history, timestamping, and a blinking cursor.

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS (Custom "Glass" config with `backdrop-blur`, `bg-white/5`)
- **AI Integration**: Google GenAI SDK (`@google/genai`)
- **Icons**: Lucide React

## 📦 Setup & Usage

1. **API Key Configuration**:
   The application requires a valid Google Gemini API Key. Ensure `process.env.API_KEY` is available in your build environment.

2. **Operation**:
   - **Select** a device from the left matrix.
   - Click the **Link/Connect** button to initialize the uplink.
   - Wait for the **Terminal** to report `[SUCCESS]` and the status dot to turn **Green**.
   - Use the **Tactical Deck** or the **Neural Orb** to control the device.

## ⚠️ Note

This application is a **frontend interface**. The backend execution of shell scripts (`connect_ios_wireless`, `send_to_ios_wireless.sh`) is currently **simulated** within the browser `deviceBridge.ts` service for demonstration purposes. In a production environment, this would connect to a local WebSocket server running the actual bash scripts.