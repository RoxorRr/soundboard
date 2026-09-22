import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Camera,
  Users,
  RotateCcw,
  Radio,
  Edit2,
  Check,
  Award,
  Flame,
  Settings,
  Info,
  Sliders,
  Gauge,
  Music,
  Zap,
  Mic,
  Maximize,
  Minimize,
  Cpu,
  Key,
  Clock,
  ShieldAlert,
  Timer,
  Pin,
  Plus,
  Minus,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Shuffle,
  BarChart3,
} from 'lucide-react';
import {
  Announcement,
  VoiceStatus,
  Player,
  ElevenLabsVoiceSettings,
  CartesiaVoiceSettings,
  GoogleVoiceSettings,
  WebSpeechVoiceSettings,
  TTSProvider,
  AccountChoice,
  CreditsStatus,
  AutoSwitchEvent,
} from '../types';
import {
  soundEngine,
  DEFAULT_VOICE_SETTINGS,
  DEFAULT_CARTESIA_VOICE_SETTINGS,
  DEFAULT_GOOGLE_VOICE_SETTINGS,
  DEFAULT_WEBSPEECH_SETTINGS,
  POPULAR_NATURAL_MALE_PRESETS,
  findBestNaturalMaleVoice,
  isNaturalMaleVoice,
  NaturalMaleVoicePreset,
  generateWelcomePrompt,
  CREDIT_SWITCH_THRESHOLD,
} from '../utils/audio';
import {
  getSavedGamePenaltyDuration,
  saveGamePenaltyDuration,
  STANDARD_PENALTY_DURATIONS,
  formatMinutesAndSecondsToSpoken,
  formatDurationDisplay,
  PenaltyDurationOption,
} from '../utils/penaltyTime';

interface SettingsViewProps {
  homePlayers: Player[];
  visitorPlayers: Player[];
  visitorTeamName: string;
  onUpdateVisitorName: (name: string) => void;
  homeGoals: number;
  homeAssists: number;
  visitorGoals: number;
  visitorAssists: number;
  activeTeamTab: 'home' | 'visitor';
  onSelectTeamTab: (team: 'home' | 'visitor') => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  voiceStatus: VoiceStatus | null;
  voiceFeedback: { message: string; type: 'success' | 'warning' | 'info' } | null;
  currentAnnouncement: Announcement | null;
  isAnnouncing: boolean;
  onReplayAnnouncement: () => void;
  onTestVoice: () => void;
  onOpenRosterModal: (team?: 'home' | 'visitor') => void;
  onOpenScannerModal: (team?: 'home' | 'visitor') => void;
  onOpenResetModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  homePlayers,
  visitorPlayers,
  visitorTeamName,
  onUpdateVisitorName,
  homeGoals,
  homeAssists,
  visitorGoals,
  visitorAssists,
  activeTeamTab,
  onSelectTeamTab,
  isMuted,
  onToggleMute,
  isFullscreen = false,
  onToggleFullscreen,
  voiceStatus,
  voiceFeedback,
  currentAnnouncement,
  isAnnouncing,
  onReplayAnnouncement,
  onTestVoice,
  onOpenRosterModal,
  onOpenScannerModal,
  onOpenResetModal,
}) => {
  const [isEditingVisitorName, setIsEditingVisitorName] = useState(false);
  const [tempVisitorName, setTempVisitorName] = useState(visitorTeamName);

  // Active TTS Provider Selection ('elevenlabs' | 'cartesia')
  const [selectedProvider, setSelectedProvider] = useState<TTSProvider>(() => {
    return soundEngine.getTTSProvider();
  });

  // Cartesia Multi-Account Selection State
  const [activeCartesiaAccount, setActiveCartesiaAccount] = useState<AccountChoice>(() => {
    return soundEngine.getCartesiaAccount();
  });

  // ElevenLabs Voice Customization State
  const [voiceSettings, setVoiceSettings] = useState<ElevenLabsVoiceSettings>(() => {
    return soundEngine.getVoiceSettings();
  });
  const [activePreset, setActivePreset] = useState<string>('arena');
  const [customVoiceIdInput, setCustomVoiceIdInput] = useState(
    voiceSettings.voiceId || '6j98Cb2txyqvHRXeRQYZ'
  );
  const [isCustomVoiceSelected, setIsCustomVoiceSelected] = useState(
    !['6j98Cb2txyqvHRXeRQYZ', 'pNInz6obpgDQGcFmaJgB', 'VR6AewLTigWG4xSOukaG', 'ErXwobaYiN019PkySvjV', 'JBFqnCBsd6RMkjVDRZzb'].includes(
      voiceSettings.voiceId || ''
    )
  );

  // Cartesia Sonic Voice Customization State
  const [cartesiaSettings, setCartesiaSettings] = useState<CartesiaVoiceSettings>(() => {
    return soundEngine.getCartesiaSettings();
  });
  const [cartesiaPreset, setCartesiaPreset] = useState<string>('arena');
  const [customCartesiaVoiceIdInput, setCustomCartesiaVoiceIdInput] = useState<string>(
    cartesiaSettings.voiceId || '694f9389-aac1-45b6-b726-9d9369183238'
  );
  const [isCustomCartesiaVoiceSelected, setIsCustomCartesiaVoiceSelected] = useState<boolean>(
    !['694f9389-aac1-45b6-b726-9d9369183238', '47c38ca4-5f35-497b-b1a3-415245fb35e1', 'a167e0f3-df7e-4d52-a9c3-f949145efdab', 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4'].includes(
      cartesiaSettings.voiceId || ''
    )
  );

  // Google Natural Sport Commentator Voice Customization State
  const [googleVoiceSettings, setGoogleVoiceSettings] = useState<GoogleVoiceSettings>(() => {
    return soundEngine.getGoogleVoiceSettings();
  });
  const [googleCommentatorPreset, setGoogleCommentatorPreset] = useState<string>(
    googleVoiceSettings.commentatorStyle || 'play-by-play'
  );
  const [customGoogleVoiceIdInput, setCustomGoogleVoiceIdInput] = useState<string>(
    googleVoiceSettings.voiceId || 'Puck'
  );
  const [isCustomGoogleVoiceSelected, setIsCustomGoogleVoiceSelected] = useState<boolean>(
    !['Puck', 'Charon', 'Fenrir', 'Aoede', 'Kore', 'en-US-Journey-O', 'en-US-Journey-F', 'en-US-Studio-O', 'en-US-Neural2-J'].includes(
      googleVoiceSettings.voiceId || ''
    )
  );

  // Browser WebSpeech (Native) Voice Customization State
  const [webSpeechSettings, setWebSpeechSettings] = useState<WebSpeechVoiceSettings>(() => {
    return soundEngine.getWebSpeechSettings();
  });
  const [availableBrowserVoices, setAvailableBrowserVoices] = useState<SpeechSynthesisVoice[]>(() => {
    return soundEngine.getAvailableWebSpeechVoices();
  });

  const [saveBadgeText, setSaveBadgeText] = useState<string | null>(null);
  const [isTestingVoiceCustom, setIsTestingVoiceCustom] = useState(false);
  const [testSampleType, setTestSampleType] = useState<'welcome' | 'pelhamGoal' | 'visitorGoal' | 'assist'>('welcome');

  // Game Default Penalty Duration Setting
  const [gamePenaltyDuration, setGamePenaltyDuration] = useState<{ value: string; label: string }>(() =>
    getSavedGamePenaltyDuration()
  );
  const [isCustomPenaltyDurationOpen, setIsCustomPenaltyDurationOpen] = useState(false);
  const [customPenaltyMinutes, setCustomPenaltyMinutes] = useState(2);
  const [customPenaltySeconds, setCustomPenaltySeconds] = useState(0);

  // Monthly Credits and Auto-Switching state
  const [creditsStatus, setCreditsStatus] = useState<CreditsStatus | null>(() => soundEngine.getCreditsStatus());
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState<boolean>(() => soundEngine.getAutoSwitchEnabled());
  const [lastAutoSwitchAlert, setLastAutoSwitchAlert] = useState<AutoSwitchEvent | null>(null);
  const [isRefreshingCredits, setIsRefreshingCredits] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<'elevenlabs' | 'cartesia1' | 'cartesia2' | null>(null);
  const [manualBalanceInput, setManualBalanceInput] = useState<string>('130000');

  useEffect(() => {
    soundEngine.fetchCredits().then((status) => {
      if (status) setCreditsStatus(status);
    });

    const unsubCredits = soundEngine.onCreditsUpdate((status) => {
      setCreditsStatus(status);
      setSelectedProvider(status.activeProvider);
      setActiveCartesiaAccount(status.activeCartesiaAccount);
    });

    const unsubAutoSwitch = soundEngine.onAutoSwitch((event) => {
      setLastAutoSwitchAlert(event);
      setSelectedProvider(event.toProvider);
      if (event.toAccount) {
        setActiveCartesiaAccount(event.toAccount);
      }
      const targetName = event.toProvider === 'cartesia'
        ? `Cartesia (${event.toAccount === 'account2' ? 'Account 2' : 'Account 1'})`
        : event.toProvider === 'google'
        ? 'Google Natural Sport Commentator'
        : event.toProvider === 'webspeech'
        ? 'Browser WebSpeech (Native)'
        : 'ElevenLabs';
      showSavedNotification(`Auto-switched to ${targetName}`);
    });

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          setAvailableBrowserVoices(v);
          setWebSpeechSettings((prev) => {
            if (!prev.voiceURI) {
              const best = findBestNaturalMaleVoice(v);
              if (best) {
                const next = { ...prev, voiceURI: best.voiceURI || best.name };
                soundEngine.setWebSpeechSettings(next);
                return next;
              }
            }
            return prev;
          });
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      unsubCredits();
      unsubAutoSwitch();
    };
  }, []);

  const handleToggleAutoSwitch = () => {
    const nextVal = !autoSwitchEnabled;
    setAutoSwitchEnabled(nextVal);
    soundEngine.setAutoSwitchEnabled(nextVal);
    showSavedNotification(nextVal ? 'Auto-switching enabled (≤ 400 credits)' : 'Auto-switching disabled');
  };

  const handleRefreshCredits = async () => {
    setIsRefreshingCredits(true);
    const updated = await soundEngine.fetchCredits();
    if (updated) setCreditsStatus(updated);
    setIsRefreshingCredits(false);
    showSavedNotification('Voice credits refreshed');
  };

  const handleOpenBalanceEdit = (acc: 'elevenlabs' | 'cartesia1' | 'cartesia2') => {
    setEditingAccount(acc);
    let current = 130000;
    if (acc === 'elevenlabs') {
      current = creditsStatus?.elevenlabs.remainingCredits ?? 130000;
    } else if (acc === 'cartesia1') {
      current = creditsStatus?.cartesiaAccount1.remainingCredits ?? 120000;
    } else {
      current = creditsStatus?.cartesiaAccount2.remainingCredits ?? 19000;
    }
    setManualBalanceInput(String(current));
  };

  const handleSaveBalance = async (acc: 'elevenlabs' | 'cartesia1' | 'cartesia2') => {
    const val = parseInt(manualBalanceInput, 10);
    if (!isNaN(val) && val >= 0) {
      await soundEngine.setManualAccountBalance(acc, val);
      setEditingAccount(null);
      const accName = acc === 'elevenlabs' ? 'ElevenLabs' : acc === 'cartesia1' ? 'Cartesia Account 1' : 'Cartesia Account 2';
      showSavedNotification(`${accName} balance calibrated to ${val.toLocaleString()} credits`);
    }
  };

  const handleSyncAllActualBalances = async () => {
    setIsRefreshingCredits(true);
    await soundEngine.syncAllActualBalances(130000, 120000, 19000);
    const updated = await soundEngine.fetchCredits();
    if (updated) setCreditsStatus(updated);
    setIsRefreshingCredits(false);
    showSavedNotification('All accounts calibrated (ElevenLabs: 130k, Cartesia 1: 120k, Cartesia 2: 19k)');
  };

  const handleSelectGamePenalty = (opt: PenaltyDurationOption) => {
    saveGamePenaltyDuration(opt.value, opt.label);
    setGamePenaltyDuration({ value: opt.value, label: opt.label });
    showSavedNotification(`Game penalty duration set to ${opt.label}`);
  };

  const handleApplyCustomGamePenalty = () => {
    const spoken = formatMinutesAndSecondsToSpoken(customPenaltyMinutes, customPenaltySeconds);
    const label = formatDurationDisplay(customPenaltyMinutes, customPenaltySeconds);
    saveGamePenaltyDuration(spoken, label);
    setGamePenaltyDuration({ value: spoken, label });
    setIsCustomPenaltyDurationOpen(false);
    showSavedNotification(`Game penalty duration set to ${label}`);
  };

  const PRESET_VOICES = [
    { id: '6j98Cb2txyqvHRXeRQYZ', name: 'Pelham Custom NHL', desc: 'Arena Play-by-Play' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep Baritone)', desc: 'Resonant Stadium Boom' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Crisp Arena)', desc: 'Clear Live Announcer' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (High Energy)', desc: 'Dynamic Youth Pace' },
    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Broadcast)', desc: 'Classic Sports Host' },
  ];

  const CARTESIA_PRESET_VOICES = [
    { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Barbershop Announcer', desc: 'Deep & Confident Stadium Voice' },
    { id: '47c38ca4-5f35-497b-b1a3-415245fb35e1', name: 'Daniel (Sports Broadcast)', desc: 'Clear & Natural Play-by-Play' },
    { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', name: 'Commercial Promo Host', desc: 'Dynamic High-Octane Hype' },
    { id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', name: 'Skylar (Expressive)', desc: 'Energetic Female Announcer' },
  ];

  const GOOGLE_PRESET_VOICES = [
    { id: 'Puck', name: 'Puck (Natural Commentator)', desc: 'Upbeat, high-energy hockey play-by-play', engine: 'Gemini Natural AI', badge: 'Featured' },
    { id: 'Charon', name: 'Charon (Veteran Color Analyst)', desc: 'Deep, resonant stadium broadcast authority', engine: 'Gemini Natural AI' },
    { id: 'Fenrir', name: 'Fenrir (Overtime Thriller)', desc: 'Booming intensity for game-winning goal shouts', engine: 'Gemini Natural AI' },
    { id: 'Aoede', name: 'Aoede (Dynamic Arena Announcer)', desc: 'Vibrant acoustic projection for arena public address', engine: 'Gemini Natural AI' },
    { id: 'Kore', name: 'Kore (Crisp PA Host)', desc: 'Articulate, stadium-ready PA announcement cadence', engine: 'Gemini Natural AI' },
    { id: 'en-US-Journey-O', name: 'Journey-O (Sports Announcer)', desc: 'Natural conversational broadcast tone', engine: 'Google Cloud TTS' },
    { id: 'en-US-Journey-F', name: 'Journey-F (Expressive Commentator)', desc: 'Bright, emotive sports commentator voice', engine: 'Google Cloud TTS' },
    { id: 'en-US-Studio-O', name: 'Studio-O (Pristine PA)', desc: 'Studio fidelity public address announcer voice', engine: 'Google Cloud TTS' },
    { id: 'en-US-Neural2-J', name: 'Neural2-J (Classic Stadium)', desc: 'Classic punchy male sports broadcast voice', engine: 'Google Cloud TTS' },
  ];

  const showSavedNotification = (msg = 'Settings saved') => {
    setSaveBadgeText(msg);
    setTimeout(() => setSaveBadgeText(null), 2500);
  };

  const handleSwitchProvider = (provider: TTSProvider) => {
    setSelectedProvider(provider);
    soundEngine.setTTSProvider(provider);
    const providerName =
      provider === 'cartesia'
        ? 'Cartesia Sonic'
        : provider === 'google'
        ? 'Google Natural Commentator'
        : provider === 'webspeech'
        ? 'Browser WebSpeech (Native)'
        : 'ElevenLabs';
    showSavedNotification(`Switched to ${providerName}`);
  };

  const handleUpdateWebSpeechSetting = <K extends keyof WebSpeechVoiceSettings>(
    key: K,
    val: WebSpeechVoiceSettings[K]
  ) => {
    const updated = { ...webSpeechSettings, [key]: val };
    setWebSpeechSettings(updated);
    soundEngine.setWebSpeechSettings(updated);
    showSavedNotification();
  };

  const handleResetWebSpeechSettings = () => {
    const fresh = soundEngine.resetWebSpeechSettings();
    setWebSpeechSettings(fresh);
    showSavedNotification('Reset Browser WebSpeech defaults');
  };

  const handleSelectNaturalMalePreset = (preset: NaturalMaleVoicePreset) => {
    const target =
      availableBrowserVoices.find((v) => {
        const combined = `${v.name} ${v.voiceURI}`.toLowerCase();
        return preset.keywords.every((k) => combined.includes(k));
      }) ||
      availableBrowserVoices.find((v) => {
        const combined = `${v.name} ${v.voiceURI}`.toLowerCase();
        return preset.keywords.some((k) => combined.includes(k));
      });

    if (target) {
      handleUpdateWebSpeechSetting('voiceURI', target.voiceURI || target.name);
      showSavedNotification(`Selected Natural Man Voice: ${preset.name}`);
    } else {
      const best = findBestNaturalMaleVoice(availableBrowserVoices);
      if (best) {
        handleUpdateWebSpeechSetting('voiceURI', best.voiceURI || best.name);
        showSavedNotification(`${preset.name} not on this OS. Selected ${best.name} instead.`);
      } else {
        showSavedNotification(`Preset voice not found on device.`);
      }
    }
  };

  const handleAutoPickBestNaturalMaleVoice = () => {
    const best = findBestNaturalMaleVoice(availableBrowserVoices);
    if (best) {
      handleUpdateWebSpeechSetting('voiceURI', best.voiceURI || best.name);
      showSavedNotification(`Auto-selected Natural Man Voice: ${best.name}`);
    } else {
      showSavedNotification('No specific natural male voice detected');
    }
  };

  const handleSwitchCartesiaAccount = (acc: AccountChoice) => {
    setActiveCartesiaAccount(acc);
    soundEngine.setCartesiaAccount(acc);
    showSavedNotification(`Switched to Cartesia ${acc === 'account1' ? 'Account 1 (Primary)' : 'Account 2 (Secondary)'}`);
  };

  const handleUpdateSetting = <K extends keyof ElevenLabsVoiceSettings>(
    key: K,
    val: ElevenLabsVoiceSettings[K]
  ) => {
    const updated = { ...voiceSettings, [key]: val };
    setVoiceSettings(updated);
    soundEngine.setVoiceSettings(updated);
    setActivePreset('custom');
    showSavedNotification();
  };

  const handleUpdateCartesiaSetting = <K extends keyof CartesiaVoiceSettings>(
    key: K,
    val: CartesiaVoiceSettings[K]
  ) => {
    const updated = { ...cartesiaSettings, [key]: val };
    setCartesiaSettings(updated);
    soundEngine.setCartesiaSettings(updated);
    setCartesiaPreset('custom');
    showSavedNotification();
  };

  const handleApplyPreset = (presetName: string) => {
    let updates: Partial<ElevenLabsVoiceSettings> = {};
    if (presetName === 'arena') {
      updates = {
        speed: 1.05,
        pitchCents: 40,
        stability: 0.45,
        similarity_boost: 0.85,
        style: 0.65,
        use_speaker_boost: true,
      };
    } else if (presetName === 'deep') {
      updates = {
        speed: 0.95,
        pitchCents: -150,
        stability: 0.55,
        similarity_boost: 0.85,
        style: 0.50,
        use_speaker_boost: true,
      };
    } else if (presetName === 'rapid') {
      updates = {
        speed: 1.15,
        pitchCents: 80,
        stability: 0.35,
        similarity_boost: 0.80,
        style: 0.75,
        use_speaker_boost: true,
      };
    } else if (presetName === 'classic') {
      updates = {
        speed: 1.00,
        pitchCents: 0,
        stability: 0.60,
        similarity_boost: 0.85,
        style: 0.40,
        use_speaker_boost: true,
      };
    }
    const merged = { ...voiceSettings, ...updates };
    setVoiceSettings(merged);
    soundEngine.setVoiceSettings(merged);
    setActivePreset(presetName);
    showSavedNotification(`Applied "${presetName}" preset`);
  };

  const handleApplyCartesiaPreset = (presetName: string) => {
    let updates: Partial<CartesiaVoiceSettings> = {};
    if (presetName === 'arena') {
      updates = {
        speed: 1.10,
        pitchCents: 40,
        emotion: 'excited',
      };
    } else if (presetName === 'deep') {
      updates = {
        speed: 0.95,
        pitchCents: -120,
        emotion: 'authoritative',
      };
    } else if (presetName === 'rapid') {
      updates = {
        speed: 1.20,
        pitchCents: 60,
        emotion: 'excited',
      };
    } else if (presetName === 'classic') {
      updates = {
        speed: 1.00,
        pitchCents: 0,
        emotion: 'neutral',
      };
    }
    const merged = { ...cartesiaSettings, ...updates };
    setCartesiaSettings(merged);
    soundEngine.setCartesiaSettings(merged);
    setCartesiaPreset(presetName);
    showSavedNotification(`Applied Cartesia "${presetName}" preset`);
  };

  const handleResetToDefaults = () => {
    if (selectedProvider === 'cartesia') {
      const freshCartesia = { ...DEFAULT_CARTESIA_VOICE_SETTINGS };
      setCartesiaSettings(freshCartesia);
      soundEngine.setCartesiaSettings(freshCartesia);
      setCustomCartesiaVoiceIdInput(freshCartesia.voiceId);
      setIsCustomCartesiaVoiceSelected(false);
      setCartesiaPreset('arena');
      showSavedNotification('Reset Cartesia to optimal arena defaults');
    } else if (selectedProvider === 'google') {
      const freshGoogle = { ...DEFAULT_GOOGLE_VOICE_SETTINGS };
      setGoogleVoiceSettings(freshGoogle);
      soundEngine.resetGoogleVoiceSettings();
      setCustomGoogleVoiceIdInput(freshGoogle.voiceId);
      setIsCustomGoogleVoiceSelected(false);
      setGoogleCommentatorPreset('play-by-play');
      showSavedNotification('Reset Google Commentator to natural sports defaults');
    } else if (selectedProvider === 'webspeech') {
      const freshWebSpeech = soundEngine.resetWebSpeechSettings();
      setWebSpeechSettings(freshWebSpeech);
      showSavedNotification('Reset Browser WebSpeech to native defaults');
    } else {
      const fresh = { ...DEFAULT_VOICE_SETTINGS };
      setVoiceSettings(fresh);
      soundEngine.setVoiceSettings(fresh);
      setCustomVoiceIdInput(fresh.voiceId);
      setIsCustomVoiceSelected(false);
      setActivePreset('arena');
      showSavedNotification('Reset ElevenLabs to optimal arena defaults');
    }
  };

  const handleSelectVoiceId = (id: string) => {
    if (id === 'custom') {
      setIsCustomVoiceSelected(true);
      return;
    }
    setIsCustomVoiceSelected(false);
    handleUpdateSetting('voiceId', id);
  };

  const handleApplyCustomVoiceId = () => {
    if (customVoiceIdInput.trim()) {
      handleUpdateSetting('voiceId', customVoiceIdInput.trim());
      showSavedNotification('Custom Voice ID applied');
    }
  };

  const handleSelectCartesiaVoiceId = (id: string) => {
    if (id === 'custom') {
      setIsCustomCartesiaVoiceSelected(true);
      return;
    }
    setIsCustomCartesiaVoiceSelected(false);
    handleUpdateCartesiaSetting('voiceId', id);
  };

  const handleApplyCustomCartesiaVoiceId = () => {
    if (customCartesiaVoiceIdInput.trim()) {
      handleUpdateCartesiaSetting('voiceId', customCartesiaVoiceIdInput.trim());
      showSavedNotification('Custom Cartesia Voice ID applied');
    }
  };

  const handleUpdateGoogleSetting = <K extends keyof GoogleVoiceSettings>(
    key: K,
    val: GoogleVoiceSettings[K]
  ) => {
    const updated = { ...googleVoiceSettings, [key]: val };
    setGoogleVoiceSettings(updated);
    soundEngine.setGoogleVoiceSettings(updated);
    if (key === 'commentatorStyle') {
      setGoogleCommentatorPreset(val as string);
    } else {
      setGoogleCommentatorPreset('custom');
    }
    showSavedNotification();
  };

  const handleApplyGoogleCommentatorPreset = (presetName: 'play-by-play' | 'arena-pa' | 'dramatic' | 'color-analyst') => {
    let updates: Partial<GoogleVoiceSettings> = {
      commentatorStyle: presetName,
    };
    if (presetName === 'play-by-play') {
      updates = {
        voiceId: 'Puck',
        speed: 1.10,
        pitchCents: 20,
        commentatorStyle: 'play-by-play',
      };
    } else if (presetName === 'arena-pa') {
      updates = {
        voiceId: 'Puck',
        speed: 1.00,
        pitchCents: 0,
        commentatorStyle: 'arena-pa',
      };
    } else if (presetName === 'dramatic') {
      updates = {
        voiceId: 'Fenrir',
        speed: 1.15,
        pitchCents: 40,
        commentatorStyle: 'dramatic',
      };
    } else if (presetName === 'color-analyst') {
      updates = {
        voiceId: 'Charon',
        speed: 0.98,
        pitchCents: -30,
        commentatorStyle: 'color-analyst',
      };
    }
    const merged = { ...googleVoiceSettings, ...updates };
    setGoogleVoiceSettings(merged);
    soundEngine.setGoogleVoiceSettings(merged);
    setGoogleCommentatorPreset(presetName);
    setIsCustomGoogleVoiceSelected(false);
    if (merged.voiceId) {
      setCustomGoogleVoiceIdInput(merged.voiceId);
    }
    showSavedNotification(`Applied Google Commentator "${presetName}" style`);
  };

  const handleSelectGoogleVoiceId = (id: string) => {
    if (id === 'custom') {
      setIsCustomGoogleVoiceSelected(true);
      return;
    }
    setIsCustomGoogleVoiceSelected(false);
    handleUpdateGoogleSetting('voiceId', id);
  };

  const handleApplyCustomGoogleVoiceId = () => {
    if (customGoogleVoiceIdInput.trim()) {
      handleUpdateGoogleSetting('voiceId', customGoogleVoiceIdInput.trim());
      showSavedNotification('Custom Google Voice applied');
    }
  };

  const handleTestAnnouncerWithCurrentSettings = async () => {
    soundEngine.unlock();
    setIsTestingVoiceCustom(true);

    let testText = generateWelcomePrompt(visitorTeamName);
    if (testSampleType === 'pelhamGoal') {
      testText = 'Pelham Pelicans goal! Scored by number 9, Connor McDavid!';
    } else if (testSampleType === 'visitorGoal') {
      testText = `${visitorTeamName} goal! Scored by number 88, Patrick Kane!`;
    } else if (testSampleType === 'assist') {
      testText = 'Assisted by number 29, Leon Draisaitl!';
    }

    try {
      if (selectedProvider === 'cartesia') {
        await soundEngine.announce(testText, cartesiaSettings.voiceId);
      } else if (selectedProvider === 'google') {
        await soundEngine.announce(testText, googleVoiceSettings.voiceId);
      } else if (selectedProvider === 'webspeech') {
        await soundEngine.announce(testText, webSpeechSettings.voiceURI);
      } else {
        await soundEngine.announce(testText, voiceSettings.voiceId, voiceSettings);
      }
    } finally {
      setIsTestingVoiceCustom(false);
    }
  };

  const handleSaveVisitorName = () => {
    if (tempVisitorName.trim()) {
      onUpdateVisitorName(tempVisitorName.trim());
    }
    setIsEditingVisitorName(false);
  };

  const visitorInitials =
    visitorTeamName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'VT';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6 pb-28 sm:pb-32 custom-scrollbar overscroll-contain select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300">
              <Settings className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white uppercase font-athletic tracking-wide">
                Settings & Team Controls
              </h1>
              <p className="text-xs text-slate-400">
                Manage logos, audio announcer, team rosters, and game scores
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
            <span>Score:</span>
            <strong className="text-amber-400">PELHAM {homeGoals}</strong>
            <span>-</span>
            <strong className="text-rose-400">{visitorGoals} {visitorInitials}</strong>
          </div>
        </div>

        {/* SECTION 1: Team Logos & Branding */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-athletic flex items-center gap-2">
            <span>Team Logos & Active Rosters</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pelham Pelicans Logo Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                activeTeamTab === 'home'
                  ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Pelham Logo Badge */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg font-black text-2xl tracking-tight border bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-amber-500/20 text-slate-950 border-amber-300 shrink-0">
                    PP
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white uppercase font-athletic tracking-wider">
                        Pelham Pelicans
                      </h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        {homePlayers.length} ROSTER
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Home Team • Primary Roster
                    </p>
                    <div className="flex items-center gap-3 text-xs mt-2 text-slate-300 font-mono">
                      <span className="flex items-center gap-1 text-amber-400">
                        <Flame className="w-3.5 h-3.5" />
                        <strong>{homeGoals}</strong> Goals
                      </span>
                      <span className="flex items-center gap-1 text-sky-400">
                        <Award className="w-3.5 h-3.5" />
                        <strong>{homeAssists}</strong> Assists
                      </span>
                    </div>
                  </div>
                </div>

                {activeTeamTab === 'home' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Selected
                  </span>
                )}
              </div>

              {/* Action Buttons for Pelham */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenRosterModal('home')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Manage Lineup & Roster ({homePlayers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenScannerModal('home')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  <span>Scan Sticker File</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTeamTab('home')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium ml-auto"
                >
                  Go to Tracker →
                </button>
              </div>
            </div>

            {/* Visitor Team Logo Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                activeTeamTab === 'visitor'
                  ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-500/10'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Visitor Logo Badge */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg font-black text-2xl tracking-tight border bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 shadow-rose-500/20 text-white border-rose-400 shrink-0">
                    {visitorInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isEditingVisitorName ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={tempVisitorName}
                            onChange={(e) => setTempVisitorName(e.target.value)}
                            className="bg-slate-800 text-white font-bold text-xs px-2 py-1 rounded border border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveVisitorName}
                            className="p-1 rounded bg-rose-500 text-white text-xs"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-base font-black text-white uppercase font-athletic tracking-wider truncate">
                            {visitorTeamName}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setTempVisitorName(visitorTeamName);
                              setIsEditingVisitorName(true);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-300"
                            title="Rename Visitor Team"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-400/20 text-rose-300 border border-rose-400/30 shrink-0">
                        {visitorPlayers.length} ROSTER
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Visiting Team • Opponent Roster
                    </p>
                    <div className="flex items-center gap-3 text-xs mt-2 text-slate-300 font-mono">
                      <span className="flex items-center gap-1 text-rose-400">
                        <Flame className="w-3.5 h-3.5" />
                        <strong>{visitorGoals}</strong> Goals
                      </span>
                      <span className="flex items-center gap-1 text-sky-400">
                        <Award className="w-3.5 h-3.5" />
                        <strong>{visitorAssists}</strong> Assists
                      </span>
                    </div>
                  </div>
                </div>

                {activeTeamTab === 'visitor' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Selected
                  </span>
                )}
              </div>

              {/* Action Buttons for Visitor */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenRosterModal('visitor')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-rose-400" />
                  <span>Manage Lineup & Roster ({visitorPlayers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenScannerModal('visitor')}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-rose-400" />
                  <span>Scan Sticker File</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTeamTab('visitor')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium ml-auto"
                >
                  Go to Tracker →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: Game Rules & Penalty Time Duration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-athletic flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Game Rules: Penalty Time Duration</span>
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              Default: {gamePenaltyDuration.label}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Game Minor Penalty Duration</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Different leagues and age groups use different penalty times. Choose your game&apos;s standard penalty length so all penalty calls use this duration by default.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomPenaltyDurationOpen(!isCustomPenaltyDurationOpen)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 border border-slate-700 flex items-center gap-1.5 self-start sm:self-auto shrink-0 transition-colors"
              >
                {isCustomPenaltyDurationOpen ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Show Standard Presets</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Set Custom Time</span>
                  </>
                )}
              </button>
            </div>

            {/* Custom Penalty Stepper */}
            {isCustomPenaltyDurationOpen ? (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5" />
                    <span>Exact Custom Penalty Duration</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
                    {formatDurationDisplay(customPenaltyMinutes, customPenaltySeconds)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Minutes */}
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                      <span>Minutes</span>
                      <span className="text-amber-400 font-bold font-mono">{customPenaltyMinutes} min</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomPenaltyMinutes((m) => Math.max(0, m - 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={customPenaltyMinutes}
                        onChange={(e) => setCustomPenaltyMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="flex-1 text-center bg-slate-950 border border-slate-700 rounded-lg py-1 text-sm font-mono font-bold text-white focus:ring-amber-500 focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomPenaltyMinutes((m) => Math.min(60, m + 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {[0, 1, 2, 3, 4, 5, 10].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCustomPenaltyMinutes(m)}
                          className={`px-2 py-0.5 text-[10px] rounded-md font-semibold border ${
                            customPenaltyMinutes === m
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Seconds */}
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                      <span>Seconds</span>
                      <span className="text-amber-400 font-bold font-mono">
                        :{customPenaltySeconds < 10 ? '0' : ''}{customPenaltySeconds} sec
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomPenaltySeconds((s) => Math.max(0, s - 15))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
                      >
                        -15
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={customPenaltySeconds}
                        onChange={(e) => setCustomPenaltySeconds(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                        className="flex-1 text-center bg-slate-950 border border-slate-700 rounded-lg py-1 text-sm font-mono font-bold text-white focus:ring-amber-500 focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomPenaltySeconds((s) => Math.min(59, s + 15))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
                      >
                        +15
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {[0, 15, 30, 45].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCustomPenaltySeconds(s)}
                          className={`px-2 py-0.5 text-[10px] rounded-md font-semibold border ${
                            customPenaltySeconds === s
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          :{s < 10 ? '0' : ''}{s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400">
                    Spoken phrasing: &ldquo;<strong className="text-amber-300">{formatMinutesAndSecondsToSpoken(customPenaltyMinutes, customPenaltySeconds) || 'Without Time'}</strong>&rdquo;
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomGamePenalty}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
                  >
                    <Pin className="w-3.5 h-3.5" />
                    <span>Save as Game Penalty Duration</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Preset Durations Grid */
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {STANDARD_PENALTY_DURATIONS.map((opt) => {
                    const isSelected = gamePenaltyDuration.value === opt.value;
                    const isWithoutTime = opt.value === '';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectGamePenalty(opt)}
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? isWithoutTime
                              ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20 font-black ring-1 ring-rose-400'
                              : 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black ring-1 ring-amber-400'
                            : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight">{opt.label}</span>
                        <span
                          className={`text-[9px] mt-0.5 leading-none ${
                            isSelected
                              ? isWithoutTime
                                ? 'text-rose-100'
                                : 'text-slate-900 font-semibold'
                              : 'text-slate-500'
                          }`}
                        >
                          {opt.sublabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vocal Preview Info */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Announcements will say:</span>
              </span>
              <span className="font-mono text-amber-300 font-semibold text-right">
                {gamePenaltyDuration.value
                  ? `&ldquo;...${gamePenaltyDuration.value} for [infraction]&rdquo;`
                  : '&ldquo;...for [infraction]&rdquo; (no duration)'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Announcer Voice & Audio Settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-athletic flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>NHL Voice Announcer & Audio Settings</span>
            </h2>
            {saveBadgeText && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                ✓ {saveBadgeText}
              </span>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
            {/* Top Bar: Status & Mute */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Arena Play-by-Play Announcer</span>
                  </h3>
                  {selectedProvider === 'cartesia' ? (
                    voiceStatus?.cartesiaConfigured ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                        Cartesia Sonic Active ({activeCartesiaAccount === 'account1' ? 'Acc 1' : 'Acc 2'})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Cartesia (Local Browser Fallback)
                      </span>
                    )
                  ) : (
                    voiceStatus?.elevenLabsConfigured ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        ElevenLabs Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        ElevenLabs (Local Browser Fallback)
                      </span>
                    )
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Announces goals, assists, and penalties automatically using real-time vocal synthesis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="settings-mute-toggle-btn"
                  onClick={onToggleMute}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    isMuted
                      ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-4 h-4 text-red-400" />
                      <span>Sound is Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span>Sound is ON</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SECTION: Monthly Voice Credits & Auto-Switching (≤ 400 credits threshold) */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white tracking-wide">
                        Monthly Voice Credits & Auto-Switching
                      </h4>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Shuffle className="w-3 h-3 text-amber-400" />
                        Auto-switch threshold: ≤ {CREDIT_SWITCH_THRESHOLD} credits
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Monitors your monthly usage across ElevenLabs and Cartesia accounts. When active account drops to {CREDIT_SWITCH_THRESHOLD} or fewer credits, Pelham automatically switches to your next account.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSyncAllActualBalances}
                    disabled={isRefreshingCredits}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title="Calibrate all accounts to your actual balances: 130,000 for ElevenLabs, 120,000 for Cartesia 1, 19,000 for Cartesia 2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sync Actual Balances (130k / 120k / 19k)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRefreshCredits}
                    disabled={isRefreshingCredits}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title="Refresh current credit balance from provider APIs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCredits ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleAutoSwitch}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                      autoSwitchEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${autoSwitchEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                    <span>{autoSwitchEnabled ? 'Auto-Switch ON' : 'Auto-Switch OFF'}</span>
                  </button>
                </div>
              </div>

              {/* Auto-Switch Recent Alert Banner */}
              {lastAutoSwitchAlert && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2 text-amber-200">
                    <Shuffle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300">Account Auto-Switched: </span>
                      <span>{lastAutoSwitchAlert.reason}</span>
                      <span className="text-amber-400/80 text-[11px] block mt-0.5">
                        Active provider changed to{' '}
                        <strong>
                          {lastAutoSwitchAlert.toProvider === 'cartesia'
                            ? `Cartesia (${lastAutoSwitchAlert.toAccount === 'account2' ? 'Account 2' : 'Account 1'})`
                            : 'ElevenLabs'}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastAutoSwitchAlert(null)}
                    className="text-amber-400/70 hover:text-amber-300 text-xs font-bold px-1.5 py-0.5 rounded"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* 4 Voice Provider & Account Credit Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* CARD 1: ElevenLabs Account */}
                {(() => {
                  const el = creditsStatus?.elevenlabs || {
                    configured: Boolean(voiceStatus?.elevenLabsConfigured),
                    characterLimit: 150000,
                    characterCount: 20000,
                    remainingCredits: 130000,
                    isLowCredits: false,
                    source: 'calibrated',
                  };
                  const isCurrentActive = selectedProvider === 'elevenlabs';
                  const isLow = el.remainingCredits <= CREDIT_SWITCH_THRESHOLD;
                  const percent = el.characterLimit > 0
                    ? Math.max(0, Math.min(100, Math.round((el.remainingCredits / el.characterLimit) * 100)))
                    : 0;

                  return (
                    <div
                      className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isCurrentActive
                          ? 'bg-slate-900/90 border-amber-500/60 ring-1 ring-amber-500/30 shadow-md'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            <span className="text-xs font-bold text-white truncate">ElevenLabs</span>
                          </div>
                          {isCurrentActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">Ready</span>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">Remaining Monthly Credits</div>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className={`text-xl font-mono font-black ${isLow ? 'text-red-400' : 'text-white'}`}>
                              {el.remainingCredits.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              / {el.characterLimit.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isLow
                                ? 'bg-red-500'
                                : percent < 25
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{percent}% available</span>
                          <span>
                            {el.source === 'api'
                              ? 'Official API sync'
                              : el.source === 'calibrated' || el.source === 'manual'
                              ? 'Calibrated balance'
                              : 'Tracked usage'}
                          </span>
                        </div>

                        {isLow && (
                          <div className="p-1.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 text-[10px] font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span>≤ {CREDIT_SWITCH_THRESHOLD} credits: Switch triggered</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenBalanceEdit('elevenlabs')}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-medium underline-offset-2 hover:underline flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Calibrate Balance</span>
                        </button>
                        {!isCurrentActive && (
                          <button
                            type="button"
                            onClick={() => handleSwitchProvider('elevenlabs')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 shrink-0 transition-colors"
                          >
                            Use Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* CARD 2: Cartesia Account 1 */}
                {(() => {
                  const c1 = creditsStatus?.cartesiaAccount1 || {
                    configured: Boolean(voiceStatus?.cartesiaAccount1Configured),
                    characterLimit: 120000,
                    characterCount: 0,
                    remainingCredits: 120000,
                    isLowCredits: false,
                    source: 'calibrated',
                  };
                  const isCurrentActive = selectedProvider === 'cartesia' && activeCartesiaAccount === 'account1';
                  const isLow = c1.remainingCredits <= CREDIT_SWITCH_THRESHOLD;
                  const percent = c1.characterLimit > 0
                    ? Math.max(0, Math.min(100, Math.round((c1.remainingCredits / c1.characterLimit) * 100)))
                    : 0;

                  return (
                    <div
                      className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isCurrentActive
                          ? 'bg-slate-900/90 border-cyan-500/60 ring-1 ring-cyan-500/30 shadow-md'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                            <span className="text-xs font-bold text-white truncate">Cartesia Account 1</span>
                          </div>
                          {isCurrentActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">Acc 1</span>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">Remaining Monthly Credits</div>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className={`text-xl font-mono font-black ${isLow ? 'text-red-400' : 'text-white'}`}>
                              {c1.remainingCredits.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              / {c1.characterLimit.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isLow
                                ? 'bg-red-500'
                                : percent < 25
                                ? 'bg-amber-400'
                                : 'bg-cyan-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{percent}% available</span>
                          <span>
                            {c1.source === 'manual' || c1.source === 'calibrated' ? 'Calibrated balance' : 'Tracked usage'}
                          </span>
                        </div>

                        {isLow && (
                          <div className="p-1.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 text-[10px] font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span>≤ {CREDIT_SWITCH_THRESHOLD} credits: Switch triggered</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenBalanceEdit('cartesia1')}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium underline-offset-2 hover:underline flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Calibrate Balance</span>
                        </button>
                        {!isCurrentActive && (
                          <button
                            type="button"
                            onClick={() => {
                              handleSwitchProvider('cartesia');
                              handleSwitchCartesiaAccount('account1');
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 shrink-0 transition-colors"
                          >
                            Use Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* CARD 3: Cartesia Account 2 */}
                {(() => {
                  const c2 = creditsStatus?.cartesiaAccount2 || {
                    configured: Boolean(voiceStatus?.cartesiaAccount2Configured),
                    characterLimit: 20000,
                    characterCount: 1000,
                    remainingCredits: 19000,
                    isLowCredits: false,
                    source: 'calibrated',
                  };
                  const isCurrentActive = selectedProvider === 'cartesia' && activeCartesiaAccount === 'account2';
                  const isLow = c2.remainingCredits <= CREDIT_SWITCH_THRESHOLD;
                  const percent = c2.characterLimit > 0
                    ? Math.max(0, Math.min(100, Math.round((c2.remainingCredits / c2.characterLimit) * 100)))
                    : 0;

                  return (
                    <div
                      className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isCurrentActive
                          ? 'bg-slate-900/90 border-cyan-500/60 ring-1 ring-cyan-500/30 shadow-md'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                            <span className="text-xs font-bold text-white truncate">Cartesia Account 2</span>
                          </div>
                          {isCurrentActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">Acc 2</span>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">Remaining Monthly Credits</div>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className={`text-xl font-mono font-black ${isLow ? 'text-red-400' : 'text-white'}`}>
                              {c2.remainingCredits.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              / {c2.characterLimit.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isLow
                                ? 'bg-red-500'
                                : percent < 25
                                ? 'bg-amber-400'
                                : 'bg-cyan-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{percent}% available</span>
                          <span>
                            {c2.source === 'manual' || c2.source === 'calibrated' ? 'Calibrated balance' : 'Tracked usage'}
                          </span>
                        </div>

                        {isLow && (
                          <div className="p-1.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 text-[10px] font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span>≤ {CREDIT_SWITCH_THRESHOLD} credits: Switch triggered</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenBalanceEdit('cartesia2')}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium underline-offset-2 hover:underline flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Calibrate Balance</span>
                        </button>
                        {!isCurrentActive && (
                          <button
                            type="button"
                            onClick={() => {
                              handleSwitchProvider('cartesia');
                              handleSwitchCartesiaAccount('account2');
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 shrink-0 transition-colors"
                          >
                            Use Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* CARD 4: Browser WebSpeech (Native) */}
                {(() => {
                  const isCurrentActive = selectedProvider === 'webspeech';

                  return (
                    <div
                      className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isCurrentActive
                          ? 'bg-slate-900/90 border-violet-500/60 ring-1 ring-violet-500/30 shadow-md'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                            <span className="text-xs font-bold text-white truncate">WebSpeech (Native)</span>
                          </div>
                          {isCurrentActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 shrink-0">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">Native</span>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] text-slate-400">Available Usage & Quota</div>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl font-mono font-black text-violet-300">
                              Unlimited
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              / ∞ No Quota
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar (Always 100% full) */}
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-violet-400 w-full"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>100% available</span>
                          <span className="text-violet-400 font-medium">Free • Offline</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500">
                          Zero billing risk
                        </span>
                        {!isCurrentActive && (
                          <button
                            type="button"
                            onClick={() => handleSwitchProvider('webspeech')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 shrink-0 transition-colors"
                          >
                            Use Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Inline Balance Calibration Modal / Popover */}
              {editingAccount && (
                <div
                  className={`p-3.5 rounded-xl bg-slate-900 border space-y-3 mt-3 animate-fadeIn ${
                    editingAccount === 'elevenlabs' ? 'border-amber-500/50' : 'border-cyan-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Edit2
                        className={`w-3.5 h-3.5 ${
                          editingAccount === 'elevenlabs' ? 'text-amber-400' : 'text-cyan-400'
                        }`}
                      />
                      <span>
                        Calibrate{' '}
                        {editingAccount === 'elevenlabs'
                          ? 'ElevenLabs'
                          : editingAccount === 'cartesia1'
                          ? 'Cartesia Account 1'
                          : 'Cartesia Account 2'}{' '}
                        Credit Balance
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingAccount(null)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enter your actual remaining balance from your{' '}
                    {editingAccount === 'elevenlabs' ? 'ElevenLabs' : 'Cartesia'} dashboard. As goal, assist, and penalty
                    announcements play, character usage is automatically deducted. When balance falls to ≤{' '}
                    {CREDIT_SWITCH_THRESHOLD}, auto-switching seamlessly transfers announcements to your next account.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="2000000"
                      value={manualBalanceInput}
                      onChange={(e) => setManualBalanceInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                      placeholder={
                        editingAccount === 'elevenlabs'
                          ? '130000'
                          : editingAccount === 'cartesia1'
                          ? '120000'
                          : '19000'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveBalance(editingAccount)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs text-slate-950 transition-colors ${
                        editingAccount === 'elevenlabs'
                          ? 'bg-amber-400 hover:bg-amber-300'
                          : 'bg-cyan-400 hover:bg-cyan-300'
                      }`}
                    >
                      Save Balance
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 self-center mr-1">Presets:</span>
                    {(editingAccount === 'elevenlabs'
                      ? [
                          { label: '130,000 (Actual)', val: 130000 },
                          { label: '150,000', val: 150000 },
                          { label: '100,000', val: 100000 },
                          { label: '50,000', val: 50000 },
                          { label: '400 (Test Switch)', val: 400 },
                          { label: '0 (Depleted)', val: 0 },
                        ]
                      : editingAccount === 'cartesia1'
                      ? [
                          { label: '120,000 (Actual)', val: 120000 },
                          { label: '100,000', val: 100000 },
                          { label: '60,000', val: 60000 },
                          { label: '20,000', val: 20000 },
                          { label: '400 (Test Switch)', val: 400 },
                          { label: '0 (Depleted)', val: 0 },
                        ]
                      : [
                          { label: '19,000 (Actual)', val: 19000 },
                          { label: '20,000', val: 20000 },
                          { label: '10,000', val: 10000 },
                          { label: '5,000', val: 5000 },
                          { label: '400 (Test Switch)', val: 400 },
                          { label: '0 (Depleted)', val: 0 },
                        ]
                    ).map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setManualBalanceInput(String(p.val))}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* TTS PROVIDER SWITCHER */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  <span>Choose Voice Announcer Engine</span>
                </label>
                <span className="text-[11px] text-slate-400">Switch anytime between providers</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Provider 1: ElevenLabs */}
                <button
                  type="button"
                  id="select-provider-elevenlabs"
                  onClick={() => handleSwitchProvider('elevenlabs')}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    selectedProvider === 'elevenlabs'
                      ? 'bg-amber-500/15 border-amber-500/70 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                          selectedProvider === 'elevenlabs'
                            ? 'border-amber-400 bg-amber-400'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {selectedProvider === 'elevenlabs' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white">ElevenLabs</span>
                    </div>
                    {voiceStatus?.elevenLabsConfigured ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Ready
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Fallback
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    Deep, resonant NHL stadium announcer voicing.
                  </p>
                </button>

                {/* Provider 2: Cartesia Sonic */}
                <button
                  type="button"
                  id="select-provider-cartesia"
                  onClick={() => handleSwitchProvider('cartesia')}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    selectedProvider === 'cartesia'
                      ? 'bg-cyan-500/15 border-cyan-500/70 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                          selectedProvider === 'cartesia'
                            ? 'border-cyan-400 bg-cyan-400'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {selectedProvider === 'cartesia' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">Cartesia Sonic</span>
                      </div>
                    </div>
                    {voiceStatus?.cartesiaConfigured ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        {activeCartesiaAccount === 'account1' ? 'Acc 1' : 'Acc 2'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Fallback
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    Ultra-low latency real-time voice with high-energy emotional delivery & 2 accounts.
                  </p>
                </button>

                {/* Provider 3: Google TTS (Natural Sport Commentator) */}
                <button
                  type="button"
                  id="select-provider-google"
                  onClick={() => handleSwitchProvider('google')}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    selectedProvider === 'google'
                      ? 'bg-emerald-500/15 border-emerald-500/70 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                          selectedProvider === 'google'
                            ? 'border-emerald-400 bg-emerald-400'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {selectedProvider === 'google' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">Google TTS</span>
                      </div>
                    </div>
                    {voiceStatus?.googleConfigured ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Sport AI
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Ready
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    Natural sport commentator voice with fast play-by-play and energetic hockey goal calls.
                  </p>
                </button>

                {/* Provider 4: Browser WebSpeech (Native) */}
                <button
                  type="button"
                  id="select-provider-webspeech"
                  onClick={() => handleSwitchProvider('webspeech')}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    selectedProvider === 'webspeech'
                      ? 'bg-violet-500/15 border-violet-500/70 text-white shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/40'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                          selectedProvider === 'webspeech'
                            ? 'border-violet-400 bg-violet-400'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {selectedProvider === 'webspeech' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">WebSpeech</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                      Unlimited
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    Browser native speech. 100% free, zero quota limits, works offline without API keys.
                  </p>
                </button>
              </div>
            </div>

            {/* CONDITIONAL PANEL: CARTESIA SONIC SETTINGS */}
            {selectedProvider === 'cartesia' && (
              <div className="space-y-4">
                {/* Cartesia Multi-Account Switcher */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Active Cartesia Account</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Switch instantly between your two Cartesia accounts
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      id="cartesia-account-1-btn"
                      onClick={() => handleSwitchCartesiaAccount('account1')}
                      className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all ${
                        activeCartesiaAccount === 'account1'
                          ? 'bg-cyan-500/20 border-cyan-500/70 text-cyan-200 ring-1 ring-cyan-500/40 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${activeCartesiaAccount === 'account1' ? 'bg-cyan-400' : 'bg-slate-600'}`}></span>
                          Account 1 (Primary)
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">CARTESIA_API_KEY</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        voiceStatus?.cartesiaAccount1Configured
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {voiceStatus?.cartesiaAccount1Configured ? 'Ready' : 'Not configured'}
                      </span>
                    </button>

                    <button
                      type="button"
                      id="cartesia-account-2-btn"
                      onClick={() => handleSwitchCartesiaAccount('account2')}
                      className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all ${
                        activeCartesiaAccount === 'account2'
                          ? 'bg-cyan-500/20 border-cyan-500/70 text-cyan-200 ring-1 ring-cyan-500/40 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${activeCartesiaAccount === 'account2' ? 'bg-cyan-400' : 'bg-slate-600'}`}></span>
                          Account 2 (Secondary)
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">CARTESIA_API_KEY_2</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        voiceStatus?.cartesiaAccount2Configured
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {voiceStatus?.cartesiaAccount2Configured ? 'Ready' : 'Not configured'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Vercel Setup Notice when not configured */}
                {!voiceStatus?.cartesiaConfigured && (
                  <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-cyan-300">
                        <Key className="w-4 h-4 text-cyan-400" />
                        <span>Vercel Configuration: CARTESIA_API_KEY Required</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/50">
                        Vercel Env Var
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      To activate Cartesia Sonic ultra-realistic voices on your Vercel deployment:
                    </p>
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">1. Variable Name:</span>
                        <code className="text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 selection:bg-cyan-600">
                          CARTESIA_API_KEY (or CARTESIA_API_KEY_2)
                        </code>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">2. Location:</span>
                        <span className="text-slate-300 font-sans">Vercel Dashboard &rarr; Project Settings &rarr; Environment Variables</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">3. Next Step:</span>
                        <span className="text-amber-300 font-sans">Save &amp; trigger a <strong>Redeploy</strong> to apply</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Until configured, game and test announcements seamlessly use your browser's built-in vocal engine.
                    </p>
                  </div>
                )}

                {/* Cartesia Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Cartesia Sonic Announcer Presets</span>
                    </label>
                    <span className="text-[11px] text-slate-500">Instant energy and style profiles</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyCartesiaPreset('arena')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        cartesiaPreset === 'arena'
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>⚡ Arena Sonic Turbo</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.10x Speed • Excited • +40 Pitch</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyCartesiaPreset('deep')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        cartesiaPreset === 'deep'
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🎙️ Stadium Boom</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">0.95x Speed • Authoritative • -120 Pitch</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyCartesiaPreset('rapid')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        cartesiaPreset === 'rapid'
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🚀 Rapid Play-by-Play</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.20x Speed • Excited • +60 Pitch</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyCartesiaPreset('classic')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        cartesiaPreset === 'classic'
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>📻 Classic Broadcast</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.00x Speed • Neutral • 0 Pitch</div>
                    </button>
                  </div>
                </div>

                {/* Cartesia Voice Selection */}
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Cartesia Voice Persona / Voice ID</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {CARTESIA_PRESET_VOICES.map((v) => {
                      const isSelected = !isCustomCartesiaVoiceSelected && cartesiaSettings.voiceId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectCartesiaVoiceId(v.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 ring-1 ring-cyan-500/40'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold text-white truncate">{v.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{v.desc}</div>
                        </button>
                      );
                    })}

                    {/* Custom Cartesia Voice Option */}
                    <button
                      type="button"
                      onClick={() => setIsCustomCartesiaVoiceSelected(true)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isCustomCartesiaVoiceSelected
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">⚙️ Custom Voice UUID</div>
                      <div className="text-[10px] text-slate-400 truncate">Enter any Cartesia Voice ID</div>
                    </button>
                  </div>

                  {/* Custom Cartesia Voice Input */}
                  {isCustomCartesiaVoiceSelected && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-300">
                        Paste your Cartesia Voice ID (UUID from play.cartesia.ai):
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customCartesiaVoiceIdInput}
                          onChange={(e) => setCustomCartesiaVoiceIdInput(e.target.value)}
                          placeholder="e.g. 694f9389-aac1-45b6-b726-9d9369183238"
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomCartesiaVoiceId}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
                        >
                          Apply Voice ID
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cartesia Emotion & Delivery Style */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Cartesia Delivery Emotion</span>
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono">Dynamic Expression</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'excited', label: '🔥 Excited', desc: 'Goal calls & game explosions' },
                      { id: 'optimistic', label: '⚡ Optimistic', desc: 'Pre-game welcome & rosters' },
                      { id: 'authoritative', label: '🛡️ Authoritative', desc: 'Penalties & official rules' },
                      { id: 'neutral', label: '🎙️ Neutral', desc: 'Standard sports broadcast' },
                    ].map((em) => (
                      <button
                        key={em.id}
                        type="button"
                        onClick={() => handleUpdateCartesiaSetting('emotion', em.id as any)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          cartesiaSettings.emotion === em.id
                            ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 ring-1 ring-cyan-500/40'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white">{em.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{em.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cartesia Core Sliders: Speed and Pitch */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* SPEED SLIDER */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Speech Speed (Tempo)</span>
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {cartesiaSettings.speed.toFixed(2)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.70"
                      max="1.35"
                      step="0.05"
                      value={cartesiaSettings.speed}
                      onChange={(e) => handleUpdateCartesiaSetting('speed', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0.70x (Deliberate)</span>
                      <span>1.00x (Standard)</span>
                      <span>1.35x (Fast Arena)</span>
                    </div>
                  </div>

                  {/* PITCH SLIDER */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Pitch Tuning (Detune)</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {cartesiaSettings.pitchCents === 0
                            ? '0 cents (Standard)'
                            : `${cartesiaSettings.pitchCents > 0 ? '+' : ''}${cartesiaSettings.pitchCents} cents`}
                        </span>
                        {cartesiaSettings.pitchCents !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleUpdateCartesiaSetting('pitchCents', 0)}
                            className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"
                            title="Reset pitch to 0"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="range"
                      min="-500"
                      max="500"
                      step="25"
                      value={cartesiaSettings.pitchCents}
                      onChange={(e) => handleUpdateCartesiaSetting('pitchCents', parseInt(e.target.value, 10))}
                      className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>-500 cents (Deeper)</span>
                      <span>0 (Standard)</span>
                      <span>+500 cents (Higher)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONDITIONAL PANEL: ELEVENLABS SETTINGS */}
            {selectedProvider === 'elevenlabs' && (
              <div className="space-y-4">
                {/* Vercel Setup Notice when not configured */}
                {!voiceStatus?.elevenLabsConfigured && (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-amber-300">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span>Vercel Configuration: ELEVENLABS_API_KEY Required</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                        Vercel Env Var
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      To activate ElevenLabs AI arena voices on your Vercel deployment:
                    </p>
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">1. Variable Name:</span>
                        <code className="text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60 selection:bg-amber-600">
                          ELEVENLABS_API_KEY
                        </code>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">2. Location:</span>
                        <span className="text-slate-300 font-sans">Vercel Dashboard &rarr; Project Settings &rarr; Environment Variables</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">3. Next Step:</span>
                        <span className="text-amber-300 font-sans">Save &amp; trigger a <strong>Redeploy</strong> to apply</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Until configured, game and test announcements seamlessly use your browser's built-in vocal engine.
                    </p>
                  </div>
                )}

                {/* Voice Tuning Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>ElevenLabs Style Presets</span>
                    </label>
                    <span className="text-[11px] text-slate-500">Quickly apply tailored voice profiles</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('arena')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        activePreset === 'arena'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>⚡ Arena High-Energy</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.05x Speed • +40 Pitch</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyPreset('deep')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        activePreset === 'deep'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🎙️ Deep Stadium Boom</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">0.95x Speed • -150 Pitch</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyPreset('rapid')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        activePreset === 'rapid'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🚀 Rapid Play-by-Play</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.15x Speed • +80 Pitch</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyPreset('classic')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        activePreset === 'classic'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>📻 Classic Broadcast</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.00x Speed • 0 Pitch</div>
                    </button>
                  </div>
                </div>

                {/* Voice Model / Persona Selection */}
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-sky-400" />
                    <span>Voice Persona / ElevenLabs Voice ID</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {PRESET_VOICES.map((v) => {
                      const isSelected = !isCustomVoiceSelected && voiceSettings.voiceId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectVoiceId(v.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 ring-1 ring-sky-500/40'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold text-white truncate">{v.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{v.desc}</div>
                        </button>
                      );
                    })}

                    {/* Custom Voice Option */}
                    <button
                      type="button"
                      onClick={() => setIsCustomVoiceSelected(true)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isCustomVoiceSelected
                          ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 ring-1 ring-sky-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">⚙️ Custom Voice ID</div>
                      <div className="text-[10px] text-slate-400 truncate">Enter your own ElevenLabs ID</div>
                    </button>
                  </div>

                  {/* Custom Voice Input */}
                  {isCustomVoiceSelected && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-300">
                        Paste your ElevenLabs Voice ID from elevenlabs.io:
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customVoiceIdInput}
                          onChange={(e) => setCustomVoiceIdInput(e.target.value)}
                          placeholder="e.g. 6j98Cb2txyqvHRXeRQYZ"
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomVoiceId}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
                        >
                          Apply Voice ID
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Core Sliders: Speed and Pitch */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                  {/* SPEED SLIDER */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span>Speech Speed (Tempo)</span>
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {voiceSettings.speed.toFixed(2)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.70"
                      max="1.30"
                      step="0.05"
                      value={voiceSettings.speed}
                      onChange={(e) => handleUpdateSetting('speed', parseFloat(e.target.value))}
                      className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0.70x (Deliberate)</span>
                      <span>1.00x (Normal)</span>
                      <span>1.30x (Fast Arena)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Tuning speech pace for hockey announcements. 1.05x delivers authentic arena urgency.
                    </p>
                  </div>

                  {/* PITCH SLIDER */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Pitch Tuning (Detune)</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {voiceSettings.pitchCents === 0
                            ? '0 cents (Standard)'
                            : `${voiceSettings.pitchCents > 0 ? '+' : ''}${voiceSettings.pitchCents} cents (${(
                                voiceSettings.pitchCents / 100
                              ).toFixed(2)} st)`}
                        </span>
                        {voiceSettings.pitchCents !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleUpdateSetting('pitchCents', 0)}
                            className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"
                            title="Reset pitch to 0"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="range"
                      min="-500"
                      max="500"
                      step="25"
                      value={voiceSettings.pitchCents}
                      onChange={(e) => handleUpdateSetting('pitchCents', parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>-500 cents (Deeper)</span>
                      <span>0 (Standard)</span>
                      <span>+500 cents (Higher)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Pitch modulation in musical cents (100 cents = 1 semitone). Negative values create deep stadium resonance.
                    </p>
                  </div>
                </div>

                {/* Advanced Voice Personality Dynamics */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span>ElevenLabs Voice Dynamics & Style</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Synthesis Engine</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Stability */}
                    <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300">Stability:</span>
                        <span className="font-mono font-bold text-purple-300">
                          {Math.round(voiceSettings.stability * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={voiceSettings.stability}
                        onChange={(e) => handleUpdateSetting('stability', parseFloat(e.target.value))}
                        className="w-full accent-purple-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Lower = more expressive energy. Higher = steady consistency.
                      </p>
                    </div>

                    {/* Similarity */}
                    <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300">Clarity & Likeness:</span>
                        <span className="font-mono font-bold text-sky-300">
                          {Math.round(voiceSettings.similarity_boost * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={voiceSettings.similarity_boost}
                        onChange={(e) => handleUpdateSetting('similarity_boost', parseFloat(e.target.value))}
                        className="w-full accent-sky-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Higher values reproduce the original announcer voice character.
                      </p>
                    </div>

                    {/* Style */}
                    <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300">Style Exaggeration:</span>
                        <span className="font-mono font-bold text-rose-300">
                          {Math.round(voiceSettings.style * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={voiceSettings.style}
                        onChange={(e) => handleUpdateSetting('style', parseFloat(e.target.value))}
                        className="w-full accent-rose-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Amplifies dramatic inflection and arena hockey enthusiasm.
                      </p>
                    </div>
                  </div>

                  {/* Speaker Boost Checkbox */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={voiceSettings.use_speaker_boost}
                        onChange={(e) => handleUpdateSetting('use_speaker_boost', e.target.checked)}
                        className="w-4 h-4 rounded accent-amber-400 bg-slate-800 border-slate-700"
                      />
                      <span className="text-xs font-semibold text-slate-200">
                        Speaker Boost (Optimized for Arena Stadium Audio)
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-500">Improves voice presence and cutoff punch</span>
                  </div>
                </div>
              </div>
            )}

            {/* Google Natural Sport Commentator Configuration Panel */}
            {selectedProvider === 'google' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-xl shadow-emerald-950/20 space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                      <Radio className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white uppercase tracking-wider font-athletic">
                          Google Natural Sport Commentator
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Hockey Audio
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        High-energy hockey play-by-play, aggressive goal shouts & stadium public address commentary
                      </p>
                    </div>
                  </div>

                  {/* Engine Status Badge */}
                  <div className="flex items-center gap-2">
                    {voiceStatus?.googleConfigured ? (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Gemini Natural AI Connected</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ready (Natural Browser Fallback)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Commentary Style Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Hockey Commentary Style Presets</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Instant Tuning</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyGoogleCommentatorPreset('play-by-play')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        googleCommentatorPreset === 'play-by-play'
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>⚡ Rapid Play-by-Play</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.10x • +20 Pitch • Puck</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyGoogleCommentatorPreset('arena-pa')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        googleCommentatorPreset === 'arena-pa'
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🎙️ Arena PA Host</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.00x • 0 Pitch • Puck</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyGoogleCommentatorPreset('dramatic')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        googleCommentatorPreset === 'dramatic'
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🔥 Overtime Thriller</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">1.15x • +40 Pitch • Fenrir</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyGoogleCommentatorPreset('color-analyst')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        googleCommentatorPreset === 'color-analyst'
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🎧 Veteran Analyst</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">0.98x • -30 Pitch • Charon</div>
                    </button>
                  </div>
                </div>

                {/* Google Commentator Voice Selection */}
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sport Commentator Voice Persona</span>
                    </label>
                    <span className="text-[10px] text-emerald-400/90 font-medium">Gemini 3.1 & Cloud TTS</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {GOOGLE_PRESET_VOICES.map((v) => {
                      const isSelected = !isCustomGoogleVoiceSelected && googleVoiceSettings.voiceId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectGoogleVoiceId(v.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all relative ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/40'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="text-xs font-bold text-white truncate">{v.name}</div>
                            {v.badge && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                {v.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{v.desc}</div>
                          <div className="text-[9px] text-emerald-400/70 font-mono mt-1">{v.engine}</div>
                        </button>
                      );
                    })}

                    {/* Custom Google Voice Option */}
                    <button
                      type="button"
                      onClick={() => setIsCustomGoogleVoiceSelected(true)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isCustomGoogleVoiceSelected
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">⚙️ Custom Voice Model</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">Enter any Gemini or Google Voice</div>
                      <div className="text-[9px] text-slate-500 font-mono mt-1">Manual ID</div>
                    </button>
                  </div>

                  {/* Custom Google Voice Input */}
                  {isCustomGoogleVoiceSelected && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-300">
                        Enter Voice Name or Model (e.g. Puck, Fenrir, Charon, en-US-Journey-O, en-US-Studio-O):
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customGoogleVoiceIdInput}
                          onChange={(e) => setCustomGoogleVoiceIdInput(e.target.value)}
                          placeholder="e.g. Puck"
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCustomGoogleVoiceId}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shrink-0"
                        >
                          Apply Voice
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Speed & Pitch Detune Sliders */}
                <div className="space-y-3 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Commentator Tempo & Pitch Modulation</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Acoustic Control</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Speed / Pace */}
                    <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300">Play-by-Play Tempo:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {googleVoiceSettings.speed.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.70"
                        max="1.40"
                        step="0.05"
                        value={googleVoiceSettings.speed}
                        onChange={(e) => handleUpdateGoogleSetting('speed', parseFloat(e.target.value))}
                        className="w-full accent-emerald-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Faster tempo (1.10x–1.20x) captures rapid hockey puck turnover excitement.
                      </p>
                    </div>

                    {/* Pitch Detune */}
                    <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300">Pitch Detune:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {googleVoiceSettings.pitchCents > 0 ? `+${googleVoiceSettings.pitchCents}` : googleVoiceSettings.pitchCents} cents
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-400"
                        max="400"
                        step="25"
                        value={googleVoiceSettings.pitchCents}
                        onChange={(e) => handleUpdateGoogleSetting('pitchCents', parseInt(e.target.value, 10))}
                        className="w-full accent-emerald-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Elevated pitch (+20 to +50 cents) creates stadium urgency for sudden goal moments.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Browser WebSpeech (Native) Configuration Panel */}
            {selectedProvider === 'webspeech' && (() => {
              const naturalMaleVoices = availableBrowserVoices.filter((v) => isNaturalMaleVoice(v));
              const otherVoices = availableBrowserVoices.filter((v) => !isNaturalMaleVoice(v));
              const currentVoice = availableBrowserVoices.find(
                (v) => v.voiceURI === webSpeechSettings.voiceURI || v.name === webSpeechSettings.voiceURI
              );
              const isCurrentVoiceMale = currentVoice ? isNaturalMaleVoice(currentVoice) : true;

              return (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-violet-500/30 shadow-xl shadow-violet-950/20 space-y-5">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-inner">
                        <Volume2 className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-white uppercase tracking-wider font-athletic">
                            Browser WebSpeech (Native Device Voices)
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                            100% Free & Unlimited
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Synthesizes audio entirely inside your browser using your operating system's installed voices. Zero quota, zero costs, and zero API keys.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/40 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
                        <span>Zero Quota Limits • Always Available</span>
                      </span>
                    </div>
                  </div>

                  {/* Natural Man Voice Presets Section */}
                  <div className="space-y-3 bg-violet-950/20 border border-violet-500/30 p-4 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-violet-400" />
                            <span>Natural Man Voice Commentator Presets</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Sports PA Recommended
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Matches the masculine, energetic arena commentator tone of ElevenLabs and Google natural announcers.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAutoPickBestNaturalMaleVoice}
                        className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-md shadow-violet-500/20"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Auto-Pick Best Natural Man Voice</span>
                      </button>
                    </div>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {POPULAR_NATURAL_MALE_PRESETS.map((preset) => {
                        const isInstalled = availableBrowserVoices.some((v) => {
                          const combined = `${v.name} ${v.voiceURI}`.toLowerCase();
                          return preset.keywords.some((k) => combined.includes(k));
                        });

                        const isCurrentlySelected =
                          currentVoice &&
                          preset.keywords.some((k) => `${currentVoice.name} ${currentVoice.voiceURI}`.toLowerCase().includes(k));

                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectNaturalMalePreset(preset)}
                            className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-1.5 ${
                              isCurrentlySelected
                                ? 'bg-violet-500/20 border-violet-500 text-white shadow-md shadow-violet-950/40 ring-1 ring-violet-500/50'
                                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-violet-500/40 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                                <span>🎙️</span>
                                <span className="truncate">{preset.name}</span>
                              </span>
                              {isCurrentlySelected ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500 text-slate-950 shrink-0">
                                  ACTIVE
                                </span>
                              ) : isInstalled ? (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                  On Device
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-500 shrink-0">
                                  {preset.platform}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                              {preset.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Voice Selection Dropdown */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-violet-400" />
                        <span>Select Installed Device Voice</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {isCurrentVoiceMale ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <span>✓</span>
                            <span>Natural Man Voice Active</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            {availableBrowserVoices.length} voices detected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <select
                        id="webspeech-voice-select"
                        value={webSpeechSettings.voiceURI}
                        onChange={(e) => handleUpdateWebSpeechSetting('voiceURI', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 font-sans"
                      >
                        {naturalMaleVoices.length > 0 && (
                          <optgroup label="🎙️ Natural Man Commentator Voices (Recommended)">
                            {naturalMaleVoices.map((v) => (
                              <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                                🎙️ {v.name} ({v.lang}) {v.localService ? '• Local' : '• Online'} [Natural Male]
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label={naturalMaleVoices.length > 0 ? "Other Installed Voices" : "Installed Voices"}>
                          {otherVoices.map((v) => (
                            <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                              {v.name} ({v.lang}) {v.localService ? '• Local' : '• Online'}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
                        <span>
                          {currentVoice ? (
                            <>
                              Currently using: <strong className="text-violet-300">{currentVoice.name}</strong> ({currentVoice.lang})
                            </>
                          ) : (
                            'Auto-selecting natural male voice on device.'
                          )}
                        </span>
                        <span className="text-slate-500">
                          {naturalMaleVoices.length} natural male voice{naturalMaleVoices.length === 1 ? '' : 's'} available
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Speed & Pitch Controls */}
                  <div className="space-y-3 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-violet-400" />
                        <span>WebSpeech Pace & Pitch Modulation</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleResetWebSpeechSettings}
                        className="text-[11px] text-slate-400 hover:text-white transition-colors"
                      >
                        Reset Natural Man Defaults
                      </button>
                    </div>

                    {/* Quick Pitch Timbre Presets for Hockey PA */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Arena Timbre:</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateWebSpeechSetting('pitch', 0.85)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                          Math.abs(webSpeechSettings.pitch - 0.85) < 0.03
                            ? 'bg-violet-500 text-slate-950 border-violet-400 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Deep Baritone (0.85x)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateWebSpeechSetting('pitch', 0.95)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                          Math.abs(webSpeechSettings.pitch - 0.95) < 0.03
                            ? 'bg-violet-500 text-slate-950 border-violet-400 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Natural Sports PA (0.95x)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateWebSpeechSetting('pitch', 1.00)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                          Math.abs(webSpeechSettings.pitch - 1.00) < 0.03
                            ? 'bg-violet-500 text-slate-950 border-violet-400 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Standard Pitch (1.00x)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateWebSpeechSetting('pitch', 1.10)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                          Math.abs(webSpeechSettings.pitch - 1.10) < 0.03
                            ? 'bg-violet-500 text-slate-950 border-violet-400 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Goal Excitement (1.10x)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Speed / Pace */}
                      <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-300">Speech Rate:</span>
                          <span className="font-mono font-bold text-violet-400">
                            {webSpeechSettings.speed.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.60"
                          max="1.50"
                          step="0.05"
                          value={webSpeechSettings.speed}
                          onChange={(e) => handleUpdateWebSpeechSetting('speed', parseFloat(e.target.value))}
                          className="w-full accent-violet-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Hockey pace recommendation: 1.05x to 1.15x for energetic goal shouts.
                        </p>
                      </div>

                      {/* Pitch */}
                      <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-300">Voice Pitch:</span>
                          <span className="font-mono font-bold text-violet-400">
                            {webSpeechSettings.pitch.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.60"
                          max="1.50"
                          step="0.05"
                          value={webSpeechSettings.pitch}
                          onChange={(e) => handleUpdateWebSpeechSetting('pitch', parseFloat(e.target.value))}
                          className="w-full accent-violet-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Masculine sport announcer timbre: 0.85x to 0.95x gives an authentic arena baritone resonance.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Test Announcer Bar & Reset Defaults */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Preview Announcer with Current Voice Settings:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTestSampleType('welcome')}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                      testSampleType === 'welcome'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <span>🎙️ Welcome ({visitorTeamName})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSampleType('pelhamGoal')}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                      testSampleType === 'pelhamGoal'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    🚨 Pelham Goal Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSampleType('visitorGoal')}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                      testSampleType === 'visitorGoal'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    🚨 {visitorTeamName} Goal
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSampleType('assist')}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                      testSampleType === 'assist'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    🏒 Assist Call
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-medium transition-colors"
                >
                  Reset Defaults
                </button>

                <button
                  type="button"
                  id="settings-test-custom-voice-btn"
                  onClick={handleTestAnnouncerWithCurrentSettings}
                  disabled={isTestingVoiceCustom || isAnnouncing}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50 ${
                    selectedProvider === 'cartesia'
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                      : selectedProvider === 'google'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                      : selectedProvider === 'webspeech'
                      ? 'bg-violet-500 hover:bg-violet-400 text-slate-950 shadow-violet-500/20'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isTestingVoiceCustom || isAnnouncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isTestingVoiceCustom || isAnnouncing
                      ? 'Announcing...'
                      : `Test ${
                          selectedProvider === 'cartesia'
                            ? 'Cartesia Sonic'
                            : selectedProvider === 'google'
                            ? 'Google Commentator'
                            : selectedProvider === 'webspeech'
                            ? 'Browser WebSpeech'
                            : 'ElevenLabs'
                        } Voice`}
                  </span>
                </button>
              </div>
            </div>

            {/* Current / Recent Announcement display */}
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Latest Play Announcement:</span>
                </span>
                {currentAnnouncement && (
                  <button
                    type="button"
                    onClick={onReplayAnnouncement}
                    disabled={isAnnouncing || isTestingVoiceCustom}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isAnnouncing || isTestingVoiceCustom ? 'animate-spin' : ''}`} />
                    <span>Replay Announcement</span>
                  </button>
                )}
              </div>

              <div
                className={`p-3 rounded-lg border text-xs transition-all ${
                  isAnnouncing || isTestingVoiceCustom
                    ? 'bg-amber-950/40 border-amber-500/60 text-slate-100 shadow-md shadow-amber-500/10'
                    : currentAnnouncement
                    ? 'bg-slate-950 border-slate-800 text-slate-300'
                    : 'bg-slate-950/50 border-slate-800/80 text-slate-500 italic'
                }`}
              >
                {currentAnnouncement ? (
                  <div>
                    <span className="font-bold uppercase tracking-wider text-amber-400 mr-2">
                      {currentAnnouncement.type === 'goal'
                        ? '🚨 GOAL CALL:'
                        : currentAnnouncement.type === 'penalty'
                        ? '⚖️ PENALTY CALL:'
                        : currentAnnouncement.type === 'welcome'
                        ? '🎙️ WELCOME ANNOUNCEMENT:'
                        : '🏒 ASSIST CALL:'}
                    </span>
                    &ldquo;{currentAnnouncement.text}&rdquo;
                  </div>
                ) : (
                  <span>No announcement recorded yet. Tap + on any player or test the announcer above.</span>
                )}
              </div>

              {voiceFeedback && (
                <div
                  className={`mt-2 text-xs px-3 py-1.5 rounded-lg border flex items-center justify-between ${
                    voiceFeedback.type === 'success'
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                      : voiceFeedback.type === 'warning'
                      ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                      : 'bg-blue-950/70 text-blue-300 border-blue-500/40'
                  }`}
                >
                  <span className="truncate">{voiceFeedback.message}</span>
                  <span className="text-[10px] opacity-70 ml-2 font-mono shrink-0">audio engine</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Game Reset & Match Management */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-athletic flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Match Reset & Data Management</span>
          </h2>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Reset Game Scoreboard</h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-md">
                Resets all goal and assist tallies back to 0 for both Pelham Pelicans and the Visiting team. Player names and numbers are retained.
              </p>
            </div>

            <button
              type="button"
              id="settings-reset-game-btn"
              onClick={onOpenResetModal}
              className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 hover:border-rose-400 font-bold text-xs flex items-center gap-2 transition-all shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Game Scores</span>
            </button>
          </div>
        </div>

        {/* SECTION 4: Display & Full-Screen Arena Mode */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-athletic flex items-center gap-2">
            <Maximize className="w-3.5 h-3.5 text-amber-400" />
            <span>Display & Full-Screen Arena Mode</span>
          </h2>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Full-Screen Display</h3>
                {isFullscreen && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    Full Screen Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-md">
                Maximize the application into an immersive arena display for stadium monitors, tablets, and rinkside laptops. Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] border border-slate-700 text-slate-300">Esc</kbd> anytime to exit.
              </p>
            </div>

            {onToggleFullscreen && (
              <button
                type="button"
                id="settings-fullscreen-btn"
                onClick={onToggleFullscreen}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
                  isFullscreen
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                }`}
              >
                {isFullscreen ? (
                  <>
                    <Minimize className="w-4 h-4" />
                    <span>Exit Full Screen</span>
                  </>
                ) : (
                  <>
                    <Maximize className="w-4 h-4" />
                    <span>Enter Full Screen</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* System Info Note */}
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-500 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Rosters and custom team names automatically save to local browser storage. All roster slots are dynamically updated and sorted by number.
          </span>
        </div>
      </div>
    </div>
  );
};
