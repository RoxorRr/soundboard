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
import { Announcement, VoiceStatus, Player, SpeechifyVoiceSettings, TTSProvider } from '../types';
import { soundEngine, DEFAULT_SPEECHIFY_VOICE_SETTINGS, generateWelcomePrompt } from '../utils/audio';

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

  // Active TTS Provider Selection (Exclusively Speechify)
  const [selectedProvider] = useState<TTSProvider>("speechify");

  // Speechify / Speechity Voice Customization State
  const [speechifySettings, setSpeechifySettings] = useState<SpeechifyVoiceSettings>(() => {
    return soundEngine.getSpeechifySettings();
  });
  const [speechifyPreset, setSpeechifyPreset] = useState<string>('arena');
  const [customSpeechifyVoiceIdInput, setCustomSpeechifyVoiceIdInput] = useState<string>(
    speechifySettings.voiceId || 'cf2bbc5b-59fb-427e-95a5-bcd76641852f'
  );
  const [isCustomSpeechifyVoiceSelected, setIsCustomSpeechifyVoiceSelected] = useState<boolean>(
    !['cf2bbc5b-59fb-427e-95a5-bcd76641852f', 'geffen_32', 'dominic_32', 'beatrice_32', 'kristy', 'cliff'].includes(
      speechifySettings.voiceId || ''
    )
  );

  // Sync server configured env voice IDs when loaded across all devices
  useEffect(() => {
    if (voiceStatus?.speechifyVoiceId) {
      const serverVoice = voiceStatus.speechifyVoiceId;
      setCustomSpeechifyVoiceIdInput(serverVoice);
      // Auto-apply custom voice if current is unset, stock default, placeholder, or personal voice detected
      const current = speechifySettings.voiceId;
      const isStock = ['geffen_32', 'dominic_32', 'beatrice_32', 'kristy', 'cliff'].includes(current);
      if (
        !current ||
        isStock ||
        current === 'cf2bbc5b-59fb-427e-95a5-bcd76641852f' ||
        voiceStatus.hasPersonalVoice ||
        voiceStatus.hasCustomVoiceEnv
      ) {
        const updated = { ...speechifySettings, voiceId: serverVoice };
        setSpeechifySettings(updated);
        soundEngine.setSpeechifySettings(updated);
        setIsCustomSpeechifyVoiceSelected(true);
      }
    }
  }, [voiceStatus?.speechifyVoiceId, voiceStatus?.hasPersonalVoice, voiceStatus?.hasCustomVoiceEnv]);

  const [saveBadgeText, setSaveBadgeText] = useState<string | null>(null);
  const [isTestingVoiceCustom, setIsTestingVoiceCustom] = useState(false);
  const [testVoiceFeedback, setTestVoiceFeedback] = useState<{
    message: string;
    type: 'success' | 'warning' | 'error';
    voiceId?: string;
  } | null>(null);
  const [testSampleType, setTestSampleType] = useState<'welcome' | 'speakerTest' | 'pelhamGoal' | 'visitorGoal' | 'assist'>('welcome');
  const [copiedEnvVar, setCopiedEnvVar] = useState<string | null>(null);

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

  const SPEECHIFY_PRESET_VOICES = [
    { id: 'cf2bbc5b-59fb-427e-95a5-bcd76641852f', name: 'Pelham Custom NHL Voice', desc: 'Personal Cloned Simba 3.2 Arena Voice' },
    { id: 'geffen_32', name: 'Geffen 3.2', desc: 'Simba 3.2 • High-Energy Arena Play-by-Play' },
    { id: 'dominic_32', name: 'Dominic 3.2', desc: 'Simba 3.2 • Deep Stadium Resonant Announcer' },
    { id: 'beatrice_32', name: 'Beatrice 3.2', desc: 'Simba 3.2 • Crystal-Clear Broadcast Host' },
    { id: 'kristy', name: 'Kristy', desc: 'Dynamic Live Presenter' },
    { id: 'cliff', name: 'Cliff', desc: 'Classic Hockey Arena Announcer' },
  ];

  const showSavedNotification = (msg = 'Settings saved') => {
    setSaveBadgeText(msg);
    setTimeout(() => setSaveBadgeText(null), 2500);
  };
  const handleUpdateSpeechifySetting = <K extends keyof SpeechifyVoiceSettings>(
    key: K,
    val: SpeechifyVoiceSettings[K]
  ) => {
    const updated = { ...speechifySettings, [key]: val };
    setSpeechifySettings(updated);
    soundEngine.setSpeechifySettings(updated);
    setSpeechifyPreset('custom');
    showSavedNotification();
  };

  const handleApplySpeechifyPreset = (presetName: string) => {
    let updates: Partial<SpeechifyVoiceSettings> = {};
    if (presetName === 'arena') {
      updates = { voiceId: 'cf2bbc5b-59fb-427e-95a5-bcd76641852f', speed: 1.05, pitchCents: 30 };
    } else if (presetName === 'deep') {
      updates = { voiceId: 'dominic_32', speed: 0.95, pitchCents: -100 };
    } else if (presetName === 'clarity') {
      updates = { voiceId: 'beatrice_32', speed: 1.0, pitchCents: 0 };
    } else if (presetName === 'power') {
      updates = { voiceId: 'kristy', speed: 1.10, pitchCents: 40 };
    }
    const merged = { ...speechifySettings, ...updates };
    setSpeechifySettings(merged);
    soundEngine.setSpeechifySettings(merged);
    setSpeechifyPreset(presetName);
    if (updates.voiceId) {
      setCustomSpeechifyVoiceIdInput(updates.voiceId);
      setIsCustomSpeechifyVoiceSelected(false);
    }
    showSavedNotification(`Applied Speechify "${presetName}" profile`);
  };

  const handleSelectSpeechifyVoiceId = (id: string) => {
    if (id === 'custom') {
      setIsCustomSpeechifyVoiceSelected(true);
      return;
    }
    setIsCustomSpeechifyVoiceSelected(false);
    handleUpdateSpeechifySetting('voiceId', id);
  };

  const handleApplyCustomSpeechifyVoiceId = () => {
    if (customSpeechifyVoiceIdInput.trim()) {
      handleUpdateSpeechifySetting('voiceId', customSpeechifyVoiceIdInput.trim());
      setIsCustomSpeechifyVoiceSelected(true);
      showSavedNotification('Speechify voice applied');
    }
  };

  const handleResetToDefaults = () => {
    const freshSpeechify = { ...DEFAULT_SPEECHIFY_VOICE_SETTINGS };
    setSpeechifySettings(freshSpeechify);
    soundEngine.setSpeechifySettings(freshSpeechify);
    setCustomSpeechifyVoiceIdInput(freshSpeechify.voiceId);
    setIsCustomSpeechifyVoiceSelected(false);
    setSpeechifyPreset("arena");
    showSavedNotification("Reset Speechify to optimal arena defaults");
  };
  const handleTestAnnouncerWithCurrentSettings = async () => {
    soundEngine.unlock();
    setIsTestingVoiceCustom(true);

    let testText = generateWelcomePrompt(visitorTeamName);
    if (testSampleType === 'speakerTest') {
      testText = 'Speaker check: One, two, three. Testing arena sound system. Audio is loud and clear.';
    } else if (testSampleType === 'pelhamGoal') {
      testText = 'Pelham Pelicans goal! Scored by number 9, Connor McDavid!';
    } else if (testSampleType === 'visitorGoal') {
      testText = `${visitorTeamName} goal! Scored by number 88, Patrick Kane!`;
    } else if (testSampleType === 'assist') {
      testText = 'Assisted by number 29, Leon Draisaitl!';
    }

    try {
      const res = await soundEngine.announce(testText, speechifySettings.voiceId);
      if (res.source === "speechify") {
        const msg = `Speechify Simba 3.2 generated successfully! Active voice: ${res.voiceId || speechifySettings.voiceId}`;
        showSavedNotification(msg);
        setTestVoiceFeedback({
          message: msg,
          type: 'success',
          voiceId: res.voiceId || speechifySettings.voiceId,
        });
      } else {
        const msg = res.error ? `Speechify: ${res.error}` : `Test announcement played via ${res.source || "vocal engine"}`;
        showSavedNotification(msg);
        setTestVoiceFeedback({
          message: res.error || "Speechify synthesis failed on server; fallback browser voice played. Verify SPEECHIFY_API_KEY in Vercel Project Settings and trigger a Redeploy.",
          type: 'warning',
          voiceId: res.voiceId || speechifySettings.voiceId,
        });
      }
    } catch (err: any) {
      setTestVoiceFeedback({
        message: err?.message || "Network error while connecting to Speechify TTS service.",
        type: 'error',
      });
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
                  {voiceStatus?.speechifyConfigured ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                      Speechify Simba 3.2 Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Speechify (Local Browser Fallback)
                    </span>
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

            {/* Active Engine Summary Banner (Speechify Simba 3.2 Exclusively) */}
            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-900/60 border border-purple-600/50 text-purple-300">
                  <Radio className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-200 flex items-center gap-2">
                    <span>Arena Voice Announcer: Speechify</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900 text-purple-300 border border-purple-700/60">
                      Simba 3.2
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    High-fidelity stadium vocal synthesis with custom Pelham NHL voice cloning.
                  </p>
                </div>
              </div>
              <div>
                {voiceStatus?.speechifyConfigured ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Speechify Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Browser Fallback Active
                  </span>
                )}
              </div>
            </div>

            {/* SPEECHIFY VOICE SETTINGS (SIMBA 3.2 EXCLUSIVELY) */}
              <div className="space-y-4">
                {/* Vercel / Cloud Setup Notice when not configured */}
                {/* Connection Status Card */}
                {voiceStatus?.speechifyConfigured ? (
                  <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Speechify Simba 3.2 Connected</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
                        {voiceStatus.apiKeySource || "SPEECHIFY_API_KEY"} Active
                      </span>
                    </div>
                    {voiceStatus.speechifyVoiceName && (
                      <div className="text-[11px] text-purple-200 flex items-center justify-between bg-purple-900/30 p-2 rounded-lg border border-purple-800/40">
                        <span>Active Voice: <strong className="text-white">{voiceStatus.speechifyVoiceName}</strong></span>
                        <code className="text-[10px] text-purple-300 font-mono">{voiceStatus.speechifyVoiceId}</code>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-purple-300">
                        <Key className="w-4 h-4 text-purple-400" />
                        <span>Speechify Configuration: SPEECHIFY_API_KEY Required</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                        Vercel Env
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      To activate custom Speechify announcer voices on your Vercel deployment:
                    </p>
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">1. Variable:</span>
                        <code className="text-purple-300 font-bold bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60 selection:bg-purple-600">
                          SPEECHIFY_API_KEY
                        </code>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">2. Optional Voice ID:</span>
                        <code className="text-purple-300 font-mono">SPEECHIFY_VOICE_ID</code>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-slate-400">3. Portal:</span>
                        <span className="text-slate-300 font-sans">platform.speechify.ai &rarr; API Keys</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200 space-y-0.5">
                      <div className="font-bold flex items-center gap-1">
                        <span>⚠️ Important Vercel Step:</span>
                      </div>
                      <div>
                        After adding environment variables in Vercel Project Settings, you must click <strong>Deployments &rarr; ... &rarr; Redeploy</strong> for them to take effect!
                      </div>
                    </div>
                  </div>
                )}

                {/* Workspace Personal Cloned Voices (Discovered Dynamically) */}
                {voiceStatus?.personalVoices && voiceStatus.personalVoices.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Your Cloned Speechify Voices (from Workspace)</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                        {voiceStatus.personalVoices.length} Discovered
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {voiceStatus.personalVoices.map((pv) => {
                        const isSelected = speechifySettings.voiceId === pv.id;
                        return (
                          <button
                            key={pv.id}
                            type="button"
                            onClick={() => {
                              handleSelectSpeechifyVoiceId(pv.id);
                              setCustomSpeechifyVoiceIdInput(pv.id);
                              setIsCustomSpeechifyVoiceSelected(true);
                            }}
                            className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-purple-600/30 border-purple-400 text-white shadow-sm ring-1 ring-purple-400'
                                : 'bg-slate-950/80 border-purple-900/60 text-slate-300 hover:border-purple-600/60'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-bold flex items-center gap-1.5 flex-wrap">
                                <span>⭐ {pv.name}</span>
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                                  Custom Personal
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                {pv.id}
                              </div>
                            </div>
                            {isSelected && (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/50" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Voice Tuning Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      <span>Speechify Announcer Presets</span>
                    </label>
                    <span className="text-[11px] text-slate-500">Quickly apply Simba voice profiles</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplySpeechifyPreset('arena')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        speechifyPreset === 'arena'
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 ring-1 ring-purple-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>⚡ Arena Simba 3.2</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Geffen • 1.05x • +30 Pitch</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplySpeechifyPreset('deep')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        speechifyPreset === 'deep'
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 ring-1 ring-purple-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🎙️ Deep Stadium</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Dominic • 0.95x • -100 Pitch</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplySpeechifyPreset('clarity')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        speechifyPreset === 'clarity'
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 ring-1 ring-purple-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>📢 High Clarity</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Beatrice • 1.00x • Natural</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplySpeechifyPreset('power')}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        speechifyPreset === 'power'
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 ring-1 ring-purple-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>🏆 Power Play</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Kristy • 1.10x • +40 Pitch</div>
                    </button>
                  </div>
                </div>

                {/* Voice Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Catalog Announcer Voices</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SPEECHIFY_PRESET_VOICES.map((v) => {
                      const isSelected = !isCustomSpeechifyVoiceSelected && speechifySettings.voiceId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectSpeechifyVoiceId(v.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-purple-500/20 border-purple-500/60 text-white shadow-sm ring-1 ring-purple-500/30'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              <span>{v.name}</span>
                              <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                                {v.id}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{v.desc}</div>
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Voice ID Input */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <span>Custom Voice ID / Cloned Voice</span>
                        <span className="text-slate-500 text-[10px]">(from platform.speechify.ai)</span>
                      </span>
                      {voiceStatus?.speechifyVoiceId && (
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                          Env: {voiceStatus.speechifyVoiceId}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customSpeechifyVoiceIdInput}
                        onChange={(e) => {
                          setCustomSpeechifyVoiceIdInput(e.target.value);
                          setIsCustomSpeechifyVoiceSelected(true);
                        }}
                        placeholder="e.g. geffen_32, cliff, or custom cloned voice ID"
                        className="flex-1 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCustomSpeechifyVoiceId}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shrink-0"
                      >
                        Apply Voice
                      </button>
                    </div>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Speechify Model</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'simba-3.2', label: 'Simba 3.2', desc: 'Recommended English' },
                      { id: 'simba-3.0', label: 'Simba 3.0', desc: 'Multilingual' },
                      { id: 'simba-english', label: 'Simba English', desc: 'Legacy Simba 1.6' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleUpdateSpeechifySetting('model', m.id)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          speechifySettings.model === m.id
                            ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 ring-1 ring-purple-500/30'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{m.label}</div>
                        <div className="text-[10px] text-slate-400">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed & Pitch Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* SPEED SLIDER */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-purple-400" />
                        <span>Speech Rate</span>
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {speechifySettings.speed.toFixed(2)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.75"
                      max="1.30"
                      step="0.05"
                      value={speechifySettings.speed}
                      onChange={(e) => handleUpdateSpeechifySetting('speed', parseFloat(e.target.value))}
                      className="w-full accent-purple-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0.75x (Deliberate)</span>
                      <span>1.05x (Optimal Arena)</span>
                      <span>1.30x (Fast Play)</span>
                    </div>
                  </div>

                  {/* PITCH SLIDER */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-purple-400" />
                        <span>Pitch Tuning (Detune)</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {speechifySettings.pitchCents === 0
                            ? '0 cents (Standard)'
                            : `${speechifySettings.pitchCents > 0 ? '+' : ''}${speechifySettings.pitchCents} cents`}
                        </span>
                        {speechifySettings.pitchCents !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleUpdateSpeechifySetting('pitchCents', 0)}
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
                      min="-300"
                      max="300"
                      step="25"
                      value={speechifySettings.pitchCents}
                      onChange={(e) => handleUpdateSpeechifySetting('pitchCents', parseInt(e.target.value, 10))}
                      className="w-full accent-purple-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>-300 cents (Deeper)</span>
                      <span>0 (Standard)</span>
                      <span>+300 cents (Higher)</span>
                    </div>
                  </div>
                </div>
              </div>
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
                    <span>🎙️ Welcome message ({visitorTeamName})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSampleType('speakerTest')}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                      testSampleType === 'speakerTest'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <span>🔊 Test Speaker (Short)</span>
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
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50 bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isTestingVoiceCustom || isAnnouncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isTestingVoiceCustom || isAnnouncing
                      ? 'Announcing...'
                      : 'Test Speechify Simba Voice'}
                  </span>
                </button>
              </div>
            </div>

            {/* Live Test Feedback Banner */}
            {testVoiceFeedback && (
              <div
                className={`p-3 rounded-xl text-xs border flex items-center justify-between gap-2.5 transition-all ${
                  testVoiceFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    : testVoiceFeedback.type === 'warning'
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">
                    {testVoiceFeedback.type === 'success' ? '✅' : '⚠️'}
                  </span>
                  <div>
                    <div className="font-bold">
                      {testVoiceFeedback.type === 'success'
                        ? 'Speechify Audio Playback OK'
                        : 'Announcer Notice'}
                    </div>
                    <div className="text-[11px] opacity-90">{testVoiceFeedback.message}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTestVoiceFeedback(null)}
                  className="px-2 py-1 text-slate-400 hover:text-white rounded hover:bg-slate-800/60 text-xs shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

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
                          {currentAnnouncement.source === "speechify" ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              <span className="text-purple-300">Speechify Simba 3.2</span>
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
