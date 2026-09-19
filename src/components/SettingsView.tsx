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
} from 'lucide-react';
import { Announcement, VoiceStatus, Player, ElevenLabsVoiceSettings } from '../types';
import { soundEngine, DEFAULT_VOICE_SETTINGS } from '../utils/audio';

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
  const [saveBadgeText, setSaveBadgeText] = useState<string | null>(null);
  const [isTestingVoiceCustom, setIsTestingVoiceCustom] = useState(false);
  const [testSampleType, setTestSampleType] = useState<'pelhamGoal' | 'visitorGoal' | 'assist'>('pelhamGoal');

  const PRESET_VOICES = [
    { id: '6j98Cb2txyqvHRXeRQYZ', name: 'Pelham Custom NHL', desc: 'Arena Play-by-Play' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep Baritone)', desc: 'Resonant Stadium Boom' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Crisp Arena)', desc: 'Clear Live Announcer' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (High Energy)', desc: 'Dynamic Youth Pace' },
    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Broadcast)', desc: 'Classic Sports Host' },
  ];

  const showSavedNotification = (msg = 'Settings saved') => {
    setSaveBadgeText(msg);
    setTimeout(() => setSaveBadgeText(null), 2500);
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

  const handleResetToDefaults = () => {
    const fresh = { ...DEFAULT_VOICE_SETTINGS };
    setVoiceSettings(fresh);
    soundEngine.setVoiceSettings(fresh);
    setCustomVoiceIdInput(fresh.voiceId);
    setIsCustomVoiceSelected(false);
    setActivePreset('arena');
    showSavedNotification('Reset to optimal arena defaults');
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

  const handleTestAnnouncerWithCurrentSettings = async () => {
    soundEngine.unlock();
    setIsTestingVoiceCustom(true);

    let testText = 'Pelham Pelicans goal! Scored by number 9, Connor McDavid!';
    if (testSampleType === 'visitorGoal') {
      testText = `${visitorTeamName} goal! Scored by number 88, Patrick Kane!`;
    } else if (testSampleType === 'assist') {
      testText = 'Assisted by number 29, Leon Draisaitl!';
    }

    try {
      await soundEngine.announce(testText, voiceSettings.voiceId, voiceSettings);
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
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Arena Play-by-Play Announcer</span>
                  </h3>
                  {voiceStatus?.configured ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      ElevenLabs Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      Local Browser Voice Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Announces goals and assists automatically using custom speech synthesis parameters.
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

            {/* Voice Tuning Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Announcer Style Presets</span>
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
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isTestingVoiceCustom || isAnnouncing ? 'animate-spin' : ''}`} />
                  <span>{isTestingVoiceCustom || isAnnouncing ? 'Announcing...' : 'Test Announcer Voice'}</span>
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
                      {currentAnnouncement.type === 'goal' ? '🚨 GOAL CALL:' : '🏒 ASSIST CALL:'}
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
