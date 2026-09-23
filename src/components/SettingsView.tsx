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
  Copy,
  Layers,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ArrowRightLeft,
  Play,
} from 'lucide-react';
import { Announcement, VoiceStatus, Player, ElevenLabsVoiceSettings, CartesiaVoiceSettings, TTSProvider } from '../types';
import { soundEngine, DEFAULT_VOICE_SETTINGS, DEFAULT_CARTESIA_VOICE_SETTINGS, generateWelcomePrompt } from '../utils/audio';

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
  const [customVoiceIdAccount1Input, setCustomVoiceIdAccount1Input] = useState<string>(() => {
    const s = soundEngine.getCartesiaSettings();
    return s.voiceIdAccount1 || (s.voiceId !== '694f9389-aac1-45b6-b726-9d9369183238' ? s.voiceId : '') || '';
  });
  const [customVoiceIdAccount2Input, setCustomVoiceIdAccount2Input] = useState<string>(() => {
    const s = soundEngine.getCartesiaSettings();
    return s.voiceIdAccount2 || '';
  });
  const [accountVoiceTarget, setAccountVoiceTarget] = useState<'both' | 'account1' | 'account2'>('both');
  const [isTestingAccount1, setIsTestingAccount1] = useState<boolean>(false);
  const [isTestingAccount2, setIsTestingAccount2] = useState<boolean>(false);
  const [customCartesiaVoiceIdInput, setCustomCartesiaVoiceIdInput] = useState<string>(
    cartesiaSettings.voiceId || '694f9389-aac1-45b6-b726-9d9369183238'
  );
  const [isCustomCartesiaVoiceSelected, setIsCustomCartesiaVoiceSelected] = useState<boolean>(
    !['694f9389-aac1-45b6-b726-9d9369183238', '47c38ca4-5f35-497b-b1a3-415245fb35e1', 'a167e0f3-df7e-4d52-a9c3-f949145efdab', 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4'].includes(
      cartesiaSettings.voiceId || ''
    )
  );

  // Sync server configured env voice IDs when loaded if state is empty
  useEffect(() => {
    if (voiceStatus?.cartesiaVoiceId && !customVoiceIdAccount1Input) {
      setCustomVoiceIdAccount1Input(voiceStatus.cartesiaVoiceId);
    }
    if (voiceStatus?.cartesiaVoiceId2 && !customVoiceIdAccount2Input) {
      setCustomVoiceIdAccount2Input(voiceStatus.cartesiaVoiceId2);
    }
  }, [voiceStatus?.cartesiaVoiceId, voiceStatus?.cartesiaVoiceId2]);

  const [saveBadgeText, setSaveBadgeText] = useState<string | null>(null);
  const [isTestingVoiceCustom, setIsTestingVoiceCustom] = useState(false);
  const [testSampleType, setTestSampleType] = useState<'welcome' | 'pelhamGoal' | 'visitorGoal' | 'assist'>('welcome');
  const [copiedEnvVar, setCopiedEnvVar] = useState<string | null>(null);
  const [showAccount2Guide, setShowAccount2Guide] = useState<boolean>(false);

  const handleCopyVar = (varName: string) => {
    try {
      navigator.clipboard.writeText(varName);
      setCopiedEnvVar(varName);
      setTimeout(() => setCopiedEnvVar(null), 2200);
      showSavedNotification(`Copied "${varName}" to clipboard`);
    } catch {
      showSavedNotification(`Key name: ${varName}`);
    }
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

  const showSavedNotification = (msg = 'Settings saved') => {
    setSaveBadgeText(msg);
    setTimeout(() => setSaveBadgeText(null), 2500);
  };

  const handleSwitchProvider = (provider: TTSProvider) => {
    setSelectedProvider(provider);
    soundEngine.setTTSProvider(provider);
    showSavedNotification(`Switched to ${provider === 'cartesia' ? 'Cartesia Sonic' : 'ElevenLabs'} TTS`);
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
      setCustomVoiceIdAccount1Input(freshCartesia.voiceId);
      setCustomVoiceIdAccount2Input('');
      setCustomCartesiaVoiceIdInput(freshCartesia.voiceId);
      setIsCustomCartesiaVoiceSelected(false);
      setCartesiaPreset('arena');
      showSavedNotification('Reset Cartesia to optimal arena defaults');
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

  const handleApplyAccount1Voice = (customId?: string) => {
    const val = (customId !== undefined ? customId : customVoiceIdAccount1Input).trim();
    setCustomVoiceIdAccount1Input(val);
    const updated = {
      ...cartesiaSettings,
      voiceIdAccount1: val,
      voiceId: val || cartesiaSettings.voiceId,
    };
    setCartesiaSettings(updated);
    soundEngine.setCartesiaSettings(updated);
    showSavedNotification(val ? `Saved Account 1 Voice UUID (${val.slice(0, 8)}...)` : 'Cleared Account 1 Voice UUID');
  };

  const handleApplyAccount2Voice = (customId?: string) => {
    const val = (customId !== undefined ? customId : customVoiceIdAccount2Input).trim();
    setCustomVoiceIdAccount2Input(val);
    const updated = {
      ...cartesiaSettings,
      voiceIdAccount2: val,
    };
    setCartesiaSettings(updated);
    soundEngine.setCartesiaSettings(updated);
    showSavedNotification(val ? `Saved Account 2 Voice UUID (${val.slice(0, 8)}...)` : 'Cleared Account 2 Voice UUID');
  };

  const handleCopyAccount1ToAccount2 = () => {
    const val = customVoiceIdAccount1Input.trim() || cartesiaSettings.voiceIdAccount1 || cartesiaSettings.voiceId || '';
    if (val) {
      setCustomVoiceIdAccount2Input(val);
      handleApplyAccount2Voice(val);
      showSavedNotification('Copied Account 1 Voice UUID to Account 2');
    } else {
      showSavedNotification('Account 1 Voice UUID is empty');
    }
  };

  const handleSelectCartesiaVoiceId = (id: string) => {
    if (id === 'custom') {
      setIsCustomCartesiaVoiceSelected(true);
      return;
    }
    setIsCustomCartesiaVoiceSelected(false);
    if (accountVoiceTarget === 'account1') {
      handleApplyAccount1Voice(id);
    } else if (accountVoiceTarget === 'account2') {
      handleApplyAccount2Voice(id);
    } else {
      handleApplyAccount1Voice(id);
      handleApplyAccount2Voice(id);
    }
    handleUpdateCartesiaSetting('voiceId', id);
  };

  const handleApplyCustomCartesiaVoiceId = () => {
    if (customCartesiaVoiceIdInput.trim()) {
      handleSelectCartesiaVoiceId(customCartesiaVoiceIdInput.trim());
      showSavedNotification('Custom Cartesia Voice ID applied');
    }
  };

  const handleTestCartesiaAccount = async (account: 'account1' | 'account2') => {
    soundEngine.unlock();
    if (account === 'account1') {
      setIsTestingAccount1(true);
    } else {
      setIsTestingAccount2(true);
    }

    let testText = generateWelcomePrompt(visitorTeamName);
    if (testSampleType === 'pelhamGoal') {
      testText = 'Pelham Pelicans goal! Scored by number 9, Connor McDavid!';
    } else if (testSampleType === 'visitorGoal') {
      testText = `${visitorTeamName} goal! Scored by number 88, Patrick Kane!`;
    } else if (testSampleType === 'assist') {
      testText = 'Assisted by number 29, Leon Draisaitl!';
    }

    try {
      const voiceToUse = account === 'account1'
        ? (customVoiceIdAccount1Input.trim() || cartesiaSettings.voiceIdAccount1 || cartesiaSettings.voiceId)
        : (customVoiceIdAccount2Input.trim() || cartesiaSettings.voiceIdAccount2 || cartesiaSettings.voiceId);

      const res = await soundEngine.announce(testText, voiceToUse, {
        accountMode: account,
        voiceIdAccount1: customVoiceIdAccount1Input.trim(),
        voiceIdAccount2: customVoiceIdAccount2Input.trim(),
      });

      if (res.source === 'cartesia') {
        const accLabel = res.cartesiaAccount === 'account2' ? 'Account 2' : 'Account 1';
        showSavedNotification(`Tested ${accLabel} (Voice: ${res.voiceId ? res.voiceId.slice(0, 8) + '...' : 'default'})`);
      } else {
        showSavedNotification(`Test call played via ${res.source || 'vocal engine'}`);
      }
    } catch (err: any) {
      showSavedNotification(err?.message || 'Error testing Cartesia account voice');
    } finally {
      setIsTestingAccount1(false);
      setIsTestingAccount2(false);
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
        const res = await soundEngine.announce(testText, cartesiaSettings.voiceId);
        if (res.source === 'cartesia') {
          const accStr = res.cartesiaAccount === 'account2' ? 'Account 2' : 'Account 1';
          showSavedNotification(`Test voice generated via Cartesia Sonic (${accStr})`);
        }
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
                        Cartesia Sonic Active
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

            {/* TTS PROVIDER SWITCHER */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  <span>Choose Voice Announcer Engine</span>
                </label>
                <span className="text-[11px] text-slate-400">Switch anytime between providers</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <span className="text-sm font-bold text-white">ElevenLabs TTS</span>
                    </div>
                    {voiceStatus?.elevenLabsConfigured ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Browser Fallback
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    Deep, stadium announcer voicing with stability tuning, clarity boost, and custom NHL accents.
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
                        <span className="text-sm font-bold text-white">Cartesia Sonic TTS</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                          Sonic 3.5
                        </span>
                      </div>
                    </div>
                    {voiceStatus?.cartesiaConfigured ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        Configured
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Browser Fallback
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    Ultra-low latency real-time voice with high-energy emotional delivery for goal calls and official rules.
                  </p>
                </button>
              </div>
            </div>

            {/* CONDITIONAL PANEL: CARTESIA SONIC SETTINGS */}
            {selectedProvider === 'cartesia' ? (
              <div className="space-y-4">
                {/* CARTESIA DUAL-ACCOUNT & FAILOVER MANAGER */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 shadow-lg space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/50 text-cyan-400">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                          <span>Cartesia Multi-Account Manager</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 lowercase">
                            dual-account ready
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Configure primary and secondary Cartesia accounts with seamless automatic failover
                        </p>
                      </div>
                    </div>

                    {/* Overall Account Status Pill */}
                    <div className="self-start sm:self-center">
                      {(voiceStatus?.cartesiaAccountsCount || 0) >= 2 ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          2 Accounts Active (Dual Pool)
                        </span>
                      ) : voiceStatus?.cartesiaAccount1Configured ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          Account 1 Active • Account 2 Ready
                        </span>
                      ) : voiceStatus?.cartesiaAccount2Configured ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          Account 2 Active • Account 1 Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          Browser Fallback Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dual Account Cards (Account 1 and Account 2) with Custom Voice UUIDs */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    {/* Account 1 Card */}
                    <div
                      className={`p-3.5 rounded-lg border transition-all space-y-2.5 ${
                        cartesiaSettings.accountMode === 'account1' || (!cartesiaSettings.accountMode && voiceStatus?.cartesiaAccount1Configured)
                          ? 'bg-slate-950/90 border-cyan-500/60 ring-1 ring-cyan-500/30'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-200">1️⃣ Account 1 (Primary)</span>
                        </div>
                        {voiceStatus?.cartesiaAccount1Configured ? (
                          <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                            <CheckCircle2 className="w-3 h-3" /> Configured
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                            Awaiting Key
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        Primary announcer account for stadium play-by-play.
                      </div>

                      {/* API Key Row */}
                      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded px-2.5 py-1 text-[11px] font-mono">
                        <span className="text-slate-400 truncate">CARTESIA_API_KEY</span>
                        <button
                          type="button"
                          onClick={() => handleCopyVar('CARTESIA_API_KEY')}
                          className="ml-2 text-cyan-400 hover:text-cyan-300 text-[10px] flex items-center gap-1 shrink-0 font-sans"
                          title="Copy CARTESIA_API_KEY"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedEnvVar === 'CARTESIA_API_KEY' ? 'Copied!' : 'Copy Key'}</span>
                        </button>
                      </div>

                      {/* Account 1 Custom Voice UUID */}
                      <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                            <Mic className="w-3 h-3 text-cyan-400" />
                            <span>Account 1 Voice UUID</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleCopyVar('CARTESIA_VOICE_ID')}
                            className="text-[10px] text-slate-400 hover:text-slate-300 flex items-center gap-1 font-mono"
                            title="Copy CARTESIA_VOICE_ID env name"
                          >
                            <span className="text-[9px] text-slate-500">Env:</span>
                            <span className="text-cyan-400 underline">CARTESIA_VOICE_ID</span>
                          </button>
                        </div>

                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={customVoiceIdAccount1Input}
                            onChange={(e) => setCustomVoiceIdAccount1Input(e.target.value)}
                            placeholder="e.g. a27f2ab7-6793-4893-9f40-e50d5e5605ba"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyAccount1Voice()}
                            className="px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold shrink-0 transition-colors shadow"
                            title="Save Account 1 Custom Voice UUID"
                          >
                            Save
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <button
                            type="button"
                            disabled={isTestingAccount1}
                            onClick={() => handleTestCartesiaAccount('account1')}
                            className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/70 border border-cyan-800/60 hover:bg-cyan-900/60 disabled:opacity-50 transition-colors"
                          >
                            {isTestingAccount1 ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin text-cyan-300" />
                                <span>Testing Account 1...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                                <span>Test Voice (Acc 1)</span>
                              </>
                            )}
                          </button>

                          {customVoiceIdAccount1Input ? (
                            <span className="text-[10px] text-emerald-400 font-mono truncate max-w-[130px]" title={customVoiceIdAccount1Input}>
                              Active: {customVoiceIdAccount1Input.slice(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-sans">
                              Using arena default
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Account 2 Card */}
                    <div
                      className={`p-3.5 rounded-lg border transition-all space-y-2.5 ${
                        cartesiaSettings.accountMode === 'account2'
                          ? 'bg-slate-950/90 border-cyan-500/60 ring-1 ring-cyan-500/30'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-200">2️⃣ Account 2 (Secondary / Failover)</span>
                        </div>
                        {voiceStatus?.cartesiaAccount2Configured ? (
                          <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                            <CheckCircle2 className="w-3 h-3" /> Configured
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            Ready to Add
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        Backup account for credit failover &amp; extra quota.
                      </div>

                      {/* API Key Row */}
                      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded px-2.5 py-1 text-[11px] font-mono">
                        <span className="text-slate-400 truncate">CARTESIA_API_KEY_2</span>
                        <button
                          type="button"
                          onClick={() => handleCopyVar('CARTESIA_API_KEY_2')}
                          className="ml-2 text-cyan-400 hover:text-cyan-300 text-[10px] flex items-center gap-1 shrink-0 font-sans"
                          title="Copy CARTESIA_API_KEY_2"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedEnvVar === 'CARTESIA_API_KEY_2' ? 'Copied!' : 'Copy Key'}</span>
                        </button>
                      </div>

                      {/* Account 2 Custom Voice UUID */}
                      <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                            <Mic className="w-3 h-3 text-cyan-400" />
                            <span>Account 2 Voice UUID</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleCopyAccount1ToAccount2}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/50 font-sans"
                              title="Copy Account 1 UUID into Account 2"
                            >
                              <ArrowRightLeft className="w-2.5 h-2.5" />
                              <span>Copy Acc 1</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyVar('CARTESIA_VOICE_ID_2')}
                              className="text-[10px] text-slate-400 hover:text-slate-300 flex items-center gap-1 font-mono"
                              title="Copy CARTESIA_VOICE_ID_2 env name"
                            >
                              <span className="text-cyan-400 underline">CARTESIA_VOICE_ID_2</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={customVoiceIdAccount2Input}
                            onChange={(e) => setCustomVoiceIdAccount2Input(e.target.value)}
                            placeholder="e.g. 694f9389-aac1-45b6-b726-9d9369183238"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyAccount2Voice()}
                            className="px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold shrink-0 transition-colors shadow"
                            title="Save Account 2 Custom Voice UUID"
                          >
                            Save
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <button
                            type="button"
                            disabled={isTestingAccount2}
                            onClick={() => handleTestCartesiaAccount('account2')}
                            className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/70 border border-cyan-800/60 hover:bg-cyan-900/60 disabled:opacity-50 transition-colors"
                          >
                            {isTestingAccount2 ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin text-cyan-300" />
                                <span>Testing Account 2...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                                <span>Test Voice (Acc 2)</span>
                              </>
                            )}
                          </button>

                          {customVoiceIdAccount2Input ? (
                            <span className="text-[10px] text-emerald-400 font-mono truncate max-w-[130px]" title={customVoiceIdAccount2Input}>
                              Active: {customVoiceIdAccount2Input.slice(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-sans">
                              Falls back to Acc 1 or arena
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Routing Strategy Selector */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Account Routing &amp; Failover Strategy</span>
                      </label>
                      <span className="text-[10px] text-slate-400">Controls which key generates voice</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Option 1: Auto Failover Pool */}
                      <button
                        type="button"
                        onClick={() => handleUpdateCartesiaSetting('accountMode', 'auto')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          !cartesiaSettings.accountMode || cartesiaSettings.accountMode === 'auto'
                            ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-200 ring-1 ring-cyan-500/40'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1">
                            ⚡ Auto-Failover Pool
                          </span>
                          {(!cartesiaSettings.accountMode || cartesiaSettings.accountMode === 'auto') && (
                            <span className="text-[9px] uppercase font-bold text-cyan-300 bg-cyan-900/60 px-1.5 py-0.2 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] leading-tight text-slate-400">
                          Recommended. Uses Account 1; seamlessly switches to Account 2 if limits or quota are reached.
                        </p>
                      </button>

                      {/* Option 2: Account 1 Only */}
                      <button
                        type="button"
                        onClick={() => handleUpdateCartesiaSetting('accountMode', 'account1')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          cartesiaSettings.accountMode === 'account1'
                            ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-200 ring-1 ring-cyan-500/40'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1">
                            1️⃣ Account 1 Only
                          </span>
                          {cartesiaSettings.accountMode === 'account1' && (
                            <span className="text-[9px] uppercase font-bold text-cyan-300 bg-cyan-900/60 px-1.5 py-0.2 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] leading-tight text-slate-400">
                          Always routes requests through primary Cartesia key (<code>CARTESIA_API_KEY</code>).
                        </p>
                      </button>

                      {/* Option 3: Account 2 Only */}
                      <button
                        type="button"
                        onClick={() => handleUpdateCartesiaSetting('accountMode', 'account2')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          cartesiaSettings.accountMode === 'account2'
                            ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-200 ring-1 ring-cyan-500/40'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1">
                            2️⃣ Account 2 Only
                          </span>
                          {cartesiaSettings.accountMode === 'account2' && (
                            <span className="text-[9px] uppercase font-bold text-cyan-300 bg-cyan-900/60 px-1.5 py-0.2 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] leading-tight text-slate-400">
                          Routes requests directly through second account (<code>CARTESIA_API_KEY_2</code>). Perfect for testing!
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Toggleable Setup Guide for Account 2 */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setShowAccount2Guide((prev) => !prev)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>
                        {showAccount2Guide
                          ? 'Hide second account setup guide'
                          : 'How to connect your second Cartesia account in Vercel &rarr;'}
                      </span>
                    </button>

                    {showAccount2Guide && (
                      <div className="mt-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
                        <p className="text-slate-300 leading-relaxed">
                          To connect your second Cartesia account for redundancy or higher quotas:
                        </p>
                        <div className="space-y-1.5 font-mono text-[11px]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
                            <span className="text-slate-400 font-sans">1. Account 2 Key:</span>
                            <div className="flex items-center gap-1.5">
                              <code className="text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                                CARTESIA_API_KEY_2
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyVar('CARTESIA_API_KEY_2')}
                                className="text-cyan-400 hover:text-cyan-300 text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-1.5 bg-slate-900 rounded border border-slate-800">
                            <span className="text-slate-400 font-sans">2. Optional Voice ID:</span>
                            <div className="flex items-center gap-1.5">
                              <code className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                CARTESIA_VOICE_ID_2
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyVar('CARTESIA_VOICE_ID_2')}
                                className="text-cyan-400 hover:text-cyan-300 text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-1.5 bg-slate-900 rounded border border-slate-800 font-sans">
                            <span className="text-slate-400">3. Where to paste:</span>
                            <span className="text-slate-300 text-right">
                              Vercel Dashboard &rarr; Settings &rarr; Environment Variables
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-1.5 bg-slate-900 rounded border border-slate-800 font-sans">
                            <span className="text-slate-400">4. Activation:</span>
                            <span className="text-amber-300 text-right font-bold">
                              Save &amp; trigger a quick Redeploy
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 pt-1">
                          Also accepts alias variable names <code>CARTESIA_SECOND_API_KEY</code> and <code>CARTESIA_KEY_2</code>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

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
                <div className="space-y-3 pt-2 border-t border-slate-800/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Cartesia Arena Presets & Voice Library</span>
                    </label>

                    {/* Account Target Selector for Presets */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] self-start sm:self-auto">
                      <span className="text-[10px] text-slate-400 px-1.5 font-medium">Apply presets to:</span>
                      <button
                        type="button"
                        onClick={() => setAccountVoiceTarget('both')}
                        className={`px-2 py-0.5 rounded font-bold transition-colors ${
                          accountVoiceTarget === 'both'
                            ? 'bg-cyan-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ⚡ Both Accounts
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountVoiceTarget('account1')}
                        className={`px-2 py-0.5 rounded font-bold transition-colors ${
                          accountVoiceTarget === 'account1'
                            ? 'bg-cyan-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        1️⃣ Account 1
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountVoiceTarget('account2')}
                        className={`px-2 py-0.5 rounded font-bold transition-colors ${
                          accountVoiceTarget === 'account2'
                            ? 'bg-cyan-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        2️⃣ Account 2
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {CARTESIA_PRESET_VOICES.map((v) => {
                      const isAcc1 = (customVoiceIdAccount1Input || cartesiaSettings.voiceIdAccount1 || cartesiaSettings.voiceId) === v.id;
                      const isAcc2 = (customVoiceIdAccount2Input || cartesiaSettings.voiceIdAccount2) === v.id;
                      const isSelected = isAcc1 || isAcc2;

                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectCartesiaVoiceId(v.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all relative ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 ring-1 ring-cyan-500/40'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-xs font-bold text-white truncate">{v.name}</span>
                            {isAcc1 && isAcc2 ? (
                              <span className="text-[9px] bg-cyan-900/80 text-cyan-300 px-1 py-0.2 rounded font-mono shrink-0">
                                Acc 1 &amp; 2
                              </span>
                            ) : isAcc1 ? (
                              <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-1 py-0.2 rounded font-mono shrink-0">
                                Acc 1
                              </span>
                            ) : isAcc2 ? (
                              <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-1 py-0.2 rounded font-mono shrink-0">
                                Acc 2
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{v.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dual-Account Custom Voice UUID Editor Panel */}
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Custom Voice UUIDs by Account</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          (play.cartesia.ai custom models &amp; clones)
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Saved in Browser &amp; Synced with API
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Account 1 UUID Field */}
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <span>1️⃣ Account 1 Voice UUID</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {voiceStatus?.cartesiaVoiceId ? `Env: ${voiceStatus.cartesiaVoiceId.slice(0, 8)}...` : 'Primary'}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={customVoiceIdAccount1Input}
                            onChange={(e) => setCustomVoiceIdAccount1Input(e.target.value)}
                            placeholder="e.g. a27f2ab7-6793-4893-9f40-e50d5e5605ba"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyAccount1Voice()}
                            className="px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shadow shrink-0"
                          >
                            Save
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <button
                            type="button"
                            disabled={isTestingAccount1}
                            onClick={() => handleTestCartesiaAccount('account1')}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            {isTestingAccount1 ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-cyan-300" />
                            ) : (
                              <Play className="w-3 h-3 fill-cyan-400 text-cyan-400" />
                            )}
                            <span>Test on Account 1</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyAccount1Voice('694f9389-aac1-45b6-b726-9d9369183238')}
                            className="text-slate-500 hover:text-slate-300 underline font-sans"
                          >
                            Reset to Barbershop
                          </button>
                        </div>
                      </div>

                      {/* Account 2 UUID Field */}
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <span>2️⃣ Account 2 Voice UUID</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleCopyAccount1ToAccount2}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50"
                              title="Copy Account 1 UUID into Account 2"
                            >
                              <ArrowRightLeft className="w-2.5 h-2.5" />
                              <span>Copy Acc 1</span>
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {voiceStatus?.cartesiaVoiceId2 ? `Env: ${voiceStatus.cartesiaVoiceId2.slice(0, 8)}...` : 'Secondary'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={customVoiceIdAccount2Input}
                            onChange={(e) => setCustomVoiceIdAccount2Input(e.target.value)}
                            placeholder="e.g. 694f9389-aac1-45b6-b726-9d9369183238"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyAccount2Voice()}
                            className="px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shadow shrink-0"
                          >
                            Save
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <button
                            type="button"
                            disabled={isTestingAccount2}
                            onClick={() => handleTestCartesiaAccount('account2')}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            {isTestingAccount2 ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-cyan-300" />
                            ) : (
                              <Play className="w-3 h-3 fill-cyan-400 text-cyan-400" />
                            )}
                            <span>Test on Account 2</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyAccount2Voice('')}
                            className="text-slate-500 hover:text-slate-300 underline font-sans"
                          >
                            Clear / Use Failover
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-cyan-950/30 border border-cyan-900/40 text-[11px] text-slate-400 flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-cyan-300 font-medium">Why dual voice UUIDs?</strong> In Cartesia (play.cartesia.ai), cloned voices have unique UUIDs tied to the account where they were created. Providing custom UUIDs for both accounts guarantees your arena announcements sound consistent whether Account 1 or Account 2 is serving the request.
                      </span>
                    </div>
                  </div>
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
            ) : (
              /* CONDITIONAL PANEL: ELEVENLABS SETTINGS */
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
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isTestingVoiceCustom || isAnnouncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isTestingVoiceCustom || isAnnouncing
                      ? 'Announcing...'
                      : `Test ${selectedProvider === 'cartesia' ? 'Cartesia Sonic' : 'ElevenLabs'} Voice`}
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
                    {currentAnnouncement.source && (
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {currentAnnouncement.source === 'cartesia' ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                              <span className="text-cyan-300">
                                Cartesia Sonic {currentAnnouncement.cartesiaAccount === 'account2' ? '(Account 2)' : currentAnnouncement.cartesiaAccount === 'account1' ? '(Account 1)' : ''}
                              </span>
                            </>
                          ) : currentAnnouncement.source === 'elevenlabs' ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span className="text-amber-300">ElevenLabs Turbo</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span className="text-slate-300">Browser Vocal Engine</span>
                            </>
                          )}
                        </span>
                      </div>
                    )}
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
