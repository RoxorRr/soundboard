export interface Player {
  id: string;
  number: number;
  name: string;
  goals: number;
  assists: number;
}

export type TTSProvider = 'elevenlabs' | 'cartesia' | 'google' | 'webspeech';

export type AccountChoice = 'account1' | 'account2';

export interface Announcement {
  id: string;
  type: 'goal' | 'assist' | 'penalty' | 'welcome';
  playerId: string;
  playerNumber: number;
  playerName: string;
  text: string;
  timestamp: number;
  source: 'elevenlabs' | 'cartesia' | 'google' | 'webspeech';
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
  googleConfigured?: boolean;
  activeProvider?: TTSProvider;
  activeCartesiaAccount?: AccountChoice;
  geminiConfigured?: boolean;
  voiceId: string;
  cartesiaVoiceId?: string;
  googleVoiceId?: string;
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

export interface GoogleVoiceSettings {
  voiceId: string;
  speed: number;
  pitchCents: number;
  commentatorStyle?: 'play-by-play' | 'arena-pa' | 'thriller' | 'dramatic' | 'analyst' | 'color-analyst';
}

export interface WebSpeechVoiceSettings {
  voiceURI: string;
  speed: number;
  pitch: number; // 0.5 to 2.0 (standard WebSpeech pitch)
}

export interface AccountCreditInfo {
  configured: boolean;
  characterLimit: number;
  characterCount: number;
  remainingCredits: number;
  resetUnix?: number | null;
  resetDate?: string | null;
  tier?: string;
  status?: string;
  isLowCredits: boolean;
  source: 'api' | 'tracked' | 'manual' | 'calibrated' | 'none';
  error?: string;
  quotaExceeded?: boolean;
}

export interface CreditsStatus {
  threshold: number;
  currentMonth: string;
  elevenlabs: AccountCreditInfo;
  cartesiaAccount1: AccountCreditInfo;
  cartesiaAccount2: AccountCreditInfo;
  activeProvider: TTSProvider;
  activeCartesiaAccount: AccountChoice;
  lastChecked: number;
  lastAutoSwitch?: {
    timestamp: number;
    from: string;
    to: string;
    reason: string;
  } | null;
}

export interface AutoSwitchEvent {
  timestamp: number;
  fromProvider: TTSProvider;
  fromAccount?: AccountChoice;
  toProvider: TTSProvider;
  toAccount?: AccountChoice;
  reason: string;
  remainingCredits: number;
}

