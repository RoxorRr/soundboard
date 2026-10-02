import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Player, Announcement } from '../types';
import { QuickGoalModal } from './QuickGoalModal';
import { PenaltyModal } from './PenaltyModal';

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
}) => {
  const [currentTab, setCurrentTab] = useState<ConsoleTab>(activeTab);
  const [customText, setCustomText] = useState('');
  const [lastAnnouncedPeriod, setLastAnnouncedPeriod] = useState<string | null>(null);

  // Sync tab with external prop when modal opens or prop changes
  useEffect(() => {
    if (isOpen) {
      setCurrentTab(activeTab);
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSelectTab = (tab: ConsoleTab) => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const handleTriggerPeriod = async (period: 'first' | 'second' | 'third' | 'overtime') => {
    setLastAnnouncedPeriod(period);
    await onAnnouncePeriod(period);
  };

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
              visitorTeamName={visitorTeamName}
              onAnnouncePenalty={onAnnouncePenalty}
            />
          )}

          {/* VIEW 3: Period Alerts ("One minute remaining in the [first/second/third] period") */}
          {currentTab === 'period' && (
            <div className="p-4 sm:p-6 space-y-5 animate-in fade-in duration-150">
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
                      Standard NHL & NCAA arena call sounded when 1:00 remains on the game clock.
                    </p>
                    <p className="text-[11px] text-sky-300 font-semibold mt-1">
                      Tap any period card below to broadcast through arena speakers instantly.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 justify-end">
                  <span className="text-[11px] text-slate-400">
                    {lastAnnouncedPeriod ? `Last announced: ${lastAnnouncedPeriod}` : 'Ready to broadcast'}
                  </span>
                </div>
              </div>

              {/* Grid of Period Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* 1st Period Button */}
                <button
                  type="button"
                  id="period-btn-first"
                  disabled={isAnnouncing}
                  onClick={() => handleTriggerPeriod('first')}
                  className="group text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 hover:from-slate-850 hover:to-slate-900 border border-slate-700/80 hover:border-sky-400/60 shadow-lg hover:shadow-sky-500/15 active:scale-[0.98] transition-all flex flex-col justify-between gap-4 disabled:opacity-50 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/20 group-hover:bg-sky-500/30 text-sky-400 border border-sky-500/40 flex items-center justify-center font-athletic font-black text-xl transition-colors">
                        1
                      </div>
                      <div>
                        <h4 className="font-athletic font-bold text-base text-white group-hover:text-sky-300 transition-colors uppercase tracking-wider">
                          1st Period Warning
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300">
                          1:00 Remaining
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700 font-bold uppercase">
                      Period 1
                    </span>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 group-hover:border-sky-500/30 transition-colors">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-[10px]">
                      Spoken Arena Announcement:
                    </p>
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-sky-200 mt-0.5">
                      &ldquo;One minute remaining in the first period.&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 group-hover:text-sky-300">
                      <Volume2 className="w-4 h-4" />
                      <span>Announce 1st Period</span>
                    </div>
                    {lastAnnouncedPeriod === 'first' && (
                      <span className="text-[10px] flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Just played
                      </span>
                    )}
                  </div>
                </button>

                {/* 2nd Period Button */}
                <button
                  type="button"
                  id="period-btn-second"
                  disabled={isAnnouncing}
                  onClick={() => handleTriggerPeriod('second')}
                  className="group text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 hover:from-slate-850 hover:to-slate-900 border border-slate-700/80 hover:border-amber-400/60 shadow-lg hover:shadow-amber-500/15 active:scale-[0.98] transition-all flex flex-col justify-between gap-4 disabled:opacity-50 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 group-hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 flex items-center justify-center font-athletic font-black text-xl transition-colors">
                        2
                      </div>
                      <div>
                        <h4 className="font-athletic font-bold text-base text-white group-hover:text-amber-300 transition-colors uppercase tracking-wider">
                          2nd Period Warning
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300">
                          1:00 Remaining
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 font-bold uppercase">
                      Period 2
                    </span>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 group-hover:border-amber-500/30 transition-colors">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-[10px]">
                      Spoken Arena Announcement:
                    </p>
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-amber-200 mt-0.5">
                      &ldquo;One minute remaining in the second period.&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 group-hover:text-amber-300">
                      <Volume2 className="w-4 h-4" />
                      <span>Announce 2nd Period</span>
                    </div>
                    {lastAnnouncedPeriod === 'second' && (
                      <span className="text-[10px] flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Just played
                      </span>
                    )}
                  </div>
                </button>

                {/* 3rd Period Button */}
                <button
                  type="button"
                  id="period-btn-third"
                  disabled={isAnnouncing}
                  onClick={() => handleTriggerPeriod('third')}
                  className="group text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 hover:from-slate-850 hover:to-slate-900 border border-slate-700/80 hover:border-emerald-400/60 shadow-lg hover:shadow-emerald-500/15 active:scale-[0.98] transition-all flex flex-col justify-between gap-4 disabled:opacity-50 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 group-hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-athletic font-black text-xl transition-colors">
                        3
                      </div>
                      <div>
                        <h4 className="font-athletic font-bold text-base text-white group-hover:text-emerald-300 transition-colors uppercase tracking-wider">
                          3rd Period Warning
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300">
                          1:00 Remaining • Final Regulation Minute
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-300 border border-slate-700 font-bold uppercase">
                      Period 3
                    </span>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 group-hover:border-emerald-500/30 transition-colors">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-[10px]">
                      Spoken Arena Announcement:
                    </p>
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-emerald-200 mt-0.5">
                      &ldquo;One minute remaining in the third period.&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                      <Volume2 className="w-4 h-4" />
                      <span>Announce 3rd Period</span>
                    </div>
                    {lastAnnouncedPeriod === 'third' && (
                      <span className="text-[10px] flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Just played
                      </span>
                    )}
                  </div>
                </button>

                {/* Overtime Button */}
                <button
                  type="button"
                  id="period-btn-ot"
                  disabled={isAnnouncing}
                  onClick={() => handleTriggerPeriod('overtime')}
                  className="group text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 hover:from-slate-850 hover:to-slate-900 border border-slate-700/80 hover:border-purple-400/60 shadow-lg hover:shadow-purple-500/15 active:scale-[0.98] transition-all flex flex-col justify-between gap-4 disabled:opacity-50 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 group-hover:bg-purple-500/30 text-purple-400 border border-purple-500/40 flex items-center justify-center font-athletic font-black text-lg transition-colors">
                        OT
                      </div>
                      <div>
                        <h4 className="font-athletic font-bold text-base text-white group-hover:text-purple-300 transition-colors uppercase tracking-wider">
                          Overtime Warning
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300">
                          1:00 Remaining in OT
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 border border-slate-700 font-bold uppercase">
                      Overtime
                    </span>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 group-hover:border-purple-500/30 transition-colors">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-[10px]">
                      Spoken Arena Announcement:
                    </p>
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-purple-200 mt-0.5">
                      &ldquo;One minute remaining in overtime.&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 group-hover:text-purple-300">
                      <Volume2 className="w-4 h-4" />
                      <span>Announce Overtime</span>
                    </div>
                    {lastAnnouncedPeriod === 'overtime' && (
                      <span className="text-[10px] flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Just played
                      </span>
                    )}
                  </div>
                </button>
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
                        &ldquo;Welcome, everyone, and thank you for joining us for today’s hockey game. The Pelham Pelicans are excited to host {visitorTeamName}... Please line up for our national anthem.&rdquo;
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
                      'Pelham Pelicans 50/50 raffle tickets now on sale.',
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
