import { GoogleGenAI, Type } from "@google/genai";
import { CommandAction } from "../types";

// Lazy initialization to prevent crash if API Key is missing at startup
let ai: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!ai) {
    // Check if API key is present
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'undefined') {
        throw new Error("Missing API_KEY in environment");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const SYSTEM_INSTRUCTION = `
You are the Neural Core for an iOS tactical interface. 
Your job is to interpret user voice or text commands and map them to specific JSON actions to control an iOS device.

Available Actions:
- LAUNCH_APP: Open an application. Payload = exact app name (e.g., "Safari", "Settings", "Instagram", "TikTok", "Maps"). Fuzzy match if close.
- HOME: Go to home screen (e.g., "go home", "close app", "main screen").
- LOCK: Lock the device (e.g., "lock screen", "sleep").
- SCREENSHOT: Take a screenshot (e.g., "capture", "snap", "screenshot").
- TYPE: Type text into the device. Payload = the text to type. (e.g., "type hello", "enter password 1234").
- OPEN_URL: Open a specific URL. Payload = the full URL.
- UNKNOWN: If the audio is silence, unintelligible, or not a command.

Response Rules:
1. "narration" should be a short, robotic, tactical confirmation (e.g., "Executing launch sequence.", "Target locked.", "Injecting text.").
2. If the user wants to type something, use the TYPE action.
3. Be concise.
4. If the audio implies opening an app but you aren't sure which, guess the most likely one from the list: [Settings, Safari, Photos, Instagram, TikTok, Spotify, Youtube, Maps, Notes].
5. ALWAYS return valid JSON. If the audio is unclear, return action="UNKNOWN" and narration="Audio signal unclear."
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

// Helper to clean JSON if model returns markdown
function cleanAndParseJSON(text: string): CommandAction {
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("JSON Parse failed, attempting cleanup...");
        // Strip markdown code blocks
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]);
        }
        
        // Attempt to find start and end of object
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
             return JSON.parse(text.substring(startIndex, endIndex + 1));
        }
        
        throw e;
    }
}

export async function interpretCommand(input: { audioData?: string; mimeType?: string; text?: string }): Promise<CommandAction> {
  try {
    const parts = [];
    
    if (input.audioData && input.mimeType) {
      // Sanitize mimeType: API often prefers 'audio/webm' or 'audio/mp3' without parameters like codecs
      let cleanMimeType = input.mimeType;
      if (cleanMimeType.includes(';')) {
          cleanMimeType = cleanMimeType.split(';')[0];
      }

      parts.push({
        inlineData: {
          data: input.audioData,
          mimeType: cleanMimeType
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
    
    // Using gemini-2.5-flash for multimodal capabilities
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: [
        {
            role: 'user',
            parts: parts
        }
      ],
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

    return cleanAndParseJSON(responseText);

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    
    // Extract meaningful error message
    let errorMessage = "Neural uplink failed. Signal lost.";
    let technicalDetails = error.message || "";

    if (error.message.includes("API_KEY")) {
        errorMessage = "Error: System Identity Config Missing (API Key).";
    } else if (error.message.includes("404")) {
        errorMessage = "Error: AI Model Not Found (404).";
    } else if (error.message.includes("400")) {
        errorMessage = "Error: Invalid Audio Protocol (400).";
    } else if (error.message.includes("503")) {
        errorMessage = "Error: Neural Core Overload (503).";
    }

    return {
      action: 'UNKNOWN',
      narration: errorMessage
    };
  }
}