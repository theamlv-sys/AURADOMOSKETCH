import { GenerationConfig, VideoGenerationConfig, SpeechSegment } from "../types";

const ACCESS_CODE_USER_ID = "aura-user-session-v1";
const API_BASE = "http://localhost:3001/api";

// Helper for Fetch handling
const postToProxy = async (endpoint: string, body: any) => {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ACCESS_CODE_USER_ID
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `Proxy error ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error(`Proxy call failed for ${endpoint}:`, err);
    throw err;
  }
};

// --- CLIENT SERVICES ---

export const generateArtFromSketch = async (
  sketchBase64: string,
  config: GenerationConfig,
  stylePrompt: string = ""
): Promise<string | null> => {
  const data = await postToProxy("/generate-art", {
    sketchBase64,
    config,
    stylePrompt
  });
  return data.result;
};

export const generateVideoFromImage = async (
  config: VideoGenerationConfig,
  onStatusChange: (status: string) => void
): Promise<string | null> => {
  onStatusChange("Requesting cinematic render from server...");
  const data = await postToProxy("/generate-video", { config });

  if (data.videoUri) {
    onStatusChange("Render complete! Finalizing...");
    return data.videoUri; // Return the cloud URI directly
  }

  if (data.videoBase64) {
    const binary = atob(data.videoBase64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const blob = new Blob([array], { type: data.mimeType || 'video/mp4' });
    return URL.createObjectURL(blob);
  }
  return null;
};

export const analyzeVideoForSpeech = async (videoUrl: string, voiceInstruction: string = ""): Promise<SpeechSegment[]> => {
  // Not yet implemented on backend for this milestone
  console.warn("Speech analysis temporarily unavailable during transition.");
  return [];
};

export const generateMixedVoiceover = async (segments: SpeechSegment[], voiceInstruction: string = ""): Promise<string> => {
  // Not yet implemented on backend for this milestone
  console.warn("Voiceover temporarily unavailable during transition.");
  return "";
};
