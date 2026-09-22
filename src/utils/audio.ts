// Professional Web Audio Arena sound engine, ElevenLabs, Cartesia & Google TTS player
import {
  ElevenLabsVoiceSettings,
  CartesiaVoiceSettings,
  GoogleVoiceSettings,
  WebSpeechVoiceSettings,
  TTSProvider,
  AccountChoice,
  CreditsStatus,
  AutoSwitchEvent,
} from '../types';

export const CREDIT_SWITCH_THRESHOLD = 400;

export interface AnnounceResult {
  source: 'elevenlabs' | 'cartesia' | 'google' | 'webspeech';
  voiceId?: string;
  error?: string;
  autoSwitched?: boolean;
}

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
  voiceId: '694f9389-aac1-45b6-b726-9d9369183238', // Barbershop Man / Announcer
  modelId: 'sonic-3.5',
  speed: 1.05,
  pitchCents: 0,
  emotion: 'excited'
};

export const DEFAULT_GOOGLE_VOICE_SETTINGS: GoogleVoiceSettings = {
  voiceId: 'Puck', // Google's natural upbeat sport commentator (Gemini Natural AI)
  speed: 1.05,
  pitchCents: 0,
  commentatorStyle: 'play-by-play',
};

export const DEFAULT_WEBSPEECH_SETTINGS: WebSpeechVoiceSettings = {
  voiceURI: '',
  speed: 1.05,
  pitch: 1.0,
};

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
  private ttsProvider: TTSProvider = 'elevenlabs';
  private activeCartesiaAccount: AccountChoice = 'account1';
  private voiceSettings: ElevenLabsVoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
  private cartesiaVoiceSettings: CartesiaVoiceSettings = { ...DEFAULT_CARTESIA_VOICE_SETTINGS };
  private googleVoiceSettings: GoogleVoiceSettings = { ...DEFAULT_GOOGLE_VOICE_SETTINGS };
  private webSpeechSettings: WebSpeechVoiceSettings = { ...DEFAULT_WEBSPEECH_SETTINGS };
  private creditsStatus: CreditsStatus | null = null;
  private isAutoSwitchEnabled: boolean = true;
  private autoSwitchListeners: Set<(event: AutoSwitchEvent) => void> = new Set();
  private creditsListeners: Set<(status: CreditsStatus) => void> = new Set();

  constructor() {
    // Restore persistent voice settings from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const savedProvider = localStorage.getItem('pelham_tts_provider');
        if (savedProvider === 'elevenlabs' || savedProvider === 'cartesia' || savedProvider === 'google' || savedProvider === 'webspeech') {
          this.ttsProvider = savedProvider as TTSProvider;
        }

        const savedCartesiaAccount = localStorage.getItem('pelham_active_cartesia_account');
        if (savedCartesiaAccount === 'account1' || savedCartesiaAccount === 'account2') {
          this.activeCartesiaAccount = savedCartesiaAccount;
        }

        const savedAutoSwitch = localStorage.getItem('pelham_credits_auto_switch');
        if (savedAutoSwitch !== null) {
          this.isAutoSwitchEnabled = savedAutoSwitch === 'true';
        }

        const saved = localStorage.getItem('pelham_voice_settings');
        if (saved) {
          this.voiceSettings = { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
        }

        const savedCartesia = localStorage.getItem('pelham_cartesia_voice_settings');
        if (savedCartesia) {
          this.cartesiaVoiceSettings = { ...DEFAULT_CARTESIA_VOICE_SETTINGS, ...JSON.parse(savedCartesia) };
        }

        const savedGoogle = localStorage.getItem('pelham_google_voice_settings');
        if (savedGoogle) {
          this.googleVoiceSettings = { ...DEFAULT_GOOGLE_VOICE_SETTINGS, ...JSON.parse(savedGoogle) };
        }

        const savedWebSpeech = localStorage.getItem('pelham_webspeech_settings');
        if (savedWebSpeech) {
          this.webSpeechSettings = { ...DEFAULT_WEBSPEECH_SETTINGS, ...JSON.parse(savedWebSpeech) };
        }
      } catch (_) {}

      // Initial credit fetch in background
      setTimeout(() => {
        this.fetchCredits().catch(() => {});
      }, 500);

      // Auto-unlock on first user interaction anywhere in the window
      const unlockEvents = ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'];
      const onUserInteraction = () => {
        this.unlock();
        unlockEvents.forEach((ev) => window.removeEventListener(ev, onUserInteraction));
      };
      unlockEvents.forEach((ev) => window.addEventListener(ev, onUserInteraction, { passive: true }));
    }
  }

  public getTTSProvider(): TTSProvider {
    return this.ttsProvider;
  }

  public setTTSProvider(provider: TTSProvider): TTSProvider {
    this.ttsProvider = provider;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_tts_provider', provider);
      } catch (_) {}
    }
    return this.ttsProvider;
  }

  public getCartesiaAccount(): AccountChoice {
    return this.activeCartesiaAccount;
  }

  public setCartesiaAccount(account: AccountChoice): AccountChoice {
    this.activeCartesiaAccount = account;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_active_cartesia_account', account);
      } catch (_) {}
    }
    return this.activeCartesiaAccount;
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

  public getGoogleVoiceSettings(): GoogleVoiceSettings {
    return { ...this.googleVoiceSettings };
  }

  public setGoogleVoiceSettings(newSettings: Partial<GoogleVoiceSettings>): GoogleVoiceSettings {
    this.googleVoiceSettings = { ...this.googleVoiceSettings, ...newSettings };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_google_voice_settings', JSON.stringify(this.googleVoiceSettings));
      } catch (_) {}
    }
    return { ...this.googleVoiceSettings };
  }

  public resetGoogleVoiceSettings(): GoogleVoiceSettings {
    this.googleVoiceSettings = { ...DEFAULT_GOOGLE_VOICE_SETTINGS };
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('pelham_google_voice_settings');
      } catch (_) {}
    }
    return { ...this.googleVoiceSettings };
  }

  public getWebSpeechSettings(): WebSpeechVoiceSettings {
    return { ...this.webSpeechSettings };
  }

  public setWebSpeechSettings(newSettings: Partial<WebSpeechVoiceSettings>): WebSpeechVoiceSettings {
    this.webSpeechSettings = { ...this.webSpeechSettings, ...newSettings };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_webspeech_settings', JSON.stringify(this.webSpeechSettings));
      } catch (_) {}
    }
    return { ...this.webSpeechSettings };
  }

  public resetWebSpeechSettings(): WebSpeechVoiceSettings {
    this.webSpeechSettings = { ...DEFAULT_WEBSPEECH_SETTINGS };
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('pelham_webspeech_settings');
      } catch (_) {}
    }
    return { ...this.webSpeechSettings };
  }

  public getAvailableWebSpeechVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  public getAutoSwitchEnabled(): boolean {
    return this.isAutoSwitchEnabled;
  }

  public setAutoSwitchEnabled(enabled: boolean): boolean {
    this.isAutoSwitchEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pelham_credits_auto_switch', String(enabled));
      } catch (_) {}
    }
    if (enabled && this.creditsStatus) {
      this.checkAndPerformAutoSwitch('Auto-switch option toggled on');
    }
    return this.isAutoSwitchEnabled;
  }

  public getCreditsStatus(): CreditsStatus | null {
    return this.creditsStatus;
  }

  public onAutoSwitch(listener: (event: AutoSwitchEvent) => void): () => void {
    this.autoSwitchListeners.add(listener);
    return () => {
      this.autoSwitchListeners.delete(listener);
    };
  }

  public onCreditsUpdate(listener: (status: CreditsStatus) => void): () => void {
    this.creditsListeners.add(listener);
    if (this.creditsStatus) {
      try {
        listener(this.creditsStatus);
      } catch (_) {}
    }
    return () => {
      this.creditsListeners.delete(listener);
    };
  }

  private notifyAutoSwitch(event: AutoSwitchEvent): void {
    if (this.creditsStatus) {
      this.creditsStatus.lastAutoSwitch = {
        timestamp: event.timestamp,
        from: `${event.fromProvider}${event.fromAccount ? ` (${event.fromAccount})` : ''}`,
        to: `${event.toProvider}${event.toAccount ? ` (${event.toAccount})` : ''}`,
        reason: event.reason,
      };
    }
    this.autoSwitchListeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.warn('AutoSwitch listener error:', err);
      }
    });
  }

  public async fetchCredits(): Promise<CreditsStatus | null> {
    try {
      const res = await fetch('/api/credits');
      if (!res.ok) return null;
      const data = await res.json();

      const updatedStatus: CreditsStatus = {
        threshold: data.threshold || CREDIT_SWITCH_THRESHOLD,
        currentMonth: data.currentMonth || new Date().toISOString().slice(0, 7),
        elevenlabs: data.elevenlabs || {
          configured: false,
          characterLimit: 0,
          characterCount: 0,
          remainingCredits: 0,
          isLowCredits: true,
          source: 'none',
        },
        cartesiaAccount1: data.cartesiaAccount1 || {
          configured: false,
          characterLimit: 20000,
          characterCount: 0,
          remainingCredits: 0,
          isLowCredits: true,
          source: 'none',
        },
        cartesiaAccount2: data.cartesiaAccount2 || {
          configured: false,
          characterLimit: 20000,
          characterCount: 0,
          remainingCredits: 0,
          isLowCredits: true,
          source: 'none',
        },
        activeProvider: this.ttsProvider,
        activeCartesiaAccount: this.activeCartesiaAccount,
        lastChecked: Date.now(),
        lastAutoSwitch: this.creditsStatus?.lastAutoSwitch || null,
      };

      this.creditsStatus = updatedStatus;

      // Broadcast to listeners
      this.creditsListeners.forEach((fn) => {
        try {
          fn(updatedStatus);
        } catch (_) {}
      });

      // Check auto-switch whenever credits are updated
      if (this.isAutoSwitchEnabled) {
        this.checkAndPerformAutoSwitch('Updated credit balance check');
      }

      return updatedStatus;
    } catch (err) {
      console.warn('Failed to fetch credits:', err);
      return null;
    }
  }

  public async setManualAccountBalance(
    account: 'elevenlabs' | 'cartesia1' | 'cartesia2',
    remainingCredits: number,
    limit?: number
  ): Promise<void> {
    try {
      await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_balance',
          account,
          remainingCredits: Math.max(0, remainingCredits),
          limit,
        }),
      });
      await this.fetchCredits();
    } catch (err) {
      console.warn('Failed to set manual account balance:', err);
    }
  }

  public async setManualCartesiaBalance(
    account: 'cartesia1' | 'cartesia2',
    remainingCredits: number
  ): Promise<void> {
    return this.setManualAccountBalance(account, remainingCredits);
  }

  public async syncAllActualBalances(
    elevenlabs = 130000,
    cartesia1 = 120000,
    cartesia2 = 19000
  ): Promise<void> {
    try {
      await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_all_balances',
          balances: {
            elevenlabs,
            cartesia1,
            cartesia2,
          },
        }),
      });
      await this.fetchCredits();
    } catch (err) {
      console.warn('Failed to sync all balances:', err);
    }
  }

  // Core auto-switching engine: If active account has <= 400 credits or quota reached, switch to next account
  public checkAndPerformAutoSwitch(triggerReason?: string): AutoSwitchEvent | null {
    if (!this.isAutoSwitchEnabled) return null;

    const threshold = CREDIT_SWITCH_THRESHOLD; // 400
    const el = this.creditsStatus?.elevenlabs || { configured: true, remainingCredits: 100000 };
    const c1 = this.creditsStatus?.cartesiaAccount1 || { configured: true, remainingCredits: 100000 };
    const c2 = this.creditsStatus?.cartesiaAccount2 || { configured: true, remainingCredits: 100000 };

    const currentProvider = this.ttsProvider;
    const currentCartesiaAccount = this.activeCartesiaAccount;

    // WebSpeech is client-side native and has unlimited credits
    if (currentProvider === 'webspeech') {
      return null;
    }

    // SCENARIO 1: Current provider is Cartesia
    if (currentProvider === 'cartesia') {
      if (currentCartesiaAccount === 'account1') {
        const remaining = c1.remainingCredits;
        if (c1.configured && remaining <= threshold) {
          // Switch to Cartesia Account 2 if it has > 400 credits
          if (c2.configured && c2.remainingCredits > threshold) {
            this.setCartesiaAccount('account2');
            const event: AutoSwitchEvent = {
              timestamp: Date.now(),
              fromProvider: 'cartesia',
              fromAccount: 'account1',
              toProvider: 'cartesia',
              toAccount: 'account2',
              reason: triggerReason || `Cartesia Account 1 reached ${remaining.toLocaleString()} credits (≤ 400 limit)`,
              remainingCredits: remaining,
            };
            this.notifyAutoSwitch(event);
            return event;
          }
          // Else if ElevenLabs has > 400 credits, switch to ElevenLabs
          if (el.configured && el.remainingCredits > threshold) {
            this.setTTSProvider('elevenlabs');
            const event: AutoSwitchEvent = {
              timestamp: Date.now(),
              fromProvider: 'cartesia',
              fromAccount: 'account1',
              toProvider: 'elevenlabs',
              reason: triggerReason || `Cartesia Account 1 at ${remaining.toLocaleString()} credits (≤ 400 limit); switched to ElevenLabs`,
              remainingCredits: remaining,
            };
            this.notifyAutoSwitch(event);
            return event;
          }
        }
      } else if (currentCartesiaAccount === 'account2') {
        const remaining = c2.remainingCredits;
        if (c2.configured && remaining <= threshold) {
          // Switch to Cartesia Account 1 if it has > 400 credits
          if (c1.configured && c1.remainingCredits > threshold) {
            this.setCartesiaAccount('account1');
            const event: AutoSwitchEvent = {
              timestamp: Date.now(),
              fromProvider: 'cartesia',
              fromAccount: 'account2',
              toProvider: 'cartesia',
              toAccount: 'account1',
              reason: triggerReason || `Cartesia Account 2 reached ${remaining.toLocaleString()} credits (≤ 400 limit)`,
              remainingCredits: remaining,
            };
            this.notifyAutoSwitch(event);
            return event;
          }
          // Else if ElevenLabs has > 400 credits, switch to ElevenLabs
          if (el.configured && el.remainingCredits > threshold) {
            this.setTTSProvider('elevenlabs');
            const event: AutoSwitchEvent = {
              timestamp: Date.now(),
              fromProvider: 'cartesia',
              fromAccount: 'account2',
              toProvider: 'elevenlabs',
              reason: triggerReason || `Cartesia Account 2 at ${remaining.toLocaleString()} credits (≤ 400 limit); switched to ElevenLabs`,
              remainingCredits: remaining,
            };
            this.notifyAutoSwitch(event);
            return event;
          }
        }
      }
    }

    // SCENARIO 2: Current provider is ElevenLabs
    if (currentProvider === 'elevenlabs') {
      const remaining = el.remainingCredits;
      if (el.configured && remaining <= threshold) {
        // Switch to Cartesia: check Account 1 first, then Account 2
        if (c1.configured && c1.remainingCredits > threshold) {
          this.setTTSProvider('cartesia');
          this.setCartesiaAccount('account1');
          const event: AutoSwitchEvent = {
            timestamp: Date.now(),
            fromProvider: 'elevenlabs',
            toProvider: 'cartesia',
            toAccount: 'account1',
            reason: triggerReason || `ElevenLabs reached ${remaining.toLocaleString()} credits (≤ 400 limit); switched to Cartesia Account 1`,
            remainingCredits: remaining,
          };
          this.notifyAutoSwitch(event);
          return event;
        } else if (c2.configured && c2.remainingCredits > threshold) {
          this.setTTSProvider('cartesia');
          this.setCartesiaAccount('account2');
          const event: AutoSwitchEvent = {
            timestamp: Date.now(),
            fromProvider: 'elevenlabs',
            toProvider: 'cartesia',
            toAccount: 'account2',
            reason: triggerReason || `ElevenLabs reached ${remaining.toLocaleString()} credits (≤ 400 limit); switched to Cartesia Account 2`,
            remainingCredits: remaining,
          };
          this.notifyAutoSwitch(event);
          return event;
        }
      }
    }

    // SCENARIO 3: Current provider is Google (Gemini Natural Sport Commentator)
    if (currentProvider === 'google') {
      // Check if Cartesia Account 1 has credits
      if (c1.configured && c1.remainingCredits > threshold) {
        this.setTTSProvider('cartesia');
        this.setCartesiaAccount('account1');
        const event: AutoSwitchEvent = {
          timestamp: Date.now(),
          fromProvider: 'google',
          toProvider: 'cartesia',
          toAccount: 'account1',
          reason: triggerReason || 'Google Gemini TTS quota reached (429); switched to Cartesia Account 1',
          remainingCredits: c1.remainingCredits,
        };
        this.notifyAutoSwitch(event);
        return event;
      }
      // Check if Cartesia Account 2 has credits
      if (c2.configured && c2.remainingCredits > threshold) {
        this.setTTSProvider('cartesia');
        this.setCartesiaAccount('account2');
        const event: AutoSwitchEvent = {
          timestamp: Date.now(),
          fromProvider: 'google',
          toProvider: 'cartesia',
          toAccount: 'account2',
          reason: triggerReason || 'Google Gemini TTS quota reached (429); switched to Cartesia Account 2',
          remainingCredits: c2.remainingCredits,
        };
        this.notifyAutoSwitch(event);
        return event;
      }
      // Check if ElevenLabs has credits
      if (el.configured && el.remainingCredits > threshold) {
        this.setTTSProvider('elevenlabs');
        const event: AutoSwitchEvent = {
          timestamp: Date.now(),
          fromProvider: 'google',
          toProvider: 'elevenlabs',
          reason: triggerReason || 'Google Gemini TTS quota reached (429); switched to ElevenLabs',
          remainingCredits: el.remainingCredits,
        };
        this.notifyAutoSwitch(event);
        return event;
      }
    }

    return null;
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

  public playGoalHorn(): void {
    // Disabled per user preference
  }

  public playAssistChime(): void {
    // Disabled per user preference
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
    pitchCents = this.ttsProvider === 'cartesia' ? this.cartesiaVoiceSettings.pitchCents : this.voiceSettings.pitchCents,
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
    pitchCents = this.ttsProvider === 'cartesia' ? this.cartesiaVoiceSettings.pitchCents : this.voiceSettings.pitchCents,
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

  // Announce text using currently selected TTS provider (Cartesia or ElevenLabs) with WebSpeech fallback
  public async announce(
    text: string,
    overrideVoiceId?: string,
    overrideSettings?: Partial<ElevenLabsVoiceSettings>,
    retryCount = 0
  ): Promise<AnnounceResult> {
    if (this.isMuted) {
      return { source: 'webspeech' };
    }

    this.unlock();
    this.stopAll();

    // Auto-switch check before announcement
    if (retryCount === 0) {
      this.checkAndPerformAutoSwitch('Pre-announcement credit check');
    }

    const provider = this.ttsProvider;

    // 0. BROWSER WEBSPEECH (NATIVE) ROUTE
    if (provider === 'webspeech') {
      const targetVoice = overrideVoiceId && overrideVoiceId !== 'nhl' ? overrideVoiceId : this.webSpeechSettings.voiceURI;
      await this.speakWebSpeechPromise(text, targetVoice);
      return { source: 'webspeech', voiceId: targetVoice || 'Browser Native' };
    }

    // 1. CARTESIA TTS ROUTE
    if (provider === 'cartesia') {
      const cSettings = { ...this.cartesiaVoiceSettings };
      const effectiveCartesiaVoice = overrideVoiceId && overrideVoiceId !== 'nhl'
        ? overrideVoiceId
        : cSettings.voiceId;

      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, audio/mpeg, audio/wav, */*'
          },
          body: JSON.stringify({
            text,
            provider: 'cartesia',
            account: this.activeCartesiaAccount,
            voiceId: effectiveCartesiaVoice,
            cartesiaSettings: {
              voiceId: effectiveCartesiaVoice,
              modelId: cSettings.modelId,
              speed: cSettings.speed,
              pitchCents: cSettings.pitchCents,
              emotion: cSettings.emotion
            },
            format: 'base64'
          })
        });

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();

          if (data.success && data.audioBase64) {
            const played = await this.playBase64Audio(data.audioBase64, cSettings.pitchCents, data.mimeType || 'audio/mpeg');
            if (played) {
              this.fetchCredits().catch(() => {});
              return { source: 'cartesia', voiceId: data.voiceId };
            }
          }

          // Handle quota exhaustion auto-switch
          if (data.quotaExceeded || (data.error && (data.error.includes('credit') || data.error.includes('quota')))) {
            if (this.creditsStatus) {
              if (this.activeCartesiaAccount === 'account1') {
                this.creditsStatus.cartesiaAccount1.remainingCredits = 0;
                this.creditsStatus.cartesiaAccount1.isLowCredits = true;
              } else {
                this.creditsStatus.cartesiaAccount2.remainingCredits = 0;
                this.creditsStatus.cartesiaAccount2.isLowCredits = true;
              }
            }
            if (retryCount < 1) {
              const switched = this.checkAndPerformAutoSwitch('Active Cartesia quota exhausted during speech');
              if (switched) {
                return this.announce(text, overrideVoiceId, overrideSettings, retryCount + 1);
              }
            }
          }

          const errorMsg = data.error || (data.fallback ? 'Fallback active' : 'Cartesia synthesis failed');
          console.warn('Cartesia TTS server fallback active:', errorMsg, data);
          this.speakWebSpeech(text, 'cartesia');
          return { source: 'webspeech', voiceId: data.voiceId, error: errorMsg };
        }

        if (contentType.includes('audio/')) {
          const arrayBuffer = await response.arrayBuffer();
          const headerVoice = response.headers.get('x-cartesia-voice') || effectiveCartesiaVoice;
          const mime = contentType.includes('wav') ? 'audio/wav' : 'audio/mpeg';

          const played = await this.playArrayBuffer(arrayBuffer, cSettings.pitchCents, mime);
          if (played) {
            this.fetchCredits().catch(() => {});
            return { source: 'cartesia', voiceId: headerVoice };
          }
        }

        this.speakWebSpeech(text, 'cartesia');
        return { source: 'webspeech', error: 'Unexpected voice response format' };
      } catch (err: any) {
        console.warn('Cartesia API request failed, falling back to Web Speech API:', err);
        this.speakWebSpeech(text, 'cartesia');
        return { source: 'webspeech', error: err?.message || 'Network error during Cartesia voice playback' };
      }
    }

    // 2. GOOGLE NATURAL SPORT COMMENTATOR TTS ROUTE
    if (provider === 'google') {
      const gSettings = { ...this.googleVoiceSettings };
      const effectiveGoogleVoice = overrideVoiceId && overrideVoiceId !== 'nhl'
        ? overrideVoiceId
        : gSettings.voiceId;

      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, audio/wav, audio/mpeg, */*',
          },
          body: JSON.stringify({
            text,
            provider: 'google',
            voiceId: effectiveGoogleVoice,
            googleSettings: {
              voiceId: effectiveGoogleVoice,
              speed: gSettings.speed,
              pitchCents: gSettings.pitchCents,
              commentatorStyle: gSettings.commentatorStyle,
            },
            format: 'base64',
          }),
        });

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data.success && data.audioBase64) {
            const played = await this.playBase64Audio(data.audioBase64, gSettings.pitchCents);
            if (played) {
              return { source: 'google', voiceId: data.voiceId };
            }
          }

          // Handle quota exhaustion (HTTP 429 / RESOURCE_EXHAUSTED) auto-switch
          if (data.quotaExceeded || (data.error && (data.error.includes('quota') || data.error.includes('429') || data.error.includes('RESOURCE_EXHAUSTED')))) {
            if (retryCount < 1) {
              const switched = this.checkAndPerformAutoSwitch('Google Gemini TTS quota reached (429); switching to next voice provider');
              if (switched) {
                return this.announce(text, overrideVoiceId, overrideSettings, retryCount + 1);
              }
            }
          }

          const errorMsg = data.error || (data.fallback ? 'Google TTS fallback active' : 'Voice synthesis failed');
          console.warn('Google TTS server fallback active:', errorMsg, data);
          this.speakWebSpeech(text, 'google');
          return { source: 'webspeech', voiceId: data.voiceId, error: errorMsg };
        }

        if (contentType.includes('audio/')) {
          const arrayBuffer = await response.arrayBuffer();
          const headerVoice = response.headers.get('x-google-voice') || effectiveGoogleVoice;
          const mime = contentType.includes('wav') ? 'audio/wav' : 'audio/mpeg';

          const played = await this.playArrayBuffer(arrayBuffer, gSettings.pitchCents, mime);
          if (played) {
            return { source: 'google', voiceId: headerVoice };
          }
        }

        this.speakWebSpeech(text, 'google');
        return { source: 'webspeech', error: 'Unexpected voice response format' };
      } catch (err: any) {
        console.warn('Google TTS API request failed, falling back to Web Speech API:', err);
        this.speakWebSpeech(text, 'google');
        return { source: 'webspeech', error: err?.message || 'Network error during Google voice playback' };
      }
    }

    // 3. ELEVENLABS TTS ROUTE (DEFAULT)
    const settings: ElevenLabsVoiceSettings = {
      ...this.voiceSettings,
      ...(overrideSettings || {})
    };

    const effectiveVoiceId =
      overrideVoiceId && overrideVoiceId !== 'nhl'
        ? overrideVoiceId
        : settings.voiceId || 'nhl';

    try {
      // Request base64 format for maximum reliability across Vercel serverless edge
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, audio/mpeg, */*'
        },
        body: JSON.stringify({
          text,
          provider: 'elevenlabs',
          voiceId: effectiveVoiceId,
          voiceSettings: {
            speed: settings.speed,
            stability: settings.stability,
            similarity_boost: settings.similarity_boost,
            style: settings.style,
            use_speaker_boost: settings.use_speaker_boost
          },
          format: 'base64'
        })
      });

      const contentType = response.headers.get('content-type') || '';

      // CASE 1: JSON response (base64 audio or error payload)
      if (contentType.includes('application/json')) {
        const data = await response.json();

        if (data.success && data.audioBase64) {
          const played = await this.playBase64Audio(data.audioBase64, settings.pitchCents);
          if (played) {
            this.fetchCredits().catch(() => {});
            return { source: 'elevenlabs', voiceId: data.voiceId };
          }
        }

        // Handle quota exhaustion auto-switch
        if (data.quotaExceeded || (data.error && (data.error.includes('credit') || data.error.includes('quota')))) {
          if (this.creditsStatus) {
            this.creditsStatus.elevenlabs.remainingCredits = 0;
            this.creditsStatus.elevenlabs.isLowCredits = true;
          }
          if (retryCount < 1) {
            const switched = this.checkAndPerformAutoSwitch('ElevenLabs character quota exhausted during speech');
            if (switched) {
              return this.announce(text, overrideVoiceId, overrideSettings, retryCount + 1);
            }
          }
        }

        // Server returned fallback or error info
        const errorMsg = data.error || (data.fallback ? 'Fallback active' : 'Voice synthesis failed');
        console.warn('ElevenLabs TTS server fallback active:', errorMsg, data);
        this.speakWebSpeech(text, 'elevenlabs');
        return { source: 'webspeech', voiceId: data.voiceId, error: errorMsg };
      }

      // CASE 2: Binary audio/mpeg stream
      if (contentType.includes('audio/mpeg') || contentType.includes('audio/')) {
        const arrayBuffer = await response.arrayBuffer();
        const headerVoice = response.headers.get('x-elevenlabs-voice') || undefined;

        const played = await this.playArrayBuffer(arrayBuffer, settings.pitchCents);
        if (played) {
          this.fetchCredits().catch(() => {});
          return { source: 'elevenlabs', voiceId: headerVoice };
        }
      }

      // If unexpected response
      console.warn('Unexpected TTS response format:', contentType);
      this.speakWebSpeech(text, 'elevenlabs');
      return { source: 'webspeech', error: 'Unexpected voice response format' };
    } catch (err: any) {
      console.warn('ElevenLabs API request failed, falling back to Web Speech API:', err);
      this.speakWebSpeech(text, 'elevenlabs');
      return { source: 'webspeech', error: err?.message || 'Network error during voice playback' };
    }
  }

  // Web Speech API with rate and pitch controls matching active provider settings
  private speakWebSpeech(text: string, forceProvider?: TTSProvider) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || this.isMuted) return;

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const activeProvider = forceProvider || this.ttsProvider;
      let activeSpeed = this.voiceSettings.speed;
      let activePitch = this.voiceSettings.pitchCents;

      const utterance = new SpeechSynthesisUtterance(text);

      if (activeProvider === 'webspeech') {
        utterance.rate = Math.max(0.5, Math.min(2.0, this.webSpeechSettings.speed));
        utterance.pitch = Math.max(0.5, Math.min(2.0, this.webSpeechSettings.pitch));
      } else {
        if (activeProvider === 'cartesia') {
          activeSpeed = this.cartesiaVoiceSettings.speed;
          activePitch = this.cartesiaVoiceSettings.pitchCents;
        } else if (activeProvider === 'google') {
          activeSpeed = this.googleVoiceSettings.speed;
          activePitch = this.googleVoiceSettings.pitchCents;
        }
        utterance.rate = Math.max(0.7, Math.min(1.4, activeSpeed));
        // Map cents (-500 to +500) to pitch offset (0.5 to 1.8)
        const pitchOffset = activePitch / 1000;
        utterance.pitch = Math.max(0.5, Math.min(1.8, 1.1 + pitchOffset));
      }

      // Fix for Chromium garbage-collection bug where synthesis stops early
      (window as any).__lastUtterance = utterance;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        if (activeProvider === 'webspeech' && this.webSpeechSettings.voiceURI) {
          const matched = voices.find(
            (v) => v.voiceURI === this.webSpeechSettings.voiceURI || v.name === this.webSpeechSettings.voiceURI
          );
          if (matched) {
            utterance.voice = matched;
          }
        }
        if (!utterance.voice) {
          const preferredVoice = voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Samantha'))
          ) || voices.find((v) => v.lang.startsWith('en'));

          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
        }
      }

      utterance.onend = () => {
        (window as any).__lastUtterance = null;
      };

      utterance.onerror = (e) => {
        console.warn('Web Speech error:', e);
        (window as any).__lastUtterance = null;
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Web Speech invocation failed:', err);
    }
  }

  // Promise-based WebSpeech speaker for announce await and test preview
  public speakWebSpeechPromise(text: string, overrideVoiceURI?: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || this.isMuted) {
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.max(0.5, Math.min(2.0, this.webSpeechSettings.speed));
        utterance.pitch = Math.max(0.5, Math.min(2.0, this.webSpeechSettings.pitch));

        const targetURI = overrideVoiceURI || this.webSpeechSettings.voiceURI;
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          if (targetURI) {
            const matched = voices.find((v) => v.voiceURI === targetURI || v.name === targetURI);
            if (matched) {
              utterance.voice = matched;
            }
          }
          if (!utterance.voice) {
            const preferredVoice = voices.find(
              (v) =>
                v.lang.startsWith('en') &&
                (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Samantha') || v.name.includes('Alex'))
            ) || voices.find((v) => v.lang.startsWith('en'));

            if (preferredVoice) {
              utterance.voice = preferredVoice;
            }
          }
        }

        (window as any).__lastUtterance = utterance;

        const maxTimeout = setTimeout(() => {
          (window as any).__lastUtterance = null;
          resolve();
        }, 12000);

        utterance.onend = () => {
          clearTimeout(maxTimeout);
          (window as any).__lastUtterance = null;
          resolve();
        };

        utterance.onerror = (e) => {
          console.warn('WebSpeech utterance error:', e);
          clearTimeout(maxTimeout);
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

export function generateGoalPrompt(playerNumber: number, playerName: string, teamName: string = 'Pelham Pelicans'): string {
  const safeTeam = teamName?.trim() || 'Pelham Pelicans';
  return `${safeTeam} goal! Scored by number ${playerNumber}, ${playerName}!`;
}

export function generateAssistPrompt(playerNumber: number, playerName: string): string {
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
  const scorerPart = `Scored by number ${scorerNumber}, ${scorerName}!`;

  const hasPrimary =
    primaryAssistNumber !== undefined &&
    primaryAssistNumber !== null &&
    primaryAssistName &&
    primaryAssistName.trim().length > 0;

  const hasSecondary =
    secondaryAssistNumber !== undefined &&
    secondaryAssistNumber !== null &&
    secondaryAssistName &&
    secondaryAssistName.trim().length > 0;

  if (hasPrimary && hasSecondary) {
    return `${safeTeam} goal! ${scorerPart} Assisted by number ${primaryAssistNumber}, ${primaryAssistName}, and number ${secondaryAssistNumber}, ${secondaryAssistName}!`;
  }
  if (hasPrimary) {
    return `${safeTeam} goal! ${scorerPart} Assisted by number ${primaryAssistNumber}, ${primaryAssistName}!`;
  }
  if (hasSecondary) {
    return `${safeTeam} goal! ${scorerPart} Assisted by number ${secondaryAssistNumber}, ${secondaryAssistName}!`;
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

  if (includePlayerName && playerName && playerName.trim().length > 0) {
    return `Number ${playerNumber}, ${playerName.trim()}, ${safeTeam}${timePart} for ${cleanInfraction}.${clockPart}`;
  }

  // With time: 'Number 12, Pelham Pelicans two minutes for [foul].'
  // Without time: 'Number 12, Pelham Pelicans for [foul].'
  return `Number ${playerNumber}, ${safeTeam}${timePart} for ${cleanInfraction}.${clockPart}`;
}

export function generateWelcomePrompt(opponentTeam: string = 'Visitor Team'): string {
  const safeOpponent = opponentTeam?.trim() || 'Visitor Team';
  return `Welcome, everyone, and thank you for joining us for today’s hockey game. Pelham Pelicans are excited to host ${safeOpponent} and look forward to a competitive, respectful, and fun matchup. Enjoy the game and best of luck to both teams.`;
}



