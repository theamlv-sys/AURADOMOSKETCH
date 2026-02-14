
export interface DrawingState {
  color: string;
  brushSize: number;
  tool: 'brush' | 'eraser';
}

export type UserTier = 'designer' | 'producer' | 'studio' | 'visitor';
export type ModelMode = 'standard' | 'pro';

export interface HistoryItem {
  id: string;
  sketch: string;
  reference?: string;
  result: string;
  prompt: string;
  timestamp: number;
}

export interface VideoHistoryItem {
  id: string;
  videoUrl: string;
  prompt: string;
  timestamp: number;
}

export interface StylePreset {
  id: string;
  name: string;
  prompt: string;
  thumbnail: string;
}

export interface GenerationConfig {
  prompt: string;
  negativePrompt: string;
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  stylePreset?: string;
  referenceImage?: string;
  model?: string;
  modelMode?: ModelMode;
  outputResolution?: string; // '1K' | '2K' | '4K'
}

export type VideoMode = 'interpolation' | 'reference';
export type VideoResolution = '720p' | '1080p' | '4K'; // Added 4K support

export interface VideoGenerationConfig {
  mode: VideoMode;
  prompt: string;
  startingImage?: string;
  endingImage?: string;
  ingredients?: string[]; // Multiple reference images (assets)
  aspectRatio: "16:9" | "9:16";
  model: string;
  resolution: VideoResolution; // Added resolution field
}

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface SpeechSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  voice: VoiceName;
  speakerLabel: string;
}
