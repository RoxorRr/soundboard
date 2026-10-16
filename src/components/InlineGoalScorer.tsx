import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  Award,
  Volume2,
  Music,
  Square,
  Play,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  X,
  Search,
  Radio,
} from 'lucide-react';
import { Player } from '../types';
import { generateGoalWithAssistPrompt } from '../utils/audio';

interface InlineGoalScorerProps {
  isOpen: boolean;
  onClose?: () => void;
  homePlayers: Player[];
  visitorPlayers: Player[];
  activeTeamTab: 'home' | 'visitor';
  visitorTeamName: string;
  isMp3Playing: boolean;
  onToggleMp3: () => void;
  isAnnouncing: boolean;
  initialScorer?: Player | null;
  onScoreGoalWithAssist: (
    team: 'home' | 'visitor',
    scorer: Player,
    primaryAssist?: Player | null,
    secondaryAssist?: Player | null
  ) => Promise<void> | void;
}

type SlotMode = 'scorer' | 'assist1' | 'assist2';

export const InlineGoalScorer: React.FC<InlineGoalScorerProps> = ({
  isOpen,
  onClose,
  homePlayers,
  visitorPlayers,
  activeTeamTab,
  visitorTeamName,
  isMp3Playing,
  onToggleMp3,
  isAnnouncing,
  initialScorer = null,
  onScoreGoalWithAssist,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'visitor'>(activeTeamTab);
  const [scorer, setScorer] = useState<Player | null>(initialScorer);
  const [assist1, setAssist1] = useState<Player | null>(null);
  const [assist2, setAssist2] = useState<Player | null>(null);
  const [activeSlot, setActiveSlot] = useState<SlotMode>(initialScorer ? 'assist1' : 'scorer');
  const [customNumberInput, setCustomNumberInput] = useState<string>('');
  const [recentAnnouncementFeedback, setRecentAnnouncementFeedback] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Sync team when tab changes or opens
  useEffect(() => {
    setSelectedTeam(activeTeamTab);
  }, [activeTeamTab, isOpen]);

  // Sync initialScorer if passed from outside
  useEffect(() => {
    if (initialScorer) {
      setScorer(initialScorer);
      setActiveSlot('assist1');
    }
  }, [initialScorer]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const teamName = selectedTeam === 'visitor' ? (visitorTeamName.trim() || 'Visiting Team') : 'Pelham Pelicans';
  const players = selectedTeam === 'visitor' ? visitorPlayers : homePlayers;

  // Filtered players for fast lookup
  const filteredPlayers = useMemo(() => {
    if (!searchFilter.trim()) return players;
    const q = searchFilter.toLowerCase().trim();
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.number).includes(q)
    );
  }, [players, searchFilter]);

  // Clear selections when switching teams
  const handleSwitchTeam = (team: 'home' | 'visitor') => {
    setSelectedTeam(team);
    setScorer(null);
    setAssist1(null);
    setAssist2(null);
    setActiveSlot('scorer');
    setCustomNumberInput('');
    setSearchFilter('');
  };

  const handlePlayerTap = (player: Player) => {
    if (activeSlot === 'scorer') {
      setScorer(player);
      // Auto-advance cursor to assist 1 for fast flow
      setActiveSlot('assist1');
    } else if (activeSlot === 'assist1') {
      if (scorer && scorer.number === player.number) {
        // Can't assist yourself; re-select as scorer
        setScorer(player);
      } else {
        setAssist1(player);
        setActiveSlot('assist2');
      }
    } else if (activeSlot === 'assist2') {
      if (scorer && scorer.number === player.number) {
        setScorer(player);
      } else if (assist1 && assist1.number === player.number) {
        setAssist1(player);
      } else {
        setAssist2(player);
      }
    }
  };

  const handleCustomNumberAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(customNumberInput.trim(), 10);
    if (isNaN(num)) return;

    let p = players.find((x) => x.number === num);
    if (!p) {
      p = {
        id: `${selectedTeam}_custom_${Date.now()}_${num}`,
        number: num,
        name: `Player #${num}`,
        goals: 0,
        assists: 0,
      };
    }
    setCustomNumberInput('');
    handlePlayerTap(p);
  };

  const handleClearSelection = () => {
    setScorer(null);
    setAssist1(null);
    setAssist2(null);
    setActiveSlot('scorer');
    setCustomNumberInput('');
    setSearchFilter('');
  };

  // Generate live announcement preview prompt
  const previewPrompt = useMemo(() => {
    if (!scorer) return null;
    return generateGoalWithAssistPrompt(
      scorer.number,
      scorer.name,
      assist1 ? assist1.number : null,
      assist1 ? assist1.name : null,
      assist2 ? assist2.number : null,
      assist2 ? assist2.name : null,
      teamName
    );
  }, [scorer, assist1, assist2, teamName]);

  // STEP 3 TRIGGER: Play voice-over announcement over the MP3 and record score
  const handlePlayVoiceOver = async () => {
    if (!scorer) return;

    const currentScorer = scorer;
    const currentA1 = assist1;
    const currentA2 = assist2;

    const feedback = currentA1
      ? `Goal by #${currentScorer.number} ${currentScorer.name} (Assisted by #${currentA1.number}) recorded and announced!`
      : `Goal by #${currentScorer.number} ${currentScorer.name} recorded and announced!`;
    setRecentAnnouncementFeedback(feedback);

    try {
      await onScoreGoalWithAssist(selectedTeam, currentScorer, currentA1, currentA2);
    } catch (err) {
      console.warn('Voice announcement error:', err);
    }

    // Reset selection for next goal
    setScorer(null);
    setAssist1(null);
    setAssist2(null);
    setActiveSlot('scorer');

    setTimeout(() => {
      setRecentAnnouncementFeedback(null);
    }, 4000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl w-full max-w-2xl sm:max-w-3xl max-h-[92dvh] shadow-2xl shadow-amber-500/20 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL POP-UP HEADER */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/30 shrink-0">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black uppercase font-athletic tracking-wider text-amber-300 truncate">
                  Goal Action Center
                </h2>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.2 rounded hidden sm:inline">
                  Pop-Up Window
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Step 1: Goal Horn · Step 2: Scorer &amp; Assists · Step 3: Voice-Over Over MP3
              </p>
            </div>
          </div>

          {/* Team Selection Tabs + Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => handleSwitchTeam('home')}
                className={`px-2.5 py-1 rounded text-xs font-bold font-athletic uppercase tracking-wider transition-all ${
                  selectedTeam === 'home'
                    ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pelham
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTeam('visitor')}
                className={`px-2.5 py-1 rounded text-xs font-bold font-athletic uppercase tracking-wider transition-all ${
                  selectedTeam === 'visitor'
                    ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {visitorTeamName.trim() || 'Visitor'}
              </button>
            </div>

            {/* Close Button */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0 active:scale-95"
                title="Close Window (Esc)"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* SCROLLABLE INNER BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-3 sm:p-4 space-y-3">
          {/* --- STEP 1: COMPACT GOAL HORN TRIGGER --- */}
          <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-mono shrink-0 border border-amber-500/40">
                1
              </span>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white uppercase font-athletic tracking-wide block truncate">
                  Step 1: Goal Horn MP3
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {isMp3Playing
                    ? '🔊 Goal Horn MP3 is currently blasting across the arena'
                    : 'Click to trigger the authentic Pelham goal horn MP3 track'}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="inline-goal-horn-btn"
              onClick={onToggleMp3}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold font-athletic uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0 ${
                isMp3Playing
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse shadow-red-600/40 ring-2 ring-red-400'
                  : 'bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white shadow-red-600/25 ring-1 ring-amber-400/50'
              }`}
              title={isMp3Playing ? 'Stop Goal Horn MP3' : 'Trigger Goal Horn MP3 track'}
            >
              {isMp3Playing ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>⏹️ Stop Horn</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current text-yellow-300" />
                  <span>🚨 Trigger Horn</span>
                </>
              )}
            </button>
          </div>

          {/* --- STEP 2: CONNECTED SCORER & ASSISTS SLOTS --- */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-mono shrink-0 border border-amber-500/40">
                  2
                </span>
                <span className="text-xs sm:text-sm font-bold text-white uppercase font-athletic tracking-wide">
                  Step 2: Select Scorer &amp; Assists ({teamName})
                </span>
              </div>

              {(scorer || assist1 || assist2) && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Selection</span>
                </button>
              )}
            </div>

            {/* 3 Connected Selection Slots: Scorer, Assist 1, Assist 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Slot 1: Scorer */}
              <button
                type="button"
                onClick={() => setActiveSlot('scorer')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activeSlot === 'scorer'
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/80 shadow-md shadow-amber-500/10'
                    : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase font-athletic tracking-wider text-amber-400 flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-current" /> Goal Scorer:
                  </span>
                  {activeSlot === 'scorer' && (
                    <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black uppercase">
                      Selecting
                    </span>
                  )}
                </div>
                <div className="font-bold text-xs sm:text-sm text-white truncate">
                  {scorer ? `#${scorer.number} ${scorer.name}` : <span className="text-slate-500 italic font-normal">Tap player below</span>}
                </div>
              </button>

              {/* Slot 2: 1st Assist */}
              <button
                type="button"
                onClick={() => setActiveSlot('assist1')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activeSlot === 'assist1'
                    ? 'border-sky-400 bg-sky-500/15 ring-2 ring-sky-400/80 shadow-md shadow-sky-500/10'
                    : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase font-athletic tracking-wider text-sky-400 flex items-center gap-1">
                    <Award className="w-3 h-3" /> 1st Assist (Optional):
                  </span>
                  {activeSlot === 'assist1' && (
                    <span className="text-[9px] bg-sky-500 text-slate-950 px-1.5 py-0.2 rounded font-black uppercase">
                      Selecting
                    </span>
                  )}
                </div>
                <div className="font-bold text-xs sm:text-sm text-white truncate">
                  {assist1 ? `#${assist1.number} ${assist1.name}` : <span className="text-slate-500 italic font-normal">None (Optional)</span>}
                </div>
              </button>

              {/* Slot 3: 2nd Assist */}
              <button
                type="button"
                onClick={() => setActiveSlot('assist2')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activeSlot === 'assist2'
                    ? 'border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-400/80 shadow-md shadow-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase font-athletic tracking-wider text-indigo-400 flex items-center gap-1">
                    <Award className="w-3 h-3" /> 2nd Assist (Optional):
                  </span>
                  {activeSlot === 'assist2' && (
                    <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.2 rounded font-black uppercase">
                      Selecting
                    </span>
                  )}
                </div>
                <div className="font-bold text-xs sm:text-sm text-white truncate">
                  {assist2 ? `#${assist2.number} ${assist2.name}` : <span className="text-slate-500 italic font-normal">None (Optional)</span>}
                </div>
              </button>
            </div>

            {/* Compact Player Roster Grid with Search */}
            <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-400 gap-2">
                <span className="truncate">
                  Tap player to assign as{' '}
                  <strong className={activeSlot === 'scorer' ? 'text-amber-400' : 'text-sky-400'}>
                    {activeSlot === 'scorer' ? 'GOAL SCORER' : activeSlot === 'assist1' ? '1ST ASSIST' : '2ND ASSIST'}
                  </strong>
                  :
                </span>

                {/* Quick filter search */}
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search name or #"
                    className="w-32 sm:w-40 pl-6 pr-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Player Grid - Smooth Touch Scrolling */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 max-h-40 sm:max-h-48 overflow-y-auto custom-scrollbar p-0.5 overscroll-contain">
                {filteredPlayers.map((p) => {
                  const isSelectedScorer = scorer?.number === p.number;
                  const isSelectedA1 = assist1?.number === p.number;
                  const isSelectedA2 = assist2?.number === p.number;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePlayerTap(p)}
                      className={`p-1.5 rounded-lg border text-left transition-all active:scale-95 flex items-center justify-between gap-1.5 ${
                        isSelectedScorer
                          ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400 text-white font-bold'
                          : isSelectedA1
                          ? 'bg-sky-500/25 border-sky-400 ring-2 ring-sky-400 text-white font-bold'
                          : isSelectedA2
                          ? 'bg-indigo-500/25 border-indigo-400 ring-2 ring-indigo-400 text-white font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`font-athletic font-black text-xs px-1 rounded tabular-nums shrink-0 ${
                          isSelectedScorer
                            ? 'bg-amber-500 text-slate-950'
                            : isSelectedA1
                            ? 'bg-sky-500 text-slate-950'
                            : isSelectedA2
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        #{p.number}
                      </span>
                      <span className="text-xs truncate flex-1 leading-tight">{p.name}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                        {isSelectedScorer && '⚽'}
                        {isSelectedA1 && '👟1'}
                        {isSelectedA2 && '👟2'}
                        {!isSelectedScorer && !isSelectedA1 && !isSelectedA2 && `${p.goals}G`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Jersey # Input for Unlisted Players */}
              <form onSubmit={handleCustomNumberAdd} className="flex items-center gap-2 pt-1.5 border-t border-slate-800 text-xs">
                <span className="font-bold text-slate-400 font-athletic uppercase shrink-0">
                  Or Type Jersey #:
                </span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={customNumberInput}
                  onChange={(e) => setCustomNumberInput(e.target.value)}
                  placeholder="#"
                  className="w-14 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold text-center text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!customNumberInput.trim()}
                  className="px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-athletic font-bold uppercase border border-amber-500/30 disabled:opacity-30"
                >
                  Assign #{customNumberInput.trim() || '?'}
                </button>
              </form>
            </div>
          </div>

          {/* --- STEP 3: PLAY VOICE-OVER ANNOUNCEMENT --- */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-mono shrink-0 border border-amber-500/40">
                3
              </span>
              <span className="text-xs sm:text-sm font-bold text-white uppercase font-athletic tracking-wide">
                Step 3: Play Voice-Over (Announces Over MP3)
              </span>
            </div>

            {previewPrompt ? (
              <div className="p-2 sm:p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    Connected Voice Announcement:
                  </span>
                  <p className="font-medium italic leading-relaxed text-xs sm:text-sm">
                    &ldquo;{previewPrompt}&rdquo;
                  </p>
                  {isMp3Playing && (
                    <span className="text-xs text-emerald-300 mt-1 flex items-center gap-1.5 font-semibold">
                      <Music className="w-3.5 h-3.5 animate-bounce" />
                      Voice announces smoothly OVER active Goal Horn MP3 track!
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 italic">
                Tap a player in Step 2 to select the goal scorer and optional assists.
              </div>
            )}

            {/* Big Action Button */}
            <button
              type="button"
              id="btn-play-voice-over"
              disabled={!scorer || isAnnouncing}
              onClick={handlePlayVoiceOver}
              className={`w-full py-2.5 px-4 rounded-xl font-athletic font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] ${
                !scorer
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : isAnnouncing
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/30 ring-2 ring-amber-300/80 cursor-pointer'
              }`}
            >
              <Volume2 className={`w-4 h-4 ${isAnnouncing ? 'animate-bounce' : ''}`} />
              <span className="truncate">
                {isAnnouncing
                  ? '📢 Announcing Voice-Over...'
                  : scorer
                  ? `📢 Announce Goal: #${scorer.number} ${scorer.name} ${assist1 ? `+ Assist #${assist1.number}` : ''}`
                  : 'Select Scorer to Announce'}
              </span>
            </button>

            {recentAnnouncementFeedback && (
              <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-500/60 text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{recentAnnouncementFeedback}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
