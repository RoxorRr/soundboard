// Professional Web Audio Arena sound engine and ElevenLabs TTS player

class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private playSfx: boolean = true;
  private isUnlocked: boolean = false;

  constructor() {
    // Auto-unlock on first user interaction anywhere in the window
    if (typeof window !== 'undefined') {
      const unlockEvents = ['click', 'touchstart', 'keydown'];
      const onUserInteraction = () => {
        this.unlock();
        unlockEvents.forEach((ev) => window.removeEventListener(ev, onUserInteraction));
      };
      unlockEvents.forEach((ev) => window.addEventListener(ev, onUserInteraction, { passive: true }));
    }
  }

  // Explicitly unlock AudioContext during a user gesture
  public unlock(): void {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      this.isUnlocked = true;

      // Resume SpeechSynthesis in case Chrome paused it
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
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.audioCtx.currentTime);
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
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  // Sound effects disabled per user request (no piano / synth sounds)
  public playGoalHorn(): void {
    // Piano / synth sound removed
  }

  public playAssistChime(): void {
    // Piano / chime sound removed
  }

  // Announce text using ElevenLabs voice with Web Audio playback and fallback
  public async announce(text: string, voiceId = 'nhl'): Promise<{ source: 'elevenlabs' | 'webspeech'; error?: string }> {
    if (this.isMuted) {
      return { source: 'webspeech' };
    }

    this.unlock();
    this.stopAll();

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId })
      });

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('audio/mpeg')) {
        const arrayBuffer = await response.arrayBuffer();
        
        // METHOD 1: Web Audio decodeAudioData (Preferred: Immune to iframe autoplay blocking!)
        try {
          const ctx = this.getAudioContext();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }

          // decodeAudioData needs a copy of arrayBuffer in some older browsers
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.masterGain || ctx.destination);
          this.currentSource = source;

          await new Promise<void>((resolve) => {
            source.onended = () => {
              this.currentSource = null;
              resolve();
            };
            source.start(0);
          });

          return { source: 'elevenlabs' };
        } catch (webAudioErr) {
          console.warn('Web Audio decode failed, attempting HTMLAudioElement fallback:', webAudioErr);
          
          // METHOD 2: HTMLAudioElement fallback
          const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          this.currentAudioElement = audio;

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              resolve();
            };
            audio.onerror = (e) => {
              URL.revokeObjectURL(audioUrl);
              reject(e);
            };
            audio.play().catch(reject);
          });

          return { source: 'elevenlabs' };
        }
      }

      // If server returned JSON fallback
      const data = await response.json();
      console.info('TTS fallback active:', data?.message || data?.error);
      this.speakWebSpeech(text);
      return { source: 'webspeech', error: data?.error };
    } catch (err: any) {
      console.warn('ElevenLabs API request failed, falling back to Web Speech API:', err);
      this.speakWebSpeech(text);
      return { source: 'webspeech', error: err?.message };
    }
  }

  // Web Speech API with anti-GC protection and resume
  private speakWebSpeech(text: string) {
    if (!('speechSynthesis' in window) || this.isMuted) return;

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.1;

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
