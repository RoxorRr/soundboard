// Professional Web Audio Arena sound engine, ElevenLabs, Cartesia & Speechify TTS player
import {
  ElevenLabsVoiceSettings,
  CartesiaVoiceSettings,
  SpeechifyVoiceSettings,
  TTSProvider,
  VoiceStatus,
  GoalHornPreset,
  StoredGoalHornData,
  MixerSettings,
} from '../types';
import {
  saveGoalHornToCloud,
  saveMixerSettingsToCloud,
  loadGoalHornFromCloud,
  subscribeGoalHornFromCloud,
  validateFirebaseConnection,
} from './firebase';
import {
  saveAudioToIdb,
  getAudioFromIdb,
  deleteAudioFromIdb,
} from './idbAudio';


export interface AnnounceResult {
  source: 'elevenlabs' | 'cartesia' | 'speechify' | 'webspeech';
  voiceId?: string;
  cartesiaAccount?: 'account1' | 'account2';
  error?: string;
}

export const DEFAULT_MIXER_SETTINGS: MixerSettings = {
  hornEnabled: true,
  hornVolume: 0.95,
  voiceVolume: 1.0,
  masterVolume: 1.0,
  selectedPreset: 'custom',
  hornDurationLimit: 0, // 0 = Full File: MP3 plays all the way through without cutoff
  voiceTriggerMode: 'delay',
  voiceDelaySeconds: 2.0,
  duckHornOnVoice: true,
  autoTriggerOnGoal: false, // User requested: Do not play simultaneously; separate MP3 and Goal buttons
};


export const DEFAULT_PELHAM_HORN: StoredGoalHornData = {
  hasCustomHorn: true,
  audioBase64: '/audio/pelham_pelicans_goal_horn.mp3',
  mimeType: 'audio/mpeg',
  filename: 'pelham_pelicans_goal_horn.mp3',
  fileSize: 2161720,
  duration: 90,
  updatedAt: 1730000000000,
};

export const DEFAULT_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  voiceId: '6j98Cb2txyqvHRXeRQYZ', // Pelham Custom NHL Voice
  speed: 1.05,
  pitchCents: 0,
  stability: 0.45,
  similarity_boost: 0.85,
  style: 0.60,
  use_speaker_boost: true
};

export const DEFAULT_CARTESIA_VOICE_SETTINGS: CartesiaVoiceSettings = {
  voiceId: 'a27f2ab7-6793-4893-9f40-e50d5e5605ba', // Pelham Custom Arena Voice
  voiceIdAccount1: 'a27f2ab7-6793-4893-9f40-e50d5e5605ba',
  voiceIdAccount2: '',
  modelId: 'sonic-3.5',
  speed: 1.05,
  pitchCents: 0,
  emotion: 'excited',
  accountMode: 'auto',
};

export const DEFAULT_SPEECHIFY_VOICE_SETTINGS: SpeechifyVoiceSettings = {
  voiceId: 'cf2bbc5b-59fb-427e-95a5-bcd76641852f', // Pelham Custom NHL Simba 3.2 Voice
  model: 'simba-3.2',
  speed: 1.05,
  pitchCents: 0,
};

export function getClientDeviceInfo(): {
  deviceId: string;
  platform: string;
  screenResolution: string;
  userAgent: string;
  language: string;
  timeZone: string;
  touchSupport: boolean;
  gameMatchInfo: string;
} {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'server',
      platform: 'server',
      screenResolution: 'unknown',
      userAgent: 'server',
      language: 'en',
      timeZone: 'UTC',
      touchSupport: false,
      gameMatchInfo: 'Pelham Pelicans',
    };
  }
  let deviceId = 'dev_unknown';
  try {
    deviceId = localStorage.getItem('pelham_device_id') || '';
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('pelham_device_id', deviceId);
    }
  } catch (_) {}

  let gameMatchInfo = 'Pelham Pelicans';
  try {
    const visitor = localStorage.getItem('pelham_visitor_team_name') || 'visiting team';
    gameMatchInfo = `Pelham Pelicans vs ${visitor}`;
  } catch (_) {}

  let timeZone = 'UTC';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {}

  return {
    deviceId,
    platform: navigator.platform || (navigator as any).userAgentData?.platform || 'Web',
    screenResolution: `${window.innerWidth}x${window.innerHeight} (Screen: ${window.screen?.width || 0}x${window.screen?.height || 0})`,
    userAgent: navigator.userAgent || 'Unknown',
    language: navigator.language || 'en',
    timeZone,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    gameMatchInfo,
  };
}

class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private playSfx: boolean = true;
  private isUnlocked: boolean = false;
  private htmlAudio: HTMLAudioElement | null = null;
  private htmlAudioUnlocked: boolean = false;
  private ttsProvider: TTSProvider = 'speechify';
  private voiceSettings: ElevenLabsVoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
  private cartesiaVoiceSettings: CartesiaVoiceSettings = { ...DEFAULT_CARTESIA_VOICE_SETTINGS };
  private speechifyVoiceSettings: SpeechifyVoiceSettings = { ...DEFAULT_SPEECHIFY_VOICE_SETTINGS };

  // Arena Mixer and Goal Horn state
  private mixerSettings: MixerSettings = { ...DEFAULT_MIXER_SETTINGS };
  private storedGoalHorn: StoredGoalHornData = { ...DEFAULT_PELHAM_HORN };
  private hornAudioElement: HTMLAudioElement | null = null;
  private hornGain: GainNode | null = null;
  private activeHornStopFns: Array<() => void> = [];
  private hornChangeListeners: Array<() => void> = [];
  private mp3PlaybackListeners: Array<(isPlaying: boolean) => void> = [];

  constructor() {
    // Exclusively Speechify is enabled per user configuration
    this.ttsProvider = 'speechify';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_tts_provider', 'speechify');

        const saved = localStorage.getItem('pelham_voice_settings');
        if (saved) {
          this.voiceSettings = { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
        }

        const savedCartesia = localStorage.getItem('pelham_cartesia_voice_settings');
        if (savedCartesia) {
          const parsed = JSON.parse(savedCartesia);
          // If previously saved with the legacy default barbershop ID, auto-upgrade to the custom voice ID
          if (parsed && (parsed.voiceId === '694f9389-aac1-45b6-b726-9d9369183238' || !parsed.voiceId)) {
            parsed.voiceId = 'a27f2ab7-6793-4893-9f40-e50d5e5605ba';
            parsed.voiceIdAccount1 = parsed.voiceIdAccount1 || 'a27f2ab7-6793-4893-9f40-e50d5e5605ba';
          }
          this.cartesiaVoiceSettings = { ...DEFAULT_CARTESIA_VOICE_SETTINGS, ...parsed };
        }

        const savedSpeechify = localStorage.getItem('pelham_speechify_voice_settings');
        if (savedSpeechify) {
          const parsed = JSON.parse(savedSpeechify);
          // If previously saved with the legacy default geffen_32 ID, auto-upgrade to the custom voice ID
          if (parsed && (parsed.voiceId === 'geffen_32' || !parsed.voiceId)) {
            parsed.voiceId = 'cf2bbc5b-59fb-427e-95a5-bcd76641852f';
          }
          this.speechifyVoiceSettings = { ...DEFAULT_SPEECHIFY_VOICE_SETTINGS, ...parsed };
        }

        const savedMixer = localStorage.getItem('pelham_mixer_settings_v1');
        if (savedMixer) {
          const parsed = JSON.parse(savedMixer);
          // If saved with old 5s/6s cutoff, ensure 0 (full track) is respected
          if (parsed.hornDurationLimit === 5 || parsed.hornDurationLimit === 6) {
            parsed.hornDurationLimit = 0;
          }
          // Do not play them simultaneously per user preference
          parsed.autoTriggerOnGoal = false;
          this.mixerSettings = { ...DEFAULT_MIXER_SETTINGS, ...parsed };
        }

        const savedHorn = localStorage.getItem('pelham_stored_goal_horn_v1');
        if (savedHorn) {
          try {
            this.storedGoalHorn = JSON.parse(savedHorn);
            if (this.storedGoalHorn?.hasCustomHorn && this.storedGoalHorn?.audioBase64) {
              this.mixerSettings.selectedPreset = 'custom';
            }
          } catch (_) {}
        }

        // 1. Prioritize IndexedDB storage for large MP3s (bypasses 5MB localStorage limits)
        getAudioFromIdb<StoredGoalHornData>('goal_horn')
          .then((idbHorn) => {
            if (idbHorn && idbHorn.hasCustomHorn && idbHorn.audioBase64) {
              this.storedGoalHorn = idbHorn;
              this.mixerSettings.selectedPreset = 'custom';
              this.notifyHornChange();
            }
          })
          .catch(() => {});

        // 2. Validate Firebase cloud connection
        validateFirebaseConnection().catch(() => {});

        // 3. Real-time Cloud Sync across all devices (Phone <-> Laptop <-> Arena PC)
        subscribeGoalHornFromCloud((cloudHorn, cloudMixer) => {
          if (cloudHorn && cloudHorn.hasCustomHorn && cloudHorn.audioBase64) {
            this.storedGoalHorn = cloudHorn;
            saveAudioToIdb('goal_horn', cloudHorn).catch(() => {});
            try {
              localStorage.setItem('pelham_stored_goal_horn_v1', JSON.stringify(cloudHorn));
            } catch (_) {}
            this.mixerSettings.selectedPreset = 'custom';
            this.notifyHornChange();
          }
          if (cloudMixer) {
            const hasCustom = Boolean(
              (this.storedGoalHorn?.hasCustomHorn && this.storedGoalHorn?.audioBase64) ||
              (cloudHorn?.hasCustomHorn && cloudHorn?.audioBase64)
            );
            const preset = hasCustom
              ? 'custom'
              : (cloudMixer.selectedPreset || this.mixerSettings.selectedPreset);
            this.mixerSettings = { ...this.mixerSettings, ...cloudMixer, selectedPreset: preset };
            try {
              localStorage.setItem('pelham_mixer_settings_v1', JSON.stringify(this.mixerSettings));
            } catch (_) {}
            this.notifyHornChange();
          }
        });

        // 4. Initial cloud pull to populate MP3 uploaded from phone on other devices
        loadGoalHornFromCloud()
          .then((cloudData) => {
            if (cloudData?.horn && cloudData.horn.hasCustomHorn && cloudData.horn.audioBase64) {
              this.storedGoalHorn = cloudData.horn;
              saveAudioToIdb('goal_horn', cloudData.horn).catch(() => {});
              this.mixerSettings.selectedPreset = 'custom';
              this.notifyHornChange();
            }
            if (cloudData?.mixerSettings) {
              const hasCustom = Boolean(this.storedGoalHorn?.hasCustomHorn && this.storedGoalHorn?.audioBase64);
              const preset = hasCustom ? 'custom' : (cloudData.mixerSettings.selectedPreset || this.mixerSettings.selectedPreset);
              this.mixerSettings = { ...this.mixerSettings, ...cloudData.mixerSettings, selectedPreset: preset };
              this.notifyHornChange();
            }
          })
          .catch(() => {});
      } catch (_) {}

      // Auto-sync fallback from server route
      setTimeout(() => {
        this.syncServerGoalHorn().catch(() => {});
      }, 300);

      // Auto-unlock on first user interaction anywhere in the window
      const unlockEvents = ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'];
      const onUserInteraction = () => {
        this.unlock();
        unlockEvents.forEach((ev) => window.removeEventListener(ev, onUserInteraction));
      };
      unlockEvents.forEach((ev) => window.addEventListener(ev, onUserInteraction, { passive: true }));
    }
  }

  // Synchronize server-configured custom voice IDs across all devices without requiring manual setup
  public syncServerVoiceDefaults(status?: VoiceStatus | null): void {
    if (!status) return;

    // 1. Sync Cartesia custom voice ID across all devices
    const targetCartesiaVoice = status.cartesiaVoiceId || 'a27f2ab7-6793-4893-9f40-e50d5e5605ba';
    if (targetCartesiaVoice) {
      const current = this.cartesiaVoiceSettings.voiceId;
      if (!current || current === '694f9389-aac1-45b6-b726-9d9369183238') {
        this.cartesiaVoiceSettings = {
          ...this.cartesiaVoiceSettings,
          voiceId: targetCartesiaVoice,
          voiceIdAccount1: targetCartesiaVoice,
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('pelham_cartesia_voice_settings', JSON.stringify(this.cartesiaVoiceSettings));
          } catch (_) {}
        }
      }
    }

    // 2. Sync ElevenLabs custom voice ID
    const targetElevenVoice = status.voiceId || '6j98Cb2txyqvHRXeRQYZ';
    if (targetElevenVoice && targetElevenVoice !== 'nhl') {
      const current = this.voiceSettings.voiceId;
      if (!current || current === 'nhl') {
        this.voiceSettings = {
          ...this.voiceSettings,
          voiceId: targetElevenVoice,
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('pelham_voice_settings', JSON.stringify(this.voiceSettings));
          } catch (_) {}
        }
      }
    }

    // 3. Sync Speechify custom voice ID across all devices (seamless across Vercel deployments)
    const targetSpeechifyVoice = status.speechifyVoiceId;
    if (targetSpeechifyVoice) {
      const current = this.speechifyVoiceSettings.voiceId;
      const isStockVoice = ['geffen_32', 'dominic_32', 'beatrice_32', 'kristy', 'cliff'].includes(current);
      if (
        !current ||
        isStockVoice ||
        current === 'cf2bbc5b-59fb-427e-95a5-bcd76641852f' ||
        current === 'nhl' ||
        status.hasPersonalVoice ||
        status.hasCustomVoiceEnv
      ) {
        this.speechifyVoiceSettings = {
          ...this.speechifyVoiceSettings,
          voiceId: targetSpeechifyVoice,
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('pelham_speechify_voice_settings', JSON.stringify(this.speechifyVoiceSettings));
          } catch (_) {}
        }
      }
    }

    // Exclusively Speechify is enabled
    this.ttsProvider = 'speechify';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_tts_provider', 'speechify');
      } catch (_) {}
    }
  }

  public getTTSProvider(): TTSProvider {
    return 'speechify';
  }

  public setTTSProvider(_provider: TTSProvider): TTSProvider {
    this.ttsProvider = 'speechify';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_tts_provider', 'speechify');
      } catch (_) {}
    }
    return 'speechify';
  }

  public getVoiceSettings(): ElevenLabsVoiceSettings {
    return { ...this.voiceSettings };
  }

  public setVoiceSettings(newSettings: Partial<ElevenLabsVoiceSettings>): ElevenLabsVoiceSettings {
    this.voiceSettings = { ...this.voiceSettings, ...newSettings };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_voice_settings', JSON.stringify(this.voiceSettings));
      } catch (_) {}
    }
    return { ...this.voiceSettings };
  }

  public getCartesiaSettings(): CartesiaVoiceSettings {
    return { ...this.cartesiaVoiceSettings };
  }

  public setCartesiaSettings(newSettings: Partial<CartesiaVoiceSettings>): CartesiaVoiceSettings {
    this.cartesiaVoiceSettings = { ...this.cartesiaVoiceSettings, ...newSettings };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_cartesia_voice_settings', JSON.stringify(this.cartesiaVoiceSettings));
      } catch (_) {}
    }
    return { ...this.cartesiaVoiceSettings };
  }

  public getSpeechifySettings(): SpeechifyVoiceSettings {
    return { ...this.speechifyVoiceSettings };
  }

  public setSpeechifySettings(newSettings: Partial<SpeechifyVoiceSettings>): SpeechifyVoiceSettings {
    this.speechifyVoiceSettings = { ...this.speechifyVoiceSettings, ...newSettings };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_speechify_voice_settings', JSON.stringify(this.speechifyVoiceSettings));
      } catch (_) {}
    }
    return { ...this.speechifyVoiceSettings };
  }

  // --- ARENA MIXER & CROSS-DEVICE GOAL HORN CONTROLS ---

  public getMixerSettings(): MixerSettings {
    return { ...this.mixerSettings };
  }

  public setMixerSettings(partial: Partial<MixerSettings>): MixerSettings {
    const hasCustom = Boolean(this.storedGoalHorn?.hasCustomHorn && this.storedGoalHorn?.audioBase64);
    // If a custom horn exists, permanently lock selectedPreset to 'custom' unless explicitly commanded otherwise
    const selectedPreset = partial.selectedPreset ?? (hasCustom ? 'custom' : this.mixerSettings.selectedPreset);
    this.mixerSettings = { ...this.mixerSettings, ...partial, selectedPreset };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_mixer_settings_v1', JSON.stringify(this.mixerSettings));
      } catch (_) {}
      saveAudioToIdb('mixer_settings', this.mixerSettings).catch(() => {});
    }

    // Save ONLY mixer levels to Firestore cloud (never touches or deletes the custom audio file/chunks!)
    saveMixerSettingsToCloud(this.mixerSettings).catch(() => {});

    // Asynchronously notify server of mixer settings change (do NOT send large audio base64 on volume tweaks!)
    fetch('/api/goal-horn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mixerSettings: this.mixerSettings,
      }),
    }).catch(() => {});

    this.notifyHornChange();
    return { ...this.mixerSettings };
  }

  public getStoredGoalHorn(): StoredGoalHornData | null {
    return this.storedGoalHorn;
  }

  public subscribeToHornChange(listener: () => void): () => void {
    this.hornChangeListeners.push(listener);
    return () => {
      this.hornChangeListeners = this.hornChangeListeners.filter((l) => l !== listener);
    };
  }

  private notifyHornChange(): void {
    this.hornChangeListeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
  }

  public subscribeToMp3Playback(callback: (isPlaying: boolean) => void): () => void {
    this.mp3PlaybackListeners.push(callback);
    callback(this.isHornPlaying());
    return () => {
      this.mp3PlaybackListeners = this.mp3PlaybackListeners.filter((cb) => cb !== callback);
    };
  }

  public notifyMp3Playback(isPlaying: boolean): void {
    this.mp3PlaybackListeners.forEach((cb) => {
      try {
        cb(isPlaying);
      } catch (_) {}
    });
  }

  // Sync latest stored horn and mixer settings from the server across all devices
  public async syncServerGoalHorn(): Promise<StoredGoalHornData | null> {
    if (typeof window === 'undefined') return this.storedGoalHorn;
    try {
      const res = await fetch('/api/goal-horn');
      if (!res.ok) return this.storedGoalHorn;
      const data = await res.json();

      if (data && typeof data.updatedAt === 'number') {
        // Adopt custom horn from server if server sent actual valid audioBase64 or audio path!
        if (data.hasCustomHorn && data.audioBase64 && typeof data.audioBase64 === 'string' && data.audioBase64.length >= 10) {
          const isNewer = !this.storedGoalHorn || data.updatedAt > (this.storedGoalHorn.updatedAt || 0);
          if (isNewer || !this.storedGoalHorn?.hasCustomHorn) {
            this.storedGoalHorn = {
              hasCustomHorn: true,
              audioBase64: data.audioBase64,
              mimeType: data.mimeType || 'audio/mpeg',
              filename: data.filename || 'pelham_pelicans_goal_horn.mp3',
              fileSize: data.fileSize || 2161720,
              duration: data.duration || 90,
              updatedAt: data.updatedAt,
            };
            saveAudioToIdb('goal_horn', this.storedGoalHorn).catch(() => {});
            try {
              localStorage.setItem('pelham_stored_goal_horn_v1', JSON.stringify(this.storedGoalHorn));
            } catch (_) {}
            this.mixerSettings.selectedPreset = 'custom';
            this.notifyHornChange();
          }
        }

        if (data.mixerSettings) {
          const hasCustom = Boolean(this.storedGoalHorn?.hasCustomHorn && this.storedGoalHorn?.audioBase64);
          const preset = hasCustom
            ? 'custom'
            : data.mixerSettings.selectedPreset || this.mixerSettings.selectedPreset;

          this.mixerSettings = {
            ...this.mixerSettings,
            ...data.mixerSettings,
            selectedPreset: preset,
          };
          try {
            localStorage.setItem('pelham_mixer_settings_v1', JSON.stringify(this.mixerSettings));
          } catch (_) {}
          this.notifyHornChange();
        }
      }
      return this.storedGoalHorn;
    } catch (e) {
      console.warn('Sync server goal horn notice:', e);
      return this.storedGoalHorn;
    }
  }

  // Upload custom goal horn file (MP3, WAV, AAC, M4A, OGG) to app and sync across all devices via Firestore cloud
  public async uploadGoalHorn(
    file: File
  ): Promise<{ success: boolean; data?: StoredGoalHornData; error?: string }> {
    try {
      if (!file) throw new Error('No audio file selected.');
      if (file.size > 22 * 1024 * 1024) {
        throw new Error('Audio file exceeds 20MB limit. Please upload a shorter clip.');
      }

      this.unlock();

      // Read file as base64 Data URL
      const base64Url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read audio file'));
        reader.readAsDataURL(file);
      });

      // Measure audio duration
      let duration = 0;
      try {
        const probeAudio = new Audio();
        probeAudio.src = base64Url;
        await new Promise<void>((resolve) => {
          probeAudio.onloadedmetadata = () => {
            duration = probeAudio.duration || 0;
            resolve();
          };
          probeAudio.onerror = () => resolve();
          setTimeout(resolve, 2000);
        });
      } catch (_) {}

      const record: StoredGoalHornData = {
        hasCustomHorn: true,
        audioBase64: base64Url,
        mimeType: file.type || 'audio/mpeg',
        filename: file.name || 'custom_goal_horn.mp3',
        fileSize: file.size,
        duration: duration > 0 ? Math.round(duration * 10) / 10 : undefined,
        updatedAt: Date.now(),
      };

      // 1. Store in memory and IndexedDB (unlimited quota) for instant offline access on this device
      this.storedGoalHorn = record;
      this.mixerSettings.selectedPreset = 'custom';
      this.mixerSettings.hornEnabled = true;
      saveAudioToIdb('goal_horn', record).catch(() => {});
      try {
        localStorage.setItem('pelham_stored_goal_horn_v1', JSON.stringify(record));
        localStorage.setItem('pelham_mixer_settings_v1', JSON.stringify(this.mixerSettings));
      } catch (_) {}

      // 2. Persist to Firebase Firestore Cloud (auto-chunked for large MP3s)
      // This permanently syncs the MP3 across phone, laptop, and arena PC on Vercel!
      try {
        await saveGoalHornToCloud(record, this.mixerSettings);
      } catch (cloudErr) {
        console.warn('Could not save goal horn to Firebase cloud immediately:', cloudErr);
      }

      // 3. Fallback persist to server API
      try {
        await fetch('/api/goal-horn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Url,
            mimeType: file.type || 'audio/mpeg',
            filename: file.name || 'custom_goal_horn.mp3',
            fileSize: file.size,
            duration: record.duration,
            mixerSettings: this.mixerSettings,
          }),
        });
      } catch (postErr) {
        console.warn('Could not sync uploaded horn to server route immediately:', postErr);
      }

      this.notifyHornChange();
      return { success: true, data: record };
    } catch (err: any) {
      console.error('Goal horn upload failed:', err);
      return { success: false, error: err?.message || 'Failed to upload goal horn.' };
    }
  }

  // Remove custom uploaded horn and revert to authentic built-in Pelham Pelicans MP3 track
  public async removeCustomGoalHorn(): Promise<boolean> {
    this.stopHorn();
    this.storedGoalHorn = { ...DEFAULT_PELHAM_HORN, updatedAt: Date.now() };
    this.mixerSettings.selectedPreset = 'custom';
    deleteAudioFromIdb('goal_horn').catch(() => {});
    try {
      localStorage.setItem('pelham_stored_goal_horn_v1', JSON.stringify(this.storedGoalHorn));
      localStorage.setItem('pelham_mixer_settings_v1', JSON.stringify(this.mixerSettings));
    } catch (_) {}

    // Reset in cloud and server
    saveGoalHornToCloud(this.storedGoalHorn, this.mixerSettings).catch(() => {});

    try {
      await fetch('/api/goal-horn', { method: 'DELETE' });
    } catch (_) {}

    this.notifyHornChange();
    return true;
  }

  // Explicitly unlock both Web Audio and HTML5 Audio during a user gesture
  public unlock(): void {
    if (typeof window === 'undefined') return;

    try {
      // 1. Unlock Web Audio Context
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Play a micro silent buffer to clear mobile Safari/Chrome restrictions
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch (_) {}

      // 2. Pre-warm and unlock HTMLAudioElement for Vercel/mobile browsers
      if (!this.htmlAudio && typeof Audio !== 'undefined') {
        this.htmlAudio = new Audio();
      }

      if (this.htmlAudio && !this.htmlAudioUnlocked) {
        // 1-frame silent WAV data URL
        this.htmlAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        this.htmlAudio.volume = this.isMuted ? 0 : 1;
        const playPromise = this.htmlAudio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.htmlAudio?.pause();
              this.htmlAudioUnlocked = true;
            })
            .catch(() => {});
        }
      }

      this.isUnlocked = true;

      // 3. Resume SpeechSynthesis in case browser paused it
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  }

  public getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (!this.masterGain) {
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.audioCtx.currentTime);
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = muted ? 0 : 1;
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.volume = muted ? 0 : 1;
    }
    if (muted) {
      this.stopAll();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setPlaySfx(play: boolean) {
    this.playSfx = play;
  }

  public getPlaySfx(): boolean {
    return this.playSfx;
  }

  public stopAll() {
    this.stopHorn();
    this.stopVoiceOnly();
  }

  // Stops any ongoing voice announcement without interrupting the MP3/Goal Horn
  public stopVoiceOnly(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (_) {}
      this.currentSource = null;
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.currentTime = 0;
      this.currentAudioElement = null;
    }
    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isHornPlaying(): boolean {
    if (this.hornAudioElement && !this.hornAudioElement.paused && !this.hornAudioElement.ended) {
      return true;
    }
    return this.activeHornStopFns.length > 0;
  }

  public isMp3Playing(): boolean {
    return this.isHornPlaying();
  }

  public stopHorn(): void {
    if (this.hornAudioElement) {
      try {
        this.hornAudioElement.pause();
        this.hornAudioElement.currentTime = 0;
      } catch (_) {}
      this.hornAudioElement = null;
    }
    while (this.activeHornStopFns.length > 0) {
      const stopFn = this.activeHornStopFns.pop();
      try {
        stopFn?.();
      } catch (_) {}
    }
    this.notifyMp3Playback(false);
  }

  public duckActiveHorn(duckRatio = 0.28): void {
    if (this.hornAudioElement) {
      try {
        const baseVol = (this.mixerSettings.hornVolume ?? 0.95) * (this.mixerSettings.masterVolume ?? 1.0);
        this.hornAudioElement.volume = Math.max(0.05, baseVol * duckRatio);
      } catch (_) {}
    }
    if (this.hornGain && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const currentGain = this.hornGain.gain.value;
        this.hornGain.gain.setValueAtTime(currentGain, now);
        this.hornGain.gain.linearRampToValueAtTime(currentGain * duckRatio, now + 0.15);
      } catch (_) {}
    }
  }

  public unduckActiveHorn(): void {
    if (this.hornAudioElement) {
      try {
        const baseVol = (this.mixerSettings.hornVolume ?? 0.95) * (this.mixerSettings.masterVolume ?? 1.0);
        this.hornAudioElement.volume = Math.max(0.1, Math.min(1.0, baseVol));
      } catch (_) {}
    }
    if (this.hornGain && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const baseVol = (this.mixerSettings.hornVolume ?? 0.95) * (this.mixerSettings.masterVolume ?? 1.0);
        this.hornGain.gain.setValueAtTime(this.hornGain.gain.value, now);
        this.hornGain.gain.linearRampToValueAtTime(0.55 * baseVol, now + 0.25);
      } catch (_) {}
    }
  }


  // Synthesize realistic arena goal horns using Web Audio API
  public playSynthesizedHorn(
    preset: GoalHornPreset = 'pelham_blast',
    durationSec: number = 4.5,
    volume: number = 1.0,
    onEnded?: () => void
  ): () => void {
    if (this.isMuted) {
      onEnded?.();
      return () => {};
    }

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const effectiveVol = Math.max(0, Math.min(1, volume * (this.mixerSettings.hornVolume ?? 0.95) * (this.mixerSettings.masterVolume ?? 1.0)));

      // Horn Master Gain Node
      const hornGain = ctx.createGain();
      this.hornGain = hornGain;
      hornGain.connect(this.masterGain || ctx.destination);

      // Lowpass resonant filter for authentic heavy brass acoustics
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1150, now);
      filter.Q.setValueAtTime(2.8, now);
      filter.connect(hornGain);

      // Waveshaper for subtle air-valve saturation
      const waveShaper = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
      }
      waveShaper.curve = curve;
      waveShaper.connect(filter);

      const oscillators: OscillatorNode[] = [];

      // Frequencies for each horn character
      let freqs: number[] = [174.61, 220.00, 261.63, 87.31]; // Pelham Blast: F3, A3, C4 chord + F2 sub
      if (preset === 'nhl_foghorn') {
        freqs = [130.81, 196.00, 261.63, 65.41]; // NHL Deep Foghorn: C3, G3, C4 + C2 sub
      } else if (preset === 'arena_siren') {
        freqs = [185.00, 233.08, 277.18, 92.50]; // High tension brass
      }

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        // Sawtooth gives the rich brass overtones of compressed air horns
        osc.type = idx === freqs.length - 1 ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        // Small initial pitch chirp mimicking pneumatic valve release
        osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 0.03);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.08);

        // Slight detuning for rich chorus/beating effect
        const detuneCents = (idx - 1.5) * 5;
        osc.detune.setValueAtTime(detuneCents, now);

        osc.connect(waveShaper);
        osc.start(now);
        oscillators.push(osc);
      });

      // Optional siren oscillator if arena_siren preset is selected
      let sirenOsc: OscillatorNode | null = null;
      if (preset === 'arena_siren') {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sawtooth';
        sirenOsc.frequency.setValueAtTime(650, now);
        // Siren sweep up and down
        for (let t = 0; t < durationSec; t += 1.2) {
          sirenOsc.frequency.linearRampToValueAtTime(1050, now + t + 0.6);
          sirenOsc.frequency.linearRampToValueAtTime(650, now + t + 1.2);
        }
        const sirenGain = ctx.createGain();
        sirenGain.gain.setValueAtTime(0.25 * effectiveVol, now);
        sirenOsc.connect(sirenGain);
        sirenGain.connect(hornGain);
        sirenOsc.start(now);
        oscillators.push(sirenOsc);
      }

      // Attack & decay envelope
      hornGain.gain.setValueAtTime(0.001, now);
      hornGain.gain.linearRampToValueAtTime(0.55 * effectiveVol, now + 0.04);
      hornGain.gain.setValueAtTime(0.55 * effectiveVol, now + Math.max(0.1, durationSec - 0.4));
      hornGain.gain.linearRampToValueAtTime(0.001, now + durationSec);

      let stopped = false;
      const stopFn = () => {
        if (stopped) return;
        stopped = true;
        try {
          const stopTime = ctx.currentTime;
          hornGain.gain.cancelScheduledValues(stopTime);
          hornGain.gain.setValueAtTime(hornGain.gain.value, stopTime);
          hornGain.gain.linearRampToValueAtTime(0.001, stopTime + 0.08);
          setTimeout(() => {
            oscillators.forEach((osc) => {
              try {
                osc.stop();
                osc.disconnect();
              } catch (_) {}
            });
            hornGain.disconnect();
          }, 100);
        } catch (_) {}
      };

      this.activeHornStopFns.push(stopFn);

      const timer = setTimeout(() => {
        stopFn();
        onEnded?.();
      }, durationSec * 1000);

      return () => {
        clearTimeout(timer);
        stopFn();
      };
    } catch (err) {
      console.warn('Synthesized horn error:', err);
      onEnded?.();
      return () => {};
    }
  }

  // Play configured Goal Horn: Either uploaded custom audio file or synthesized preset
  public playGoalHorn(onEnded?: () => void): () => void {
    this.unlock();

    if (this.isMuted || !this.mixerSettings.hornEnabled) {
      onEnded?.();
      return () => {};
    }

    this.stopHorn();

    const preset = this.mixerSettings.selectedPreset;
    const durationLimit = typeof this.mixerSettings.hornDurationLimit === 'number'
      ? this.mixerSettings.hornDurationLimit
      : 0;
    const effectiveVol = Math.max(0, Math.min(1, (this.mixerSettings.hornVolume ?? 0.95) * (this.mixerSettings.masterVolume ?? 1.0)));

    // CASE 1: Authentic MP3 Goal Horn track (either user-uploaded MP3 or built-in Pelham Pelicans MP3)
    const audioSrc = (this.storedGoalHorn?.hasCustomHorn && this.storedGoalHorn?.audioBase64)
      ? this.storedGoalHorn.audioBase64
      : '/audio/pelham_pelicans_goal_horn.mp3';

    if ((preset === 'custom' || preset === 'pelham_blast') && audioSrc) {
      try {
        const audio = new Audio();
        this.hornAudioElement = audio;
        audio.src = audioSrc;
        audio.volume = effectiveVol;

        let finished = false;
        let timer: any = null;

        const cleanup = () => {
          if (finished) return;
          finished = true;
          if (timer) clearTimeout(timer);
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (_) {}
          if (this.hornAudioElement === audio) {
            this.hornAudioElement = null;
          }
          this.notifyMp3Playback(false);
          onEnded?.();
        };

        audio.onended = cleanup;
        audio.onerror = (err) => {
          console.warn('MP3 goal horn playback error, falling back:', err);
          cleanup();
          this.playSynthesizedHorn('pelham_blast', durationLimit > 0 ? durationLimit : 5.0, effectiveVol, onEnded);
        };

        // If durationLimit is 0 (Full track), NO TIMEOUT IS SET! The MP3 plays all the way through to the end!
        if (durationLimit > 0) {
          timer = setTimeout(() => {
            cleanup();
          }, durationLimit * 1000);
        }

        const playPromise = audio.play();
        this.notifyMp3Playback(true);

        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Goal horn MP3 play failed:', err);
            cleanup();
            this.playSynthesizedHorn('pelham_blast', durationLimit > 0 ? durationLimit : 5.0, effectiveVol, onEnded);
          });
        }

        const stopFn = () => {
          cleanup();
        };
        this.activeHornStopFns.push(stopFn);
        return stopFn;
      } catch (err) {
        console.warn('Goal horn audio init error:', err);
      }
    }

    // CASE 2: Specialized synthesized presets (e.g. NHL Foghorn or Arena Siren)
    const synthDuration = durationLimit > 0 ? durationLimit : 5.0;
    this.notifyMp3Playback(true);
    return this.playSynthesizedHorn(
      preset === 'custom' ? 'pelham_blast' : preset,
      synthDuration,
      effectiveVol,
      () => {
        this.notifyMp3Playback(false);
        onEnded?.();
      }
    );
  }

  // Dedicated MP3 trigger method: Starts MP3 (or stops if already playing)
  public playMp3(onEnded?: () => void): () => void {
    this.unlock();
    if (this.isHornPlaying()) {
      this.stopHorn();
      onEnded?.();
      return () => {};
    }
    return this.playGoalHorn(onEnded);
  }


  // Sequenced Playback: Triggers Goal Horn, followed by announcer voice-over
  public async playCelebrationSequence(options?: {
    text?: string;
    voiceStyle?: string;
    onStep?: (step: 'horn' | 'voice' | 'idle') => void;
  }): Promise<AnnounceResult> {
    const text = options?.text || "Goal Pelham Pelicans! The puck is in the net!";
    const onStep = options?.onStep;

    this.unlock();

    if (this.isMuted) {
      onStep?.('idle');
      return { source: 'speechify' };
    }

    // 1. Play Goal Horn if enabled in Mixer
    if (this.mixerSettings.hornEnabled) {
      onStep?.('horn');

      if (this.mixerSettings.voiceTriggerMode === 'after_horn') {
        // Wait for horn to finish its blast before starting voice-over
        await new Promise<void>((resolve) => {
          this.playGoalHorn(() => resolve());
        });
      } else {
        // Delay mode: start horn, wait configured seconds, duck horn, then start voice
        this.playGoalHorn();
        const delaySec = Math.max(0.5, this.mixerSettings.voiceDelaySeconds || 2.5);
        await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
        if (this.mixerSettings.duckHornOnVoice) {
          this.duckActiveHorn();
        }
      }
    }

    // 2. Play Voice-over announcement
    onStep?.('voice');
    try {
      const res = await this.announce(text, options?.voiceStyle || 'nhl');
      onStep?.('idle');
      return res;
    } catch (err: any) {
      onStep?.('idle');
      return { source: 'webspeech', error: err?.message };
    }
  }

  public playWhistle(): void {
    if (this.isMuted || !this.playSfx) return;
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      // High-pitched authentic referee whistle sound
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2850, now);
      osc1.frequency.linearRampToValueAtTime(3200, now + 0.04);
      osc1.frequency.linearRampToValueAtTime(2950, now + 0.3);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2650, now);
      osc2.frequency.linearRampToValueAtTime(2950, now + 0.04);
      osc2.frequency.linearRampToValueAtTime(2750, now + 0.3);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
      gain.gain.setValueAtTime(0.25, now + 0.25);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch {
      // AudioContext may not be ready or allowed
    }
  }

  // Play audio from base64 string using HTML5 Audio or Web Audio for pitch tuning
  private async playBase64Audio(
    base64: string,
    pitchCents = this.ttsProvider === 'cartesia'
      ? this.cartesiaVoiceSettings.pitchCents
      : this.ttsProvider === 'speechify'
      ? this.speechifyVoiceSettings.pitchCents
      : this.voiceSettings.pitchCents,
    mimeType = 'audio/mpeg'
  ): Promise<boolean> {
    // If pitch shifting is requested, Web Audio API provides hardware-accelerated detune
    if (typeof pitchCents === 'number' && pitchCents !== 0) {
      try {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return await this.playWebAudio(bytes.buffer, pitchCents);
      } catch (err) {
        console.warn('Web Audio pitch shift failed, falling back to standard audio:', err);
      }
    }

    const dataUrl = `data:${mimeType};base64,${base64}`;

    // METHOD A: Pre-unlocked HTMLAudioElement
    try {
      const audio = this.htmlAudio || new Audio();
      this.htmlAudio = audio;
      this.currentAudioElement = audio;
      audio.src = dataUrl;
      audio.volume = this.isMuted ? 0 : 1;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(); // Protect against hanging promises
        }, 15000);

        audio.onended = () => {
          clearTimeout(timeout);
          this.currentAudioElement = null;
          resolve();
        };
        audio.onerror = (e) => {
          clearTimeout(timeout);
          this.currentAudioElement = null;
          reject(e);
        };
        audio.play().catch((err) => {
          clearTimeout(timeout);
          this.currentAudioElement = null;
          reject(err);
        });
      });

      return true;
    } catch (htmlErr) {
      console.warn('HTML5 Audio playback failed, falling back to Web Audio decode:', htmlErr);
    }

    // METHOD B: Web Audio fallback
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return await this.playWebAudio(bytes.buffer, pitchCents);
    } catch (webAudioErr) {
      console.warn('Web Audio playback also failed:', webAudioErr);
      return false;
    }
  }

  // Play audio from binary ArrayBuffer
  private async playArrayBuffer(
    arrayBuffer: ArrayBuffer,
    pitchCents = this.ttsProvider === 'cartesia'
      ? this.cartesiaVoiceSettings.pitchCents
      : this.ttsProvider === 'speechify'
      ? this.speechifyVoiceSettings.pitchCents
      : this.voiceSettings.pitchCents,
    mimeType = 'audio/mpeg'
  ): Promise<boolean> {
    if (typeof pitchCents === 'number' && pitchCents !== 0) {
      return await this.playWebAudio(arrayBuffer, pitchCents);
    }

    // METHOD A: Blob Object URL with HTMLAudioElement
    try {
      const blob = new Blob([arrayBuffer], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);
      const audio = this.htmlAudio || new Audio();
      this.htmlAudio = audio;
      this.currentAudioElement = audio;
      audio.src = audioUrl;
      audio.volume = this.isMuted ? 0 : 1;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudioElement = null;
          resolve();
        }, 15000);

        audio.onended = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(audioUrl);
          this.currentAudioElement = null;
          resolve();
        };
        audio.onerror = (e) => {
          clearTimeout(timeout);
          URL.revokeObjectURL(audioUrl);
          this.currentAudioElement = null;
          reject(e);
        };
        audio.play().catch((err) => {
          clearTimeout(timeout);
          URL.revokeObjectURL(audioUrl);
          this.currentAudioElement = null;
          reject(err);
        });
      });

      return true;
    } catch (blobErr) {
      console.warn('Blob audio play failed, trying Web Audio decode:', blobErr);
    }

    // METHOD B: Web Audio API
    return await this.playWebAudio(arrayBuffer, pitchCents);
  }

  // Web Audio buffer source playback with pitch detune support
  private async playWebAudio(arrayBuffer: ArrayBuffer, pitchCents = this.voiceSettings.pitchCents): Promise<boolean> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // decodeAudioData needs a slice copy in certain browsers
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Apply pitch detune if set (cents: 100 cents = 1 semitone)
      if (source.detune && typeof pitchCents === 'number' && pitchCents !== 0) {
        try {
          source.detune.setValueAtTime(pitchCents, ctx.currentTime);
        } catch (_) {}
      }

      source.connect(this.masterGain || ctx.destination);
      this.currentSource = source;

      await new Promise<void>((resolve) => {
        const maxMs = (audioBuffer.duration * 1000) + 1500;
        const timeout = setTimeout(() => {
          this.currentSource = null;
          resolve();
        }, maxMs);

        source.onended = () => {
          clearTimeout(timeout);
          this.currentSource = null;
          resolve();
        };
        source.start(0);
      });

      return true;
    } catch (err) {
      console.warn('Web Audio decode failed:', err);
      return false;
    }
  }

  // Announce text using Speechify (Simba 3.2) TTS engine with WebSpeech fallback
  // Announce text using Speechify (Simba 3.2) TTS engine with WebSpeech fallback
  // Plays voice-over over the ongoing MP3 without stopping the MP3!
  public async announce(
    text: string,
    overrideVoiceId?: string,
    overrideSettings?: Partial<SpeechifyVoiceSettings>
  ): Promise<AnnounceResult> {
    if (this.isMuted) {
      return { source: 'webspeech' };
    }

    this.unlock();
    // Stop any previous voice without stopping the Goal Horn / MP3!
    this.stopVoiceOnly();

    const wasHornActive = this.isHornPlaying();
    if (wasHornActive && this.mixerSettings.duckHornOnVoice) {
      this.duckActiveHorn(0.25);
    }

    // SPEECHIFY TTS ENGINE (SOLE ACTIVE PROVIDER)
    const sSettings: SpeechifyVoiceSettings = {
      ...this.speechifyVoiceSettings,
      ...((overrideSettings as Partial<SpeechifyVoiceSettings>) || {})
    };
    const effectiveSpeechifyVoice = overrideVoiceId && overrideVoiceId !== 'nhl'
      ? overrideVoiceId
      : sSettings.voiceId;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, audio/mpeg, audio/wav, */*'
        },
        body: JSON.stringify({
          text,
          provider: 'speechify',
          voiceId: effectiveSpeechifyVoice,
          clientInfo: getClientDeviceInfo(),
          speechifySettings: {
            voiceId: effectiveSpeechifyVoice,
            model: sSettings.model,
            speed: sSettings.speed,
            pitchCents: sSettings.pitchCents,
          },
          format: 'base64'
        })
      });

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();

        if (data.success && data.audioBase64) {
          const played = await this.playBase64Audio(data.audioBase64, sSettings.pitchCents, data.mimeType || 'audio/mpeg');
          if (played) {
            return { source: 'speechify', voiceId: data.voiceId };
          }
        }

        const errorMsg = data.error || (data.fallback ? 'Fallback active' : 'Speechify synthesis failed');
        console.warn('Speechify TTS server fallback active:', errorMsg, data);
        await this.speakWebSpeech(text);
        return { source: 'webspeech', voiceId: data.voiceId, error: errorMsg };
      }

      if (contentType.includes('audio/')) {
        const arrayBuffer = await response.arrayBuffer();
        const headerVoice = response.headers.get('x-speechify-voice') || effectiveSpeechifyVoice;
        const mime = contentType.includes('wav') ? 'audio/wav' : 'audio/mpeg';

        const played = await this.playArrayBuffer(arrayBuffer, sSettings.pitchCents, mime);
        if (played) {
          return { source: 'speechify', voiceId: headerVoice };
        }
      }

      await this.speakWebSpeech(text);
      return { source: 'webspeech', error: 'Unexpected voice response format' };
    } catch (err: any) {
      console.warn('Speechify API request failed, falling back to Web Speech API:', err);
      await this.speakWebSpeech(text);
      return { source: 'webspeech', error: err?.message || 'Network error during Speechify voice playback' };
    } finally {
      if (wasHornActive && this.isHornPlaying()) {
        this.unduckActiveHorn();
      }
    }
  }

  // Web Speech API with rate and pitch controls matching active provider settings
  private speakWebSpeech(text: string): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || this.isMuted) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const activeSpeed = this.ttsProvider === 'cartesia'
          ? this.cartesiaVoiceSettings.speed
          : this.ttsProvider === 'speechify'
          ? this.speechifyVoiceSettings.speed
          : this.voiceSettings.speed;
        const activePitch = this.ttsProvider === 'cartesia'
          ? this.cartesiaVoiceSettings.pitchCents
          : this.ttsProvider === 'speechify'
          ? this.speechifyVoiceSettings.pitchCents
          : this.voiceSettings.pitchCents;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.max(0.7, Math.min(1.4, activeSpeed));

        // Map cents (-500 to +500) to pitch offset (0.5 to 1.8)
        const pitchOffset = activePitch / 1000;
        utterance.pitch = Math.max(0.5, Math.min(1.8, 1.1 + pitchOffset));

        // Fix for Chromium garbage-collection bug where synthesis stops early
        (window as any).__lastUtterance = utterance;

        const timeout = setTimeout(() => {
          (window as any).__lastUtterance = null;
          resolve();
        }, 12000);

        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const preferredVoice = voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Samantha'))
          ) || voices.find((v) => v.lang.startsWith('en'));

          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
        }

        utterance.onend = () => {
          clearTimeout(timeout);
          (window as any).__lastUtterance = null;
          resolve();
        };

        utterance.onerror = (e) => {
          console.warn('Web Speech error:', e);
          clearTimeout(timeout);
          (window as any).__lastUtterance = null;
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Web Speech invocation failed:', err);
        resolve();
      }
    });
  }
}

export const soundEngine = new SoundEngine();

function isGenericPlayerName(name?: string | null, playerNum?: number | null): boolean {
  if (!name) return true;
  const clean = name.trim().toLowerCase();
  if (!clean) return true;
  if (
    clean === `player #${playerNum}` ||
    clean === `player ${playerNum}` ||
    clean === `player number ${playerNum}` ||
    clean === `#${playerNum}` ||
    clean === 'player' ||
    clean === 'unlisted' ||
    clean === 'unlisted player' ||
    /^player\s*number\s*\d+$/i.test(clean) ||
    /^visitor\s*player\s*\d+$/i.test(clean) ||
    /^player\s*#?\d+$/i.test(clean)
  ) {
    return true;
  }
  return false;
}

export function generateGoalPrompt(playerNumber: number, playerName: string, teamName: string = 'Pelham Pelicans'): string {
  const safeTeam = teamName?.trim() || 'Pelham Pelicans';
  if (isGenericPlayerName(playerName, playerNumber)) {
    return `${safeTeam} goal! Scored by number ${playerNumber}!`;
  }
  return `${safeTeam} goal! Scored by number ${playerNumber}, ${playerName}!`;
}

export function generateAssistPrompt(playerNumber: number, playerName: string): string {
  if (isGenericPlayerName(playerName, playerNumber)) {
    return `Assisted by number ${playerNumber}!`;
  }
  return `Assisted by number ${playerNumber}, ${playerName}!`;
}

export function generateGoalWithAssistPrompt(
  scorerNumber: number,
  scorerName: string,
  primaryAssistNumber?: number | null,
  primaryAssistName?: string | null,
  secondaryAssistNumber?: number | null,
  secondaryAssistName?: string | null,
  teamName: string = 'Pelham Pelicans'
): string {
  const safeTeam = teamName?.trim() || 'Pelham Pelicans';
  const scorerPart = isGenericPlayerName(scorerName, scorerNumber)
    ? `Scored by number ${scorerNumber}!`
    : `Scored by number ${scorerNumber}, ${scorerName}!`;

  const hasPrimary =
    primaryAssistNumber !== undefined &&
    primaryAssistNumber !== null &&
    !isNaN(primaryAssistNumber);

  const hasSecondary =
    secondaryAssistNumber !== undefined &&
    secondaryAssistNumber !== null &&
    !isNaN(secondaryAssistNumber);

  const formatAssist = (num: number, name?: string | null) => {
    if (isGenericPlayerName(name, num)) {
      return `number ${num}`;
    }
    return `number ${num}, ${name}`;
  };

  if (hasPrimary && hasSecondary) {
    return `${safeTeam} goal! ${scorerPart} Assisted by ${formatAssist(primaryAssistNumber!, primaryAssistName)}, and ${formatAssist(secondaryAssistNumber!, secondaryAssistName)}!`;
  }
  if (hasPrimary) {
    return `${safeTeam} goal! ${scorerPart} Assisted by ${formatAssist(primaryAssistNumber!, primaryAssistName)}!`;
  }
  if (hasSecondary) {
    return `${safeTeam} goal! ${scorerPart} Assisted by ${formatAssist(secondaryAssistNumber!, secondaryAssistName)}!`;
  }
  return `${safeTeam} goal! ${scorerPart} Unassisted!`;
}

export function generatePenaltyPrompt(
  playerNumber: number,
  teamName: string,
  durationText: string = 'two minutes',
  infraction: string = 'hooking',
  playerName?: string,
  includePlayerName: boolean = false,
  penaltyClockTime?: string
): string {
  const safeTeam = teamName?.trim() || 'Pelham Pelicans';
  const cleanDuration = durationText?.trim();
  const cleanInfraction = infraction?.trim().toLowerCase() || 'hooking';
  const cleanClock = penaltyClockTime?.trim();

  // Determine if a duration should be spoken
  const hasTime = Boolean(
    cleanDuration &&
      cleanDuration.toLowerCase() !== 'none' &&
      cleanDuration.toLowerCase() !== 'no time' &&
      cleanDuration.toLowerCase() !== 'without time' &&
      cleanDuration.toLowerCase() !== 'off' &&
      cleanDuration !== ''
  );

  const timePart = hasTime ? ` ${cleanDuration}` : '';
  const clockPart = cleanClock ? ` Time of the penalty, ${cleanClock}.` : '';

  if (includePlayerName && playerName && !isGenericPlayerName(playerName, playerNumber)) {
    return `Number ${playerNumber}, ${playerName.trim()}, ${safeTeam}${timePart} for ${cleanInfraction}.${clockPart}`;
  }

  // With time: 'Number 12, Pelham Pelicans two minutes for [foul].'
  // Without time: 'Number 12, Pelham Pelicans for [foul].'
  return `Number ${playerNumber}, ${safeTeam}${timePart} for ${cleanInfraction}.${clockPart}`;
}

export function generateWelcomePrompt(opponentTeam: string = 'visiting team'): string {
  const cleanTeam = opponentTeam?.trim() || 'visiting team';
  // If cleanTeam is generic ('visiting team', 'visitor team', 'opponent team', etc.), ensure natural phrasing "the visiting team"
  const isGenericVisitor = /^(the\s+)?(visiting\s+team|visitor\s+team|opponent\s+team)$/i.test(cleanTeam);
  const teamPhrase = isGenericVisitor ? 'the visiting team' : cleanTeam;
  return `Welcome, everyone, and thank you for joining us for today’s hockey game. The Pelham Pelicans are excited to host ${teamPhrase} and look forward to a competitive, respectful, and fun matchup. Enjoy the game, and best of luck to both teams. At this time, I’d like to ask both teams to please line up for our national anthem.`;
}

export function generatePeriodRemainingPrompt(period: 'first' | 'second' | 'third' | 'overtime' | string): string {
  const clean = period?.trim().toLowerCase();
  if (clean === 'first' || clean === '1' || clean === '1st') {
    return 'One minute remaining in the first period.';
  }
  if (clean === 'second' || clean === '2' || clean === '2nd') {
    return 'One minute remaining in the second period.';
  }
  if (clean === 'third' || clean === '3' || clean === '3rd') {
    return 'One minute remaining in the third period.';
  }
  if (clean === 'overtime' || clean === 'ot') {
    return 'One minute remaining in overtime.';
  }
  return `One minute remaining in the ${clean} period.`;
}




