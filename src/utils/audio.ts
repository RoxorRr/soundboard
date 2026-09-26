// Professional Web Audio Arena sound engine, ElevenLabs, Cartesia & Speechify TTS player
import { ElevenLabsVoiceSettings, CartesiaVoiceSettings, SpeechifyVoiceSettings, TTSProvider } from '../types';

export interface AnnounceResult {
  source: 'elevenlabs' | 'cartesia' | 'speechify' | 'webspeech';
  voiceId?: string;
  cartesiaAccount?: 'account1' | 'account2';
  error?: string;
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
  voiceIdAccount1: '',
  voiceIdAccount2: '',
  modelId: 'sonic-3.5',
  speed: 1.05,
  pitchCents: 0,
  emotion: 'excited',
  accountMode: 'auto',
};

export const DEFAULT_SPEECHIFY_VOICE_SETTINGS: SpeechifyVoiceSettings = {
  voiceId: 'geffen_32', // Simba 3.2 High-energy sports announcer
  model: 'simba-3.2',
  speed: 1.05,
  pitchCents: 0,
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
  private voiceSettings: ElevenLabsVoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
  private cartesiaVoiceSettings: CartesiaVoiceSettings = { ...DEFAULT_CARTESIA_VOICE_SETTINGS };
  private speechifyVoiceSettings: SpeechifyVoiceSettings = { ...DEFAULT_SPEECHIFY_VOICE_SETTINGS };

  constructor() {
    // Restore persistent voice settings from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const savedProvider = localStorage.getItem('pelham_tts_provider');
        if (savedProvider === 'elevenlabs' || savedProvider === 'cartesia' || savedProvider === 'speechify') {
          this.ttsProvider = savedProvider;
        }

        const saved = localStorage.getItem('pelham_voice_settings');
        if (saved) {
          this.voiceSettings = { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
        }

        const savedCartesia = localStorage.getItem('pelham_cartesia_voice_settings');
        if (savedCartesia) {
          this.cartesiaVoiceSettings = { ...DEFAULT_CARTESIA_VOICE_SETTINGS, ...JSON.parse(savedCartesia) };
        }

        const savedSpeechify = localStorage.getItem('pelham_speechify_voice_settings');
        if (savedSpeechify) {
          this.speechifyVoiceSettings = { ...DEFAULT_SPEECHIFY_VOICE_SETTINGS, ...JSON.parse(savedSpeechify) };
        }
      } catch (_) {}

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

  // Announce text using currently selected TTS provider (Cartesia or ElevenLabs) with WebSpeech fallback
  public async announce(
    text: string,
    overrideVoiceId?: string,
    overrideSettings?: Partial<ElevenLabsVoiceSettings & CartesiaVoiceSettings>
  ): Promise<AnnounceResult> {
    if (this.isMuted) {
      return { source: 'webspeech' };
    }

    this.unlock();
    this.stopAll();

    const provider = this.ttsProvider;

    // CARTESIA TTS ROUTE
    if (provider === 'cartesia') {
      const cSettings: CartesiaVoiceSettings = {
        ...this.cartesiaVoiceSettings,
        ...((overrideSettings as Partial<CartesiaVoiceSettings>) || {})
      };
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
            voiceId: effectiveCartesiaVoice,
            cartesiaSettings: {
              voiceId: effectiveCartesiaVoice,
              voiceIdAccount1: cSettings.voiceIdAccount1 || '',
              voiceIdAccount2: cSettings.voiceIdAccount2 || '',
              modelId: cSettings.modelId,
              speed: cSettings.speed,
              pitchCents: cSettings.pitchCents,
              emotion: cSettings.emotion,
              accountMode: cSettings.accountMode || 'auto',
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
              return { source: 'cartesia', voiceId: data.voiceId, cartesiaAccount: data.cartesiaAccount };
            }
          }

          const errorMsg = data.error || (data.fallback ? 'Fallback active' : 'Cartesia synthesis failed');
          console.warn('Cartesia TTS server fallback active:', errorMsg, data);
          this.speakWebSpeech(text);
          return { source: 'webspeech', voiceId: data.voiceId, error: errorMsg };
        }

        if (contentType.includes('audio/')) {
          const arrayBuffer = await response.arrayBuffer();
          const headerVoice = response.headers.get('x-cartesia-voice') || effectiveCartesiaVoice;
          const headerAccount = response.headers.get('x-cartesia-account') as 'account1' | 'account2' | undefined;
          const mime = contentType.includes('wav') ? 'audio/wav' : 'audio/mpeg';

          const played = await this.playArrayBuffer(arrayBuffer, cSettings.pitchCents, mime);
          if (played) {
            return { source: 'cartesia', voiceId: headerVoice, cartesiaAccount: headerAccount };
          }
        }

        this.speakWebSpeech(text);
        return { source: 'webspeech', error: 'Unexpected voice response format' };
      } catch (err: any) {
        console.warn('Cartesia API request failed, falling back to Web Speech API:', err);
        this.speakWebSpeech(text);
        return { source: 'webspeech', error: err?.message || 'Network error during Cartesia voice playback' };
      }
    }

    // SPEECHIFY / SPEECHITY TTS ROUTE
    if (provider === 'speechify') {
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
          this.speakWebSpeech(text);
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

        this.speakWebSpeech(text);
        return { source: 'webspeech', error: 'Unexpected voice response format' };
      } catch (err: any) {
        console.warn('Speechify API request failed, falling back to Web Speech API:', err);
        this.speakWebSpeech(text);
        return { source: 'webspeech', error: err?.message || 'Network error during Speechify voice playback' };
      }
    }

    // ELEVENLABS TTS ROUTE (DEFAULT)
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
            return { source: 'elevenlabs', voiceId: data.voiceId };
          }
        }

        // Server returned fallback or error info
        const errorMsg = data.error || (data.fallback ? 'Fallback active' : 'Voice synthesis failed');
        console.warn('ElevenLabs TTS server fallback active:', errorMsg, data);
        this.speakWebSpeech(text);
        return { source: 'webspeech', voiceId: data.voiceId, error: errorMsg };
      }

      // CASE 2: Binary audio/mpeg stream
      if (contentType.includes('audio/mpeg') || contentType.includes('audio/')) {
        const arrayBuffer = await response.arrayBuffer();
        const headerVoice = response.headers.get('x-elevenlabs-voice') || undefined;

        const played = await this.playArrayBuffer(arrayBuffer, settings.pitchCents);
        if (played) {
          return { source: 'elevenlabs', voiceId: headerVoice };
        }
      }

      // If unexpected response
      console.warn('Unexpected TTS response format:', contentType);
      this.speakWebSpeech(text);
      return { source: 'webspeech', error: 'Unexpected voice response format' };
    } catch (err: any) {
      console.warn('ElevenLabs API request failed, falling back to Web Speech API:', err);
      this.speakWebSpeech(text);
      return { source: 'webspeech', error: err?.message || 'Network error during voice playback' };
    }
  }

  // Web Speech API with rate and pitch controls matching active provider settings
  private speakWebSpeech(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || this.isMuted) return;

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

export function generateWelcomePrompt(opponentTeam: string = 'visiting team'): string {
  const cleanTeam = opponentTeam?.trim() || 'visiting team';
  // If cleanTeam is generic ('visiting team', 'visitor team', 'opponent team', etc.), ensure natural phrasing "the visiting team"
  const isGenericVisitor = /^(the\s+)?(visiting\s+team|visitor\s+team|opponent\s+team)$/i.test(cleanTeam);
  const teamPhrase = isGenericVisitor ? 'the visiting team' : cleanTeam;
  return `Welcome, everyone, and thank you for joining us for today’s hockey game. The Pelham Pelicans are excited to host ${teamPhrase} and look forward to a competitive, respectful, and fun matchup. Enjoy the game, and best of luck to both teams. At this time, I’d like to ask both teams to please line up for our national anthem.`;
}



