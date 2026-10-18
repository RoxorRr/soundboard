export interface Player {
  id: string;
  number: number;
  name: string;
  goals: number;
  assists: number;
}

export type TTSProvider = 'elevenlabs' | 'cartesia' | 'speechify';

export interface Announcement {
  id: string;
  type: 'goal' | 'assist' | 'penalty' | 'welcome' | 'period';
  playerId: string;
  playerNumber: number;
  playerName: string;
  text: string;
  timestamp: number;
  source: 'elevenlabs' | 'cartesia' | 'speechify' | 'webspeech';
  cartesiaAccount?: 'account1' | 'account2';
  team?: string;
  penaltyInfraction?: string;
  penaltyDuration?: string;
  penaltyClockTime?: string;
}

export interface SpeechifyPersonalVoice {
  id: string;
  name: string;
  models: string[];
  gender?: string;
  locale?: string;
}

export interface VoiceStatus {
  configured: boolean;
  elevenLabsConfigured?: boolean;
  cartesiaConfigured?: boolean;
  cartesiaAccount1Configured?: boolean;
  cartesiaAccount2Configured?: boolean;
  cartesiaAccountsCount?: number;
  speechifyConfigured?: boolean;
  apiKeyConfigured?: boolean;
  apiKeySource?: string;
  apiKeyMasked?: string;
  apiKeyLength?: number;
  apiConnectionStatus?: 'verified' | 'unauthorized' | 'quota_exceeded' | 'error' | 'not_configured';
  apiErrorMessage?: string;
  activeProvider?: TTSProvider;
  geminiConfigured?: boolean;
  voiceId: string;
  cartesiaVoiceId?: string;
  cartesiaVoiceId2?: string;
  speechifyVoiceId?: string;
  speechifyVoiceName?: string;
  hasCustomVoiceEnv?: boolean;
  envVoiceSource?: string;
  hasPersonalVoice?: boolean;
  personalVoices?: SpeechifyPersonalVoice[];
  model: string;
  cartesiaModel?: string;
  speechifyModel?: string;
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
  voiceIdAccount1?: string;
  voiceIdAccount2?: string;
  modelId: string;
  speed: number;
  pitchCents: number;
  emotion?: 'neutral' | 'excited' | 'optimistic' | 'authoritative';
  accountMode?: 'auto' | 'account1' | 'account2';
}

export interface SpeechifyVoiceSettings {
  voiceId: string;
  model: string;
  speed: number;
  pitchCents: number;
}

export type GoalHornPreset = 'custom' | 'pelham_blast' | 'nhl_foghorn' | 'arena_siren';

export interface GoalHornItem {
  id: string; // 'official_pelham' or 'horn_<timestamp>'
  name: string; // User-defined or display name e.g. "Official Pelham Goal Horn"
  filename: string;
  mimeType: string;
  fileSize?: number;
  duration?: number;
  audioBase64?: string | null;
  isDefault?: boolean; // True for the official Pelham goal horn
  isBuiltin?: boolean;
  createdAt: number;
}

export interface StoredGoalHornData {
  hasCustomHorn: boolean;
  audioBase64?: string | null;
  mimeType: string;
  filename: string;
  fileSize?: number;
  duration?: number;
  updatedAt: number;
}

export interface MixerSettings {
  hornEnabled: boolean;
  hornVolume: number; // 0.0 to 1.0
  voiceVolume: number; // 0.0 to 1.0
  masterVolume: number; // 0.0 to 1.0
  selectedPreset: GoalHornPreset;
  activeGoalHornId?: string; // ID of the currently selected goal horn (defaults to 'official_pelham')
  hornDurationLimit: number; // in seconds (e.g. 3, 5, 8, 10, or 0 for full file)
  voiceTriggerMode: 'after_horn' | 'delay'; // 'after_horn' or delay in seconds
  voiceDelaySeconds: number; // delay before voice kicks in (e.g. 2.0s)
  duckHornOnVoice: boolean; // lower horn volume when voice starts
  autoTriggerOnGoal: boolean; // automatically trigger sequence on goal score
}


