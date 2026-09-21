export interface Player {
  id: string;
  number: number;
  name: string;
  goals: number;
  assists: number;
}

export type TTSProvider = 'elevenlabs' | 'cartesia';

export type AccountChoice = 'account1' | 'account2';

export interface Announcement {
  id: string;
  type: 'goal' | 'assist' | 'penalty' | 'welcome';
  playerId: string;
  playerNumber: number;
  playerName: string;
  text: string;
  timestamp: number;
  source: 'elevenlabs' | 'cartesia' | 'webspeech';
  team?: string;
  penaltyInfraction?: string;
  penaltyDuration?: string;
  penaltyClockTime?: string;
}

export interface VoiceStatus {
  configured: boolean;
  elevenLabsConfigured?: boolean;
  cartesiaConfigured?: boolean;
  cartesiaAccount1Configured?: boolean;
  cartesiaAccount2Configured?: boolean;
  activeProvider?: TTSProvider;
  activeCartesiaAccount?: AccountChoice;
  geminiConfigured?: boolean;
  voiceId: string;
  cartesiaVoiceId?: string;
  model: string;
  cartesiaModel?: string;
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

export interface CartesiaVoiceSettings {
  voiceId: string;
  modelId: string;
  speed: number;
  pitchCents: number;
  emotion?: 'neutral' | 'excited' | 'optimistic' | 'authoritative';
}

