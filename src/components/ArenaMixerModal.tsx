import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Upload,
  Play,
  Square,
  Sparkles,
  CloudCheck,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Music,
  Radio,
  FileAudio,
  Trash2,
  RefreshCw,
  Clock,
  Layers,
  Info,
  Download,
  Check,
  Plus,
} from 'lucide-react';
import { MixerSettings, StoredGoalHornData, GoalHornPreset, GoalHornItem } from '../types';
import { soundEngine } from '../utils/audio';

interface ArenaMixerModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitorTeamName?: string;
  isAnnouncing?: boolean;
}

export const ArenaMixerModal: React.FC<ArenaMixerModalProps> = ({
  isOpen,
  onClose,
  visitorTeamName = 'Visiting Team',
  isAnnouncing = false,
}) => {
  const [mixerSettings, setMixerSettings] = useState<MixerSettings>(() => soundEngine.getMixerSettings());
  const [goalHorns, setGoalHorns] = useState<GoalHornItem[]>(() => soundEngine.getGoalHornsLibrary());
  const [activeHornId, setActiveHornId] = useState<string>(() => soundEngine.getActiveGoalHornId());
  const [storedHorn, setStoredHorn] = useState<StoredGoalHornData | null>(() => soundEngine.getStoredGoalHorn());
  const [customHornName, setCustomHornName] = useState('');
  const [previewingHornId, setPreviewingHornId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Playback testing states
  const [activeStep, setActiveStep] = useState<'idle' | 'horn' | 'voice'>('idle');
  const [hornTestActive, setHornTestActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hornStopRef = useRef<(() => void) | null>(null);
  const previewStopRef = useRef<(() => void) | null>(null);

  // Sync state on open and listen to changes from SoundEngine
  useEffect(() => {
    if (!isOpen) return;

    setMixerSettings(soundEngine.getMixerSettings());
    setStoredHorn(soundEngine.getStoredGoalHorn());
    setGoalHorns(soundEngine.getGoalHornsLibrary());
    setActiveHornId(soundEngine.getActiveGoalHornId());

    // Sync from server across devices
    setIsSyncing(true);
    soundEngine
      .syncServerGoalHorn()
      .then((horn) => {
        if (horn && horn.hasCustomHorn && horn.audioBase64) {
          setStoredHorn(horn);
        }
        setMixerSettings(soundEngine.getMixerSettings());
        setGoalHorns(soundEngine.getGoalHornsLibrary());
        setActiveHornId(soundEngine.getActiveGoalHornId());
      })
      .finally(() => setIsSyncing(false));

    const unsubscribeHorn = soundEngine.subscribeToHornChange(() => {
      setMixerSettings(soundEngine.getMixerSettings());
      setStoredHorn(soundEngine.getStoredGoalHorn());
      setActiveHornId(soundEngine.getActiveGoalHornId());
    });

    const unsubscribeLibrary = soundEngine.subscribeToHornLibrary((horns, activeId) => {
      setGoalHorns(horns);
      setActiveHornId(activeId);
    });

    return () => {
      unsubscribeHorn();
      unsubscribeLibrary();
      if (hornStopRef.current) {
        hornStopRef.current();
        hornStopRef.current = null;
      }
      if (previewStopRef.current) {
        previewStopRef.current();
        previewStopRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof MixerSettings>(key: K, value: MixerSettings[K]) => {
    const updated = soundEngine.setMixerSettings({ [key]: value });
    setMixerSettings(updated);
    setStoredHorn(soundEngine.getStoredGoalHorn());
  };

  const handleSelectHorn = async (hornId: string) => {
    soundEngine.unlock();
    if (previewStopRef.current) {
      previewStopRef.current();
      previewStopRef.current = null;
      setPreviewingHornId(null);
    }
    await soundEngine.selectGoalHorn(hornId);
    setActiveHornId(hornId);
    setMixerSettings(soundEngine.getMixerSettings());
    setStoredHorn(soundEngine.getStoredGoalHorn());
    const selected = soundEngine.getActiveGoalHorn();
    setUploadSuccess(`Active goal horn set to "${selected.name}" across the arena!`);
    setTimeout(() => setUploadSuccess(null), 3500);
  };

  const handlePreviewHorn = (hornId: string) => {
    soundEngine.unlock();
    if (previewingHornId === hornId) {
      if (previewStopRef.current) {
        previewStopRef.current();
        previewStopRef.current = null;
      }
      setPreviewingHornId(null);
      return;
    }
    if (previewStopRef.current) {
      previewStopRef.current();
      previewStopRef.current = null;
    }
    setPreviewingHornId(hornId);
    const stopFn = soundEngine.previewGoalHorn(hornId, 7.0, () => {
      setPreviewingHornId(null);
      previewStopRef.current = null;
    });
    previewStopRef.current = stopFn;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const nameToUse = customHornName.trim() || undefined;
    const res = await soundEngine.uploadGoalHorn(file, nameToUse);
    setIsUploading(false);

    if (res.success && res.data) {
      setGoalHorns(soundEngine.getGoalHornsLibrary());
      setActiveHornId(res.data.id);
      setStoredHorn(soundEngine.getStoredGoalHorn());
      setMixerSettings(soundEngine.getMixerSettings());
      setCustomHornName('');
      setUploadSuccess(`Goal horn "${res.data.name}" uploaded, stored in database, and activated across the arena!`);
      setTimeout(() => setUploadSuccess(null), 5000);
    } else {
      setUploadError(res.error || 'Failed to upload audio file');
    }

    // Reset input value so re-selecting same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteHorn = async (horn: GoalHornItem) => {
    if (horn.id === 'official_pelham') return;
    if (!window.confirm(`Delete "${horn.name}" from the database?`)) return;

    if (previewingHornId === horn.id && previewStopRef.current) {
      previewStopRef.current();
      previewStopRef.current = null;
      setPreviewingHornId(null);
    }

    await soundEngine.deleteGoalHorn(horn.id);
    setGoalHorns(soundEngine.getGoalHornsLibrary());
    setActiveHornId(soundEngine.getActiveGoalHornId());
    setMixerSettings(soundEngine.getMixerSettings());
    setStoredHorn(soundEngine.getStoredGoalHorn());
    setUploadSuccess(`Deleted "${horn.name}" from database.`);
    setTimeout(() => setUploadSuccess(null), 3000);
  };

  const handleResetToOfficialPelham = async () => {
    if (previewStopRef.current) {
      previewStopRef.current();
      previewStopRef.current = null;
      setPreviewingHornId(null);
    }
    await soundEngine.resetToOfficialPelhamGoalHorn();
    setActiveHornId('official_pelham');
    setMixerSettings(soundEngine.getMixerSettings());
    setStoredHorn(soundEngine.getStoredGoalHorn());
    setUploadSuccess('Reverted to Official Pelham Pelicans Goal Horn (Default).');
    setTimeout(() => setUploadSuccess(null), 3500);
  };

  const handleTestHornOnly = () => {
    if (hornTestActive) {
      soundEngine.stopHorn();
      setHornTestActive(false);
      return;
    }

    soundEngine.unlock();
    setHornTestActive(true);
    const stopFn = soundEngine.playGoalHorn(() => {
      setHornTestActive(false);
    });
    hornStopRef.current = stopFn;
  };

  const handleTestVoiceOnly = async () => {
    soundEngine.unlock();
    setActiveStep('voice');
    try {
      await soundEngine.announce('Pelham Pelicans goal! Scored by number 9, Austin Matthews!', 'nhl');
    } finally {
      setActiveStep('idle');
    }
  };

  const handleStopAll = () => {
    soundEngine.stopAll();
    setActiveStep('idle');
    setHornTestActive(false);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    const updated = await soundEngine.syncServerGoalHorn();
    setStoredHorn(updated);
    setMixerSettings(soundEngine.getMixerSettings());
    setIsSyncing(false);
    setUploadSuccess('Synced with server across all devices!');
    setTimeout(() => setUploadSuccess(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mixer-modal-title"
      >
        {/* Top Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/60 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="mixer-modal-title" className="font-athletic font-bold text-lg sm:text-xl text-white uppercase tracking-wider">
                  Arena Audio Mixer & Goal Horn
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Firebase Cloud Sync Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload your MP3 from your phone or computer. Synced permanently in Firebase Firestore cloud across all devices on Vercel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Sync latest goal horn and settings with server"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Notifications */}
          {uploadSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl flex items-center gap-2 text-xs text-rose-300 animate-in fade-in">
              <Info className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* 3 CHANNELS CONSOLE GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CHANNEL 1: GOAL HORN AUDIO */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-4 relative overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-athletic font-bold text-sm text-white uppercase tracking-wider">
                        CH 1: Goal Horn
                      </h4>
                      <span className="text-[10px] text-slate-400">Audio Blast Source</span>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[10px] text-slate-400">{mixerSettings.hornEnabled ? 'ON' : 'OFF'}</span>
                    <input
                      type="checkbox"
                      checked={mixerSettings.hornEnabled}
                      onChange={(e) => updateSetting('hornEnabled', e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-500"
                    />
                  </label>
                </div>

                {/* Horn Volume Slider */}
                <div className="space-y-1 bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px] font-medium">Horn Level</span>
                    <span className="text-amber-400 font-mono font-bold text-xs">
                      {Math.round(mixerSettings.hornVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={mixerSettings.hornVolume}
                    onChange={(e) => updateSetting('hornVolume', parseFloat(e.target.value))}
                    className="w-full accent-amber-400 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Horn Duration Limit */}
                <div className="space-y-1 bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px] font-medium">Horn Blast Length</span>
                    <span className="text-amber-400 font-mono font-bold text-xs">
                      {mixerSettings.hornDurationLimit > 0 ? `${mixerSettings.hornDurationLimit}s` : 'Full File'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[0, 3, 5, 8].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => updateSetting('hornDurationLimit', dur)}
                        className={`py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                          (mixerSettings.hornDurationLimit ?? 0) === dur
                            ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 ring-1 ring-amber-400 font-bold'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {dur === 0 ? 'Full Track' : `${dur}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ACTIVE GOAL HORN BANNER */}
                <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-athletic uppercase tracking-wider font-bold text-amber-400">
                      Active Arena Goal Horn
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">
                          {goalHorns.find((h) => h.id === activeHornId)?.name || 'Official Pelham Pelicans Goal Horn'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {activeHornId === 'official_pelham'
                          ? 'Official Pelham (Default) • Authentic 90s Arena MP3 Track'
                          : 'Custom Horn • Stored in Database across all arena devices'}
                      </p>
                    </div>

                    {activeHornId !== 'official_pelham' && (
                      <button
                        type="button"
                        onClick={handleResetToOfficialPelham}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-slate-700 hover:border-amber-500/40 text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all flex items-center gap-1"
                        title="Revert to official Pelham goal horn default"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Default Pelham</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* GOAL HORNS LIBRARY SELECTOR */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <FileAudio className="w-3.5 h-3.5 text-amber-400" />
                      <span>Select Goal Horn ({goalHorns.length})</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Stored in Database</span>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                    {goalHorns.map((horn) => {
                      const isActive = horn.id === activeHornId;
                      const isPreviewing = previewingHornId === horn.id;
                      const isOfficial = horn.id === 'official_pelham';

                      return (
                        <div
                          key={horn.id}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                            isActive
                              ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/30 text-white'
                              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          {/* Play / Preview Button */}
                          <button
                            type="button"
                            onClick={() => handlePreviewHorn(horn.id)}
                            className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                              isPreviewing
                                ? 'bg-amber-500 text-slate-950 animate-pulse'
                                : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                            }`}
                            title={isPreviewing ? 'Stop Preview' : 'Preview audio sample'}
                          >
                            {isPreviewing ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                          </button>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-white truncate max-w-[160px] sm:max-w-[190px]">
                                {horn.name}
                              </span>
                              {isOfficial ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Default
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                  Database
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {horn.filename}
                              {horn.duration ? ` • ${horn.duration}s` : ''}
                              {horn.fileSize ? ` • ${Math.round(horn.fileSize / 1024)} KB` : ''}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isActive ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectHorn(horn.id)}
                                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 text-slate-200 hover:text-slate-950 transition-colors border border-slate-700 hover:border-amber-400"
                              >
                                Select
                              </button>
                            )}

                            {!isOfficial && (
                              <button
                                type="button"
                                onClick={() => handleDeleteHorn(horn)}
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Delete from database"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* UPLOAD MORE GOAL HORNS SECTION */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload More Goal Horns</span>
                    </span>
                    <span className="text-[10px] text-slate-500">MP3, WAV, M4A &le; 20MB</span>
                  </div>

                  {/* Optional Horn Display Name */}
                  <input
                    type="text"
                    value={customHornName}
                    onChange={(e) => setCustomHornName(e.target.value)}
                    placeholder="Goal Horn Name (e.g. Powerplay Horn)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                  />

                  {/* File Upload Dropzone */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg,audio/aac,audio/m4a,audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="goal-horn-file-input"
                  />
                  <label
                    htmlFor="goal-horn-file-input"
                    className={`w-full py-2 px-3 border border-dashed rounded-xl flex items-center justify-center gap-2 text-xs font-athletic uppercase tracking-wider cursor-pointer transition-all ${
                      isUploading
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 animate-pulse'
                        : 'bg-slate-950 hover:bg-amber-500/10 border-slate-700 hover:border-amber-400/60 text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Uploading & Storing in Database...' : 'Choose Audio File & Save to Database'}</span>
                  </label>

                  <p className="text-[10px] text-slate-400 leading-tight">
                    Uploaded goal horns are saved permanently in Firestore database & accessible on all devices. Official Pelham horn is always retained as default.
                  </p>
                </div>

                {/* SYNTHETIC HORN PRESETS (OPTIONAL BACKUPS) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                    Synthesized Horn Backups
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSetting('selectedPreset', 'nhl_foghorn')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        mixerSettings.selectedPreset === 'nhl_foghorn'
                          ? 'bg-amber-500/15 border-amber-500/50 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">NHL Foghorn</div>
                      <div className="text-[9px] text-slate-500">Low pneumatic</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSetting('selectedPreset', 'arena_siren')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        mixerSettings.selectedPreset === 'arena_siren'
                          ? 'bg-amber-500/15 border-amber-500/50 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">Arena Siren</div>
                      <div className="text-[9px] text-slate-500">High wailing</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Channel 1 Test Button */}
              <button
                type="button"
                onClick={handleTestHornOnly}
                className={`w-full py-2 px-3 rounded-xl font-athletic font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md ${
                  hornTestActive
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                }`}
              >
                {hornTestActive ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Horn</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Test Horn Only</span>
                  </>
                )}
              </button>
            </div>

            {/* CHANNEL 2: ANNOUNCER VOICE-OVER */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-athletic font-bold text-sm text-white uppercase tracking-wider">
                        CH 2: Voice-Over
                      </h4>
                      <span className="text-[10px] text-slate-400">Pelham Custom Announcer</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase">
                    Speechify
                  </span>
                </div>

                {/* Voice Volume Slider */}
                <div className="space-y-1 bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px] font-medium">Voice Level</span>
                    <span className="text-purple-400 font-mono font-bold text-xs">
                      {Math.round(mixerSettings.voiceVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={mixerSettings.voiceVolume}
                    onChange={(e) => updateSetting('voiceVolume', parseFloat(e.target.value))}
                    className="w-full accent-purple-400 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Voice Information Details */}
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Assigned Voice</span>
                    <span className="text-xs font-bold text-white">Pelham Custom NHL</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Engine</span>
                    <span className="font-mono text-purple-300">Simba 3.2</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target</span>
                    <span className="text-slate-200">Arena PA Loudspeaker</span>
                  </div>
                </div>

                {/* Spoken Text Preview */}
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Spoken Goal Script:
                  </span>
                  <p className="text-xs text-slate-200 font-medium italic">
                    &ldquo;Pelham Pelicans goal! Scored by number 9, Austin Matthews!&rdquo;
                  </p>
                </div>
              </div>

              {/* Channel 2 Test Button */}
              <button
                type="button"
                onClick={handleTestVoiceOnly}
                disabled={activeStep === 'voice' || isAnnouncing}
                className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-athletic font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 transition-all"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{activeStep === 'voice' ? 'Speaking...' : 'Test Voice Only'}</span>
              </button>
            </div>

            {/* CHANNEL 3: TIMING & SEQUENCE MIX */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-athletic font-bold text-sm text-white uppercase tracking-wider">
                        CH 3: Timing & Auto
                      </h4>
                      <span className="text-[10px] text-slate-400">Sequence Mix Controls</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
                    Trigger Mode
                  </span>
                </div>

                {/* Sequence Trigger Mode */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Voice Timing
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateSetting('voiceTriggerMode', 'after_horn')}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        mixerSettings.voiceTriggerMode === 'after_horn'
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                          : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">After Horn Ends</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Horn completes, then voice speaks</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSetting('voiceTriggerMode', 'delay')}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        mixerSettings.voiceTriggerMode === 'delay'
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                          : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">Delay & Duck</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Voice kicks in after X seconds</div>
                    </button>
                  </div>
                </div>

                {/* Delay Slider (only active in delay mode) */}
                {mixerSettings.voiceTriggerMode === 'delay' && (
                  <div className="space-y-1 bg-slate-900/90 rounded-xl p-3 border border-slate-800 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px] font-medium">Voice Trigger Delay</span>
                      <span className="text-cyan-400 font-mono font-bold text-xs">
                        {mixerSettings.voiceDelaySeconds.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="6"
                      step="0.5"
                      value={mixerSettings.voiceDelaySeconds}
                      onChange={(e) => updateSetting('voiceDelaySeconds', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                    />

                    {/* Duck Horn Toggle */}
                    <label className="flex items-center justify-between pt-1 text-[11px] text-slate-300 cursor-pointer">
                      <span>Duck Horn volume when voice starts</span>
                      <input
                        type="checkbox"
                        checked={mixerSettings.duckHornOnVoice}
                        onChange={(e) => updateSetting('duckHornOnVoice', e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-950 border-slate-700 focus:ring-cyan-500"
                      />
                    </label>
                  </div>
                )}

                {/* Auto Trigger On Goal Score Toggle */}
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Auto-Trigger on Goal</div>
                      <div className="text-[10px] text-slate-400">Play sequence automatically on Pelham goal</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={mixerSettings.autoTriggerOnGoal}
                      onChange={(e) => updateSetting('autoTriggerOnGoal', e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Master Volume Slider */}
              <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 font-medium">Master Out</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={mixerSettings.masterVolume}
                  onChange={(e) => updateSetting('masterVolume', parseFloat(e.target.value))}
                  className="w-28 accent-cyan-400 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                />
                <span className="text-cyan-400 font-mono font-bold text-xs w-8 text-right">
                  {Math.round(mixerSettings.masterVolume * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* CLOUD & MULTI-DEVICE PERSISTENCE FOOTER */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CloudCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-slate-200 font-semibold">Stored In App & Synced Across All Devices</span>
                <p className="text-[11px] text-slate-400">
                  {storedHorn?.hasCustomHorn
                    ? `Active file: "${storedHorn.filename}" (${Math.round((storedHorn.fileSize || 0) / 1024)} KB) • Available on any browser or arena tablet.`
                    : 'Authentic Pelham Arena preset is active across all devices.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync All Devices'}</span>
            </button>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleStopAll}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Square className="w-3.5 h-3.5 text-rose-400" />
            <span>Stop Audio</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-athletic font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-cyan-600/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
