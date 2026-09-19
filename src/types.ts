export interface Player {
  id: string;
  number: number;
  name: string;
  goals: number;
  assists: number;
}

export interface Announcement {
  id: string;
  type: 'goal' | 'assist' | 'penalty' | 'welcome';
  playerId: string;
  playerNumber: number;
  playerName: string;
  text: string;
  timestamp: number;
  source: 'elevenlabs' | 'webspeech';
  team?: string;
  penaltyInfraction?: string;
  penaltyDuration?: string;
}

export interface VoiceStatus {
  configured: boolean;
  geminiConfigured?: boolean;
  voiceId: string;
  model: string;
  team: string;
}

export interface ScannedPlayerItem {
  number: number;
  name: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface StickerScanResult {
  number: number;
  name: string;
  players?: ScannedPlayerItem[];
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface ElevenLabsVoiceSettings {
  voiceId: string;
  speed: number;
  pitchCents: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

