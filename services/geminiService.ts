import { GoogleGenAI, Type } from "@google/genai";
import { CommandAction } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = `
You are the Neural Core of an iOS automation system. 
Your task is to interpret user commands (provided as text or audio) and convert them into structured JSON actions for the backend script.

The available actions are:
1. LAUNCH_APP: Open an app. Payload: App name or bundle ID (e.g., "Safari", "com.apple.mobilesafari").
2. KILL_APP: Force close/terminate an app. Payload: App name.
3. HOME: Go to the home screen.
4. LOCK: Lock the device.
5. SCREENSHOT: Take a screenshot.
6. RESTART: Reboot the iOS device.
7. OPEN_URL: Open a website. Payload: The URL (e.g., "google.com", "https://...").
8. TYPE: Type text into the active field. Payload: The text string.
9. UNINSTALL: Uninstall an app. Payload: App name.
10. UNKNOWN: If the command is unclear.

You must also provide a short, robotic but friendly "narration" string that the system will speak back to the user.

Return ONLY the JSON object conforming to the schema.
`;

export const interpretCommand = async (input: string | { audioData: string; mimeType: string }): Promise<CommandAction> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found");
    return { action: 'UNKNOWN', narration: "System Offline. API Key missing." };
  }

  try {
    const parts = [];
    
    // Handle Input Type
    if (typeof input === 'string') {
        parts.push({ text: input });
    } else {
        parts.push({
            inlineData: {
                data: input.audioData,
                mimeType: input.mimeType
            }
        });
        parts.push({ text: "Listen to the audio command and generate the appropriate action JSON." });
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              enum: ['LAUNCH_APP', 'KILL_APP', 'HOME', 'LOCK', 'SCREENSHOT', 'TYPE', 'OPEN_URL', 'RESTART', 'UNINSTALL', 'UNKNOWN']
            },
            payload: {
              type: Type.STRING,
              nullable: true
            },
            narration: {
              type: Type.STRING
            }
          },
          required: ['action', 'narration']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as CommandAction;
    }
    throw new Error("Empty response from AI");

  } catch (error) {
    console.error("Gemini processing failed:", error);
    return { action: 'UNKNOWN', narration: "Neural link unstable. Command failed." };
  }
};