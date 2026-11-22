import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Hash,
  ShieldAlert,
  Clock,
  Volume2,
  Sparkles,
  Radio,
  RefreshCw,
  Send,
  Timer,
  CheckCircle2,
  Layers,
  Sliders,
  Upload,
  Trash2,
  Square,
  Zap,
  Mic,
  AlertCircle,
} from 'lucide-react';
import { Player, Announcement, PeriodAlertAudio, PeriodAlertKey } from '../types';
import { QuickGoalModal } from './QuickGoalModal';
import { PenaltyModal } from './PenaltyModal';
import { soundEngine } from '../utils/audio';

const PERIOD_ALERT_CARDS: Array<{
  key: PeriodAlertKey;
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  script: string;
  playLabel: string;
  accent: {
    borderHover: string;
    shadowHover: string;
    iconBg: string;
    titleHover: string;
    playBtn: string;
    playBtnRecording: string;
  };
}> = [
  {
    key: 'first',
    id: 'period-btn-first',
    badge: '1',
    title: '1st Period Warning',
    subtitle: '1:00 Remaining',
    script: 'One minute remaining in the first period.',
    playLabel: '1st Period',
    accent: {
      borderHover: 'hover:border-sky-400/60',
      shadowHover: 'hover:shadow-sky-500/15',
      iconBg: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
      titleHover: 'text-sky-300',
      playBtn: 'bg-sky-600/20 hover:bg-sky-600/35 text-sky-200 border-sky-500/40',
      playBtnRecording: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 shadow-sky-500/25',
    },
  },
  {
    key: 'second',
    id: 'period-btn-second',
    badge: '2',
    title: '2nd Period Warning',
    subtitle: '1:00 Remaining',
    script: 'One minute remaining in the second period.',
    playLabel: '2nd Period',
    accent: {
      borderHover: 'hover:border-amber-400/60',
      shadowHover: 'hover:shadow-amber-500/15',
      iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      titleHover: 'text-amber-300',
      playBtn: 'bg-amber-600/20 hover:bg-amber-600/35 text-amber-200 border-amber-500/40',
      playBtnRecording: 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-amber-500/25',
    },
  },
  {
    key: 'third',
    id: 'period-btn-third',
    badge: '3',
    title: '3rd Period Warning',
    subtitle: '1:00 Remaining • Final Minute',
    script: 'One minute remaining in the third period.',
    playLabel: '3rd Period',
    accent: {
      borderHover: 'hover:border-emerald-400/60',
      shadowHover: 'hover:shadow-emerald-500/15',
      iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      titleHover: 'text-emerald-300',
      playBtn: 'bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-200 border-emerald-500/40',
      playBtnRecording: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/25',
    },
  },
  {
    key: 'overtime',
    id: 'period-btn-ot',
    badge: 'OT',
    title: 'Overtime Warning',
    subtitle: '1:00 Remaining in OT',
    script: 'One minute remaining in overtime.',
    playLabel: 'Overtime',
    accent: {
      borderHover: 'hover:border-purple-400/60',
      shadowHover: 'hover:shadow-purple-500/15',
      iconBg: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      titleHover: 'text-purple-300',
      playBtn: 'bg-purple-600/20 hover:bg-purple-600/35 text-purple-200 border-purple-500/40',
      playBtnRecording: 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-purple-500/25',
    },
  },
];

function formatClipDuration(seconds?: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
}

export type ConsoleTab = 'goal' | 'penalty' | 'period' | 'speaker';

interface ArenaConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: ConsoleTab;
  onTabChange?: (tab: ConsoleTab) => void;
  homePlayers: Player[];
  visitorPlayers: Player[];
  activeTeamTab?: 'home' | 'visitor';
  onSwitchTeamTab?: (tab: 'home' | 'visitor') => void;
  homeTeamName?: string;
  visitorTeamName?: string;
  isAnnouncing: boolean;
  currentAnnouncement: Announcement | null;
  onScoreGoalWithAssist: (
    team: 'home' | 'visitor',
    scorer: Player,
    primaryAssist?: Player | null,
    secondaryAssist?: Player | null
  ) => Promise<void> | void;
  onAnnouncePenalty: (
    team: 'home' | 'visitor',
    player: Player,
    durationText: string,
    infraction: string,
    promptText: string,
    clockTime?: string
  ) => Promise<void> | void;
  onAnnouncePeriod: (period: 'first' | 'second' | 'third' | 'overtime') => Promise<void> | void;
  onTestSpeaker: () => Promise<void> | void;
  onWelcomeMessage: () => Promise<void> | void;
  onCustomAnnouncement?: (text: string) => Promise<void> | void;
  onReplayAnnouncement?: () => Promise<void> | void;
  onOpenMixer?: () => void;
}

export const ArenaConsoleModal: React.FC<ArenaConsoleModalProps> = ({
  isOpen,
  onClose,
  activeTab = 'goal',
  onTabChange,
  homePlayers,
  visitorPlayers,
  activeTeamTab,
  onSwitchTeamTab,
  homeTeamName = 'Pelham Pelicans',
  visitorTeamName = 'Visiting Team',
  isAnnouncing,
  currentAnnouncement,
  onScoreGoalWithAssist,
  onAnnouncePenalty,
  onAnnouncePeriod,
  onTestSpeaker,
  onWelcomeMessage,
  onCustomAnnouncement,
  onReplayAnnouncement,
  onOpenMixer,
}) => {
  const safeHomeTeamName = homeTeamName.trim() || 'Pelham Pelicans';
  const [currentTab, setCurrentTab] = useState<ConsoleTab>(activeTab);
  const [customText, setCustomText] = useState('');
  const [lastAnnouncedPeriod, setLastAnnouncedPeriod] = useState<string | null>(null);
  const [periodRecordings, setPeriodRecordings] = useState<Partial<Record<PeriodAlertKey, PeriodAlertAudio>>>(() =>
    soundEngine.getPeriodAlertRecordings()
  );
  const [playingPeriodKey, setPlayingPeriodKey] = useState<PeriodAlertKey | null>(() =>
    soundEngine.getActivePeriodAlertPlayback()
  );
  const [uploadingPeriodKey, setUploadingPeriodKey] = useState<PeriodAlertKey | null>(null);
  const [periodUploadFeedback, setPeriodUploadFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const fileInputRefs = useRef<Partial<Record<PeriodAlertKey, HTMLInputElement | null>>>({});

  // Sync tab with external prop when modal opens or prop changes
  useEffect(() => {
    if (isOpen) {
      setCurrentTab(activeTab);
      setPeriodRecordings(soundEngine.getPeriodAlertRecordings());
      setPlayingPeriodKey(soundEngine.getActivePeriodAlertPlayback());
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    const unsubAlerts = soundEngine.subscribeToPeriodAlerts((alerts) => {
      setPeriodRecordings(alerts);
    });
    const unsubPlay = soundEngine.subscribeToPeriodAlertPlayback((activeKey) => {
      setPlayingPeriodKey(activeKey);
    });
    return () => {
      unsubAlerts();
      unsubPlay();
    };
  }, []);

  if (!isOpen) return null;

  const handleSelectTab = (tab: ConsoleTab) => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const handleTriggerPeriod = async (period: PeriodAlertKey) => {
    setLastAnnouncedPeriod(period);
    await onAnnouncePeriod(period);
  };

  const handlePeriodFileSelected = async (period: PeriodAlertKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so uploading the same filename again still triggers onChange
    e.target.value = '';
    if (!file) return;

    const label =
      period === 'first' ? '1st Period' : period === 'second' ? '2nd Period' : period === 'third' ? '3rd Period' : 'Overtime';

    setUploadingPeriodKey(period);
    setPeriodUploadFeedback({
      type: 'info',
      message: `Saving ${label} voice recording "${file.name}"...`,
    });

    try {
      const res = await soundEngine.uploadPeriodAlertRecording(period, file);
      if (res.success) {
        setPeriodUploadFeedback({
          type: 'success',
          message: res.syncedToCloud
            ? `${label} recording saved locally & synced to cloud — ready for instant zero-delay rink playback.`
            : `${label} recording saved locally on this device for instant zero-delay playback.`,
        });
      } else {
        setPeriodUploadFeedback({
          type: 'error',
          message: res.error || 'Could not save voice recording.',
        });
      }
    } catch (err: any) {
      setPeriodUploadFeedback({
        type: 'error',
        message: err?.message || 'Failed to upload voice recording.',
      });
    } finally {
      setUploadingPeriodKey(null);
    }
  };

  const handleRemovePeriodRecording = async (period: PeriodAlertKey) => {
    const label =
      period === 'first' ? '1st Period' : period === 'second' ? '2nd Period' : period === 'third' ? '3rd Period' : 'Overtime';
    await soundEngine.deletePeriodAlertRecording(period);
    setPeriodUploadFeedback({
      type: 'info',
      message: `Removed custom ${label} recording. Reverted to AI voice announcement.`,
    });
  };

  const uploadedCount = PERIOD_ALERT_CARDS.filter((c) => Boolean(periodRecordings[c.key])).length;

  const handleSendCustom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customText.trim() || !onCustomAnnouncement) return;
    await onCustomAnnouncement(customText.trim());
    setCustomText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl sm:max-w-3xl overflow-hidden flex flex-col max-h-[95dvh] transition-all">
        {/* Unified Window Master Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-sky-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <Radio className={`w-5 h-5 ${isAnnouncing ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white font-athletic uppercase tracking-wider truncate">
                  Arena Announcer Console
                </h2>
                {isAnnouncing && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    LIVE BROADCAST
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Single window for Goal Keypad, Penalties, Period Warnings & Sound Check
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentAnnouncement && onReplayAnnouncement && (
              <button
                type="button"
                onClick={onReplayAnnouncement}
                disabled={isAnnouncing}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                title="Replay Last Announcement"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAnnouncing ? 'animate-spin' : ''}`} />
                <span>Replay</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close Console"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Master Navigation Tabs */}
        <div className="bg-slate-950/90 px-2 sm:px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-1 overflow-x-auto custom-scrollbar shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 min-w-max">
            {/* Tab 1: Keypad Goal */}
            <button
              type="button"
              id="console-tab-goal"
              onClick={() => handleSelectTab('goal')}
              className={`px-3 py-1.5 rounded-xl font-athletic font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                currentTab === 'goal'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-500/25 scale-[1.02]'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Keypad Goal</span>
            </button>

            {/* Tab 2: Penalty */}
            <button
              type="button"
              id="console-tab-penalty"
              onClick={() => handleSelectTab('penalty')}
              className={`px-3 py-1.5 rounded-xl font-athletic font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                currentTab === 'penalty'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 scale-[1.02]'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Penalty</span>
            </button>

            {/* Tab 3: Period Alerts */}
            <button
              type="button"
              id="console-tab-period"
              onClick={() => handleSelectTab('period')}
              className={`px-3 py-1.5 rounded-xl font-athletic font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                currentTab === 'period'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-[1.02]'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Period Alerts</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-950/80 border border-sky-400/40 text-sky-300 font-sans font-black">
                1 Min
              </span>
            </button>

            {/* Tab 4: Speaker & Welcome */}
            <button
              type="button"
              id="console-tab-speaker"
              onClick={() => handleSelectTab('speaker')}
              className={`px-3 py-1.5 rounded-xl font-athletic font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                currentTab === 'speaker'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 scale-[1.02]'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Speaker & Welcome</span>
            </button>

            {/* Tab 5: Mixer & Goal Horn */}
            {onOpenMixer && (
              <button
                type="button"
                id="console-tab-mixer"
                onClick={onOpenMixer}
                className="px-3 py-1.5 rounded-xl font-athletic font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 active:scale-95"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Mixer & Horn</span>
              </button>
            )}
          </div>
        </div>

        {/* Console Body: Render Selected View */}
        <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
          {/* VIEW 1: Keypad Goal */}
          {currentTab === 'goal' && (
            <QuickGoalModal
              isOpen={true}
              embedded={true}
              onClose={onClose}
              homePlayers={homePlayers}
              visitorPlayers={visitorPlayers}
              activeTeamTab={activeTeamTab}
              onSwitchTeamTab={onSwitchTeamTab}
              homeTeamName={safeHomeTeamName}
              visitorTeamName={visitorTeamName}
              onScoreGoalWithAssist={onScoreGoalWithAssist}
            />
          )}

          {/* VIEW 2: Penalty */}
          {currentTab === 'penalty' && (
            <PenaltyModal
              isOpen={true}
              embedded={true}
              onClose={onClose}
              homePlayers={homePlayers}
              visitorPlayers={visitorPlayers}
              activeTeamTab={activeTeamTab}
              onSwitchTeamTab={onSwitchTeamTab}
              homeTeamName={safeHomeTeamName}
              visitorTeamName={visitorTeamName}
              onAnnouncePenalty={onAnnouncePenalty}
            />
          )}

          {/* VIEW 3: Period Alerts ("One minute remaining in the [first/second/third] period") */}
          {currentTab === 'period' && (
            <div className="p-4 sm:p-6 space-y-4 animate-in fade-in duration-150">
              {/* Header Banner */}
              <div className="bg-slate-950/70 border border-sky-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-sky-950/20">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
                    <Timer className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white font-athletic uppercase tracking-wider">
                      Period End Warning Announcements
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Upload your own final-minute voice recordings (MP3, M4A, WAV) for{' '}
                      <span className="text-emerald-300 font-semibold">instant, zero-delay offline playback</span> in the rink.
                    </p>
                    <p className="text-[11px] text-sky-300/90 mt-1">
                      Slots without a custom recording automatically use the AI announcer voice.
                    </p>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1.5 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] font-bold text-slate-200">
                    <Zap className={`w-3.5 h-3.5 ${uploadedCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>{uploadedCount} / 4 Custom Clips</span>
                  </span>
                  {lastAnnouncedPeriod && (
                    <span className="text-[11px] text-slate-400">
                      Last played: {lastAnnouncedPeriod === 'overtime' ? 'Overtime' : `${lastAnnouncedPeriod} period`}
                    </span>
                  )}
                </div>
              </div>

              {/* Upload / Sync Feedback Banner */}
              {periodUploadFeedback && (
                <div
                  className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                    periodUploadFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                      : periodUploadFeedback.type === 'error'
                      ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                      : 'bg-sky-950/60 border-sky-500/40 text-sky-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {periodUploadFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : periodUploadFeedback.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <RefreshCw className={`w-4 h-4 text-sky-400 shrink-0 ${uploadingPeriodKey ? 'animate-spin' : ''}`} />
                    )}
                    <span className="truncate sm:whitespace-normal">{periodUploadFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPeriodUploadFeedback(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/60 shrink-0"
                    aria-label="Dismiss message"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Grid of Period Alert Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {PERIOD_ALERT_CARDS.map((card) => {
                  const recording = periodRecordings[card.key];
                  const isPlayingThis = playingPeriodKey === card.key;
                  const isUploadingThis = uploadingPeriodKey === card.key;
                  const durationLabel = formatClipDuration(recording?.duration);

                  return (
                    <div
                      key={card.key}
                      className={`p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border ${
                        isPlayingThis
                          ? 'border-emerald-400/80 shadow-lg shadow-emerald-500/20'
                          : `border-slate-700/80 ${card.accent.borderHover} shadow-lg ${card.accent.shadowHover}`
                      } transition-all flex flex-col justify-between gap-3.5 relative overflow-hidden`}
                    >
                      {/* Hidden file input for this period slot */}
                      <input
                        ref={(el) => {
                          fileInputRefs.current[card.key] = el;
                        }}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4"
                        onChange={(e) => handlePeriodFileSelected(card.key, e)}
                        className="hidden"
                      />

                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center font-athletic font-black shrink-0 ${
                              card.key === 'overtime' ? 'text-lg' : 'text-xl'
                            } ${card.accent.iconBg}`}
                          >
                            {card.badge}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-athletic font-bold text-base text-white uppercase tracking-wider truncate">
                              {card.title}
                            </h4>
                            <span className="text-[11px] font-semibold text-slate-400 block truncate">
                              {card.subtitle}
                            </span>
                          </div>
                        </div>

                        {recording ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-bold uppercase shrink-0">
                            <Zap className="w-3 h-3" />
                            <span>Instant{durationLabel ? ` • ${durationLabel}` : ''}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 font-semibold uppercase shrink-0">
                            AI Voice
                          </span>
                        )}
                      </div>

                      {/* Recording / Script Details Box */}
                      {recording ? (
                        <div className="bg-emerald-950/25 rounded-xl p-3 border border-emerald-500/30">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <Mic className="w-3 h-3" />
                              <span>Uploaded Voice Recording</span>
                            </span>
                            {lastAnnouncedPeriod === card.key && !isPlayingThis && (
                              <span className="text-[10px] flex items-center gap-1 text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Played
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-100 mt-1 truncate" title={recording.filename}>
                            {recording.filename}
                          </p>
                          <p className="text-[11px] text-emerald-300/80 mt-0.5">
                            Pre-loaded locally • Instant playback with no network delay
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                              Default AI Voice Call:
                            </span>
                            {lastAnnouncedPeriod === card.key && (
                              <span className="text-[10px] flex items-center gap-1 text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Played
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-0.5">
                            &ldquo;{card.script}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Primary Broadcast Button */}
                      <button
                        type="button"
                        id={card.id}
                        disabled={(isAnnouncing && !isPlayingThis) || isUploadingThis}
                        onClick={() => handleTriggerPeriod(card.key)}
                        className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs sm:text-sm border flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md ${
                          isPlayingThis
                            ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-500/25'
                            : recording
                            ? card.accent.playBtnRecording
                            : card.accent.playBtn
                        }`}
                      >
                        {isPlayingThis ? (
                          <>
                            <Square className="w-4 h-4 fill-current animate-pulse" />
                            <span>Stop {card.playLabel} Recording</span>
                          </>
                        ) : recording ? (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>Play {card.playLabel} Recording</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4" />
                            <span>Announce {card.playLabel}</span>
                          </>
                        )}
                      </button>

                      {/* Upload / Replace / Remove Controls Row */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          disabled={isUploadingThis}
                          onClick={() => fileInputRefs.current[card.key]?.click()}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {isUploadingThis ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5 text-sky-400" />
                              <span>{recording ? 'Replace Recording' : 'Upload Voice Recording'}</span>
                            </>
                          )}
                        </button>

                        {recording && (
                          <button
                            type="button"
                            disabled={isUploadingThis}
                            onClick={() => handleRemovePeriodRecording(card.key)}
                            title="Remove custom recording and revert to AI voice"
                            className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-rose-950/70 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Jump Links to Speaker & Welcome */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-300 font-medium">Looking for pre-game announcements?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTab('speaker')}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Go to Speaker & Welcome</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: Speaker & Welcome */}
          {currentTab === 'speaker' && (
            <div className="p-4 sm:p-6 space-y-5 animate-in fade-in duration-150">
              {/* Header Banner */}
              <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-emerald-950/20">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white font-athletic uppercase tracking-wider">
                      Pre-Game Audio Check & Welcome Message
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Verify arena sound system clarity or welcome the visiting team before puck drop.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Test Speaker Card */}
                <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg hover:border-cyan-500/40 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-athletic font-bold text-base text-white uppercase tracking-wider">
                            Test Speaker
                          </h4>
                          <span className="text-[11px] text-slate-400">Audio System Sound Check</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700 font-bold uppercase">
                        Pre-Game
                      </span>
                    </div>

                    <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        Spoken Check:
                      </p>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5">
                        &ldquo;Speaker check: One, two, three. Testing arena sound system. Audio is loud and clear.&rdquo;
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="speaker-test-action-btn"
                    disabled={isAnnouncing}
                    onClick={onTestSpeaker}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-athletic font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{isAnnouncing ? 'Broadcasting...' : 'Run Speaker Check'}</span>
                  </button>
                </div>

                {/* 2. Welcome Message Card */}
                <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg hover:border-amber-500/40 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-athletic font-bold text-base text-white uppercase tracking-wider">
                            Welcome Message
                          </h4>
                          <span className="text-[11px] text-slate-400">Hosting {visitorTeamName}</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 font-bold uppercase">
                        Anthem Call
                      </span>
                    </div>

                    <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        Spoken Announcement:
                      </p>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5 line-clamp-3">
                        &ldquo;Welcome, everyone, and thank you for joining us for today’s hockey game. The {safeHomeTeamName} are excited to host {visitorTeamName}... Please line up for our national anthem.&rdquo;
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="welcome-msg-action-btn"
                    disabled={isAnnouncing}
                    onClick={onWelcomeMessage}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-athletic font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAnnouncing ? 'Broadcasting...' : 'Broadcast Welcome Message'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Custom Live Arena Announcement */}
              {onCustomAnnouncement && (
                <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-purple-400" />
                      <h4 className="font-athletic font-bold text-sm text-white uppercase tracking-wider">
                        Custom Arena Announcement
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400">Speak any custom message</span>
                  </div>

                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Puck out of play.',
                      'Please watch for flying pucks in the spectator area.',
                      'Ice resurfacing in progress. Game will resume shortly.',
                      'Two minutes remaining in warm-up.',
                      `${safeHomeTeamName} 50/50 raffle tickets now on sale.`,
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCustomText(preset)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-slate-700 transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSendCustom} className="flex gap-2">
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Type custom announcement..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    />
                    <button
                      type="submit"
                      disabled={!customText.trim() || isAnnouncing}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-athletic font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/25 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Broadcast</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
