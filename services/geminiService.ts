import { GoogleGenAI, Type } from "@google/genai";
import { CommandAction } from "../types";

// Lazy initialization to prevent crash if API Key is missing at startup
let ai: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

const SYSTEM_INSTRUCTION = `
You are the Neural Core for an iOS tactical interface. 
Your job is to interpret user voice or text commands and map them to specific JSON actions to control an iOS device.

Available Actions:
- LAUNCH_APP: Open an application. Payload = app name (e.g., "Safari", "Settings", "Instagram").
- HOME: Go to home screen.
- LOCK: Lock the device.
- SCREENSHOT: Take a screenshot.
- TYPE: Type text into the device. Payload = the text to type.
- OPEN_URL: Open a specific URL. Payload = the full URL.
- UNKNOWN: If the command is not understood.

Response Rules:
1. "narration" should be a short, robotic, tactical confirmation (e.g., "Executing launch sequence.", "Target locked.", "Injecting text.").
2. If the user wants to type something, use the TYPE action.
3. Be concise.
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: {
      type: Type.STRING,
      enum: [
        "LAUNCH_APP",
        "KILL_APP",
        "HOME",
        "LOCK",
        "SCREENSHOT",
        "TYPE",
        "OPEN_URL",
        "RESTART",
        "UNINSTALL",
        "UNKNOWN"
      ]
    },
    payload: {
      type: Type.STRING,
      description: "The target app name, text to type, or URL."
    },
    narration: {
      type: Type.STRING,
      description: "Short tactical confirmation message."
    }
  },
  required: ["action", "narration"]
};

export async function interpretCommand(input: { audioData?: string; mimeType?: string; text?: string }): Promise<CommandAction> {
  try {
    const parts = [];
    
    if (input.audioData && input.mimeType) {
      parts.push({
        inlineData: {
          data: input.audioData,
          mimeType: input.mimeType
        }
      });
    }
    
    if (input.text) {
      parts.push({
        text: input.text
      });
    }

    if (parts.length === 0) {
        throw new Error("No input provided to Neural Core");
    }

    const client = getAIClient();
    
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: {
        role: 'user',
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Neural Core");
    }

    return JSON.parse(responseText) as CommandAction;
  } catch (error) {
    console.error("Gemini Service Error:", error);
    return {
      action: 'UNKNOWN',
      narration: "Neural uplink failed. Signal lost."
    };
  }
}