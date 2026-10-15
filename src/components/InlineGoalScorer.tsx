import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  Award,
  Volume2,
  Music,
  Square,
  Play,
  CheckCircle2,
  AlertCircle,
  Hash,
  Sparkles,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
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
  onScoreGoalWithAssist,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'visitor'>(activeTeamTab);
  const [scorer, setScorer] = useState<Player | null>(null);
  const [assist1, setAssist1] = useState<Player | null>(null);
  const [assist2, setAssist2] = useState<Player | null>(null);
  const [activeSlot, setActiveSlot] = useState<SlotMode>('scorer');
  const [customNumberInput, setCustomNumberInput] = useState<string>('');
  const [recentAnnouncementFeedback, setRecentAnnouncementFeedback] = useState<string | null>(null);

  // Sync team when tab changes or opens
  useEffect(() => {
    setSelectedTeam(activeTeamTab);
  }, [activeTeamTab]);

  const teamName = selectedTeam === 'visitor' ? (visitorTeamName.trim() || 'Visiting Team') : 'Pelham Pelicans';
  const players = selectedTeam === 'visitor' ? visitorPlayers : homePlayers;

  // Clear selections when switching teams
  const handleSwitchTeam = (team: 'home' | 'visitor') => {
    setSelectedTeam(team);
    setScorer(null);
    setAssist1(null);
    setAssist2(null);
    setActiveSlot('scorer');
    setCustomNumberInput('');
  };

  const handlePlayerTap = (player: Player) => {
    if (activeSlot === 'scorer') {
      setScorer(player);
      // Auto-advance cursor to assist 1 for convenience, but keep scorer highlighted
      setActiveSlot('assist1');
    } else if (activeSlot === 'assist1') {
      if (scorer && scorer.number === player.number) {
        // Can't assist yourself; set as scorer
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

    setRecentAnnouncementFeedback(`Goal announced: #${currentScorer.number} ${currentScorer.name}! Voice playing over MP3.`);

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
    <div className="bg-slate-900 border-2 border-amber-500/70 rounded-xl p-3 sm:p-4 my-2.5 shadow-2xl shadow-amber-500/15 animate-in fade-in select-none">
      {/* Step Indicators Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/30 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase font-athletic tracking-wider text-amber-300 flex items-center gap-2">
              <span>Goal Action Center</span>
              <span className="text-[10px] font-sans font-normal text-slate-400 capitalize hidden sm:inline">
                (1. Trigger Horn • 2. Select Scorer/Assists • 3. Play Voice)
              </span>
            </h3>
          </div>
        </div>

        {/* Team Selection Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => handleSwitchTeam('home')}
            className={`px-2 sm:px-3 py-1 rounded text-xs font-bold font-athletic uppercase tracking-wider transition-all ${
              selectedTeam === 'home'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pelham Pelicans
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTeam('visitor')}
            className={`px-2 sm:px-3 py-1 rounded text-xs font-bold font-athletic uppercase tracking-wider transition-all ${
              selectedTeam === 'visitor'
                ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {visitorTeamName.trim() || 'Visiting Team'}
          </button>
        </div>
      </div>

      {/* --- STEP 1: GOAL HORN TRIGGER BUTTON --- */}
      <div className="mb-3 p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-mono">
            1
          </span>
          <div>
            <span className="text-xs font-bold text-white uppercase font-athletic tracking-wide">
              Step 1: Goal Horn
            </span>
            <span className="text-[10px] text-slate-400 block">
              {isMp3Playing
                ? 'Goal horn MP3 is currently playing across arena'
                : 'Click button to trigger the goal horn MP3 (does not play automatically)'}
            </span>
          </div>
        </div>

        <button
          type="button"
          id="inline-goal-horn-btn"
          onClick={onToggleMp3}
          className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold font-athletic uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 ${
            isMp3Playing
              ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white animate-pulse shadow-red-600/40 ring-2 ring-red-400'
              : 'bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white shadow-red-600/25 ring-1 ring-amber-400/50'
          }`}
          title={isMp3Playing ? 'Click to Stop Goal Horn MP3' : 'Click to Trigger Goal Horn MP3 track'}
        >
          {isMp3Playing ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>⏹️ Stop Goal Horn (MP3)</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current text-yellow-300" />
              <span>🚨 Click to Trigger Goal Horn (MP3)</span>
            </>
          )}
        </button>
      </div>

      {/* --- STEP 2: SELECT SCORER & ASSISTS ON SAME SCREEN --- */}
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-mono">
              2
            </span>
            <span className="text-xs font-bold text-white uppercase font-athletic tracking-wide">
              Step 2: Select Goal Scorer & Assists ({teamName})
            </span>
          </div>

          {(scorer || assist1 || assist2) && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors underline"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Selection</span>
            </button>
          )}
        </div>

        {/* Selected Slots Pills (Scorer, Assist 1, Assist 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Slot 1: Goal Scorer */}
          <button
            type="button"
            onClick={() => setActiveSlot('scorer')}
            className={`p-2 rounded-lg border text-left transition-all ${
              activeSlot === 'scorer'
                ? 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-400'
                : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold uppercase font-athletic tracking-wider text-amber-400 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Goal Scorer:
              </span>
              {activeSlot === 'scorer' && (
                <span className="text-[9px] bg-amber-500 text-slate-950 px-1 rounded font-bold">
                  Selecting
                </span>
              )}
            </div>
            <div className="font-semibold text-xs text-white truncate">
              {scorer ? `#${scorer.number} ${scorer.name}` : <span className="text-slate-500 italic">Tap player below...</span>}
            </div>
          </button>

          {/* Slot 2: 1st Assist */}
          <button
            type="button"
            onClick={() => setActiveSlot('assist1')}
            className={`p-2 rounded-lg border text-left transition-all ${
              activeSlot === 'assist1'
                ? 'border-sky-400 bg-sky-500/15 ring-1 ring-sky-400'
                : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold uppercase font-athletic tracking-wider text-sky-400 flex items-center gap-1">
                <Award className="w-3 h-3" /> 1st Assist (Optional):
              </span>
              {activeSlot === 'assist1' && (
                <span className="text-[9px] bg-sky-500 text-slate-950 px-1 rounded font-bold">
                  Selecting
                </span>
              )}
            </div>
            <div className="font-semibold text-xs text-white truncate">
              {assist1 ? (
                `#${assist1.number} ${assist1.name}`
              ) : (
                <span className="text-slate-500 italic">None (Optional)</span>
              )}
            </div>
          </button>

          {/* Slot 3: 2nd Assist */}
          <button
            type="button"
            onClick={() => setActiveSlot('assist2')}
            className={`p-2 rounded-lg border text-left transition-all ${
              activeSlot === 'assist2'
                ? 'border-indigo-400 bg-indigo-500/15 ring-1 ring-indigo-400'
                : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold uppercase font-athletic tracking-wider text-indigo-400 flex items-center gap-1">
                <Award className="w-3 h-3" /> 2nd Assist (Optional):
              </span>
              {activeSlot === 'assist2' && (
                <span className="text-[9px] bg-indigo-500 text-white px-1 rounded font-bold">
                  Selecting
                </span>
              )}
            </div>
            <div className="font-semibold text-xs text-white truncate">
              {assist2 ? (
                `#${assist2.number} ${assist2.name}`
              ) : (
                <span className="text-slate-500 italic">None (Optional)</span>
              )}
            </div>
          </button>
        </div>

        {/* Player Roster Grid (Tap to assign to active slot) */}
        <div className="bg-slate-950/90 rounded-lg p-2 border border-slate-800">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-850 text-[10px] text-slate-400">
            <span>
              Tap player to assign as{' '}
              <strong className={activeSlot === 'scorer' ? 'text-amber-400' : 'text-sky-400'}>
                {activeSlot === 'scorer' ? 'GOAL SCORER' : activeSlot === 'assist1' ? '1st ASSIST' : '2nd ASSIST'}
              </strong>
              :
            </span>
            <span className="font-mono">{players.length} Players Available</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar p-0.5">
            {players.map((p) => {
              const isSelectedScorer = scorer?.number === p.number;
              const isSelectedA1 = assist1?.number === p.number;
              const isSelectedA2 = assist2?.number === p.number;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePlayerTap(p)}
                  className={`p-1.5 rounded-lg border text-left transition-all active:scale-95 flex flex-col justify-between ${
                    isSelectedScorer
                      ? 'bg-amber-500/25 border-amber-400 ring-2 ring-amber-400 text-white'
                      : isSelectedA1
                      ? 'bg-sky-500/25 border-sky-400 ring-2 ring-sky-400 text-white'
                      : isSelectedA2
                      ? 'bg-indigo-500/25 border-indigo-400 ring-2 ring-indigo-400 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-0.5">
                    <span
                      className={`font-athletic font-black text-sm px-1 rounded tabular-nums ${
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
                    <span className="text-[9px] font-mono font-bold text-slate-400">
                      {isSelectedScorer && '⚽ SCORER'}
                      {isSelectedA1 && '👟 1ST'}
                      {isSelectedA2 && '👟 2ND'}
                      {!isSelectedScorer && !isSelectedA1 && !isSelectedA2 && `${p.goals}G`}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium truncate block w-full text-slate-200">
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Jersey # Input if not in grid */}
          <form onSubmit={handleCustomNumberAdd} className="flex items-center gap-1.5 pt-2 mt-1.5 border-t border-slate-850">
            <span className="text-[10px] font-bold text-slate-400 font-athletic uppercase">
              Or Type Jersey #:
            </span>
            <input
              type="number"
              min="0"
              max="99"
              value={customNumberInput}
              onChange={(e) => setCustomNumberInput(e.target.value)}
              placeholder="#"
              className="w-12 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-white font-mono font-bold text-center text-xs focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!customNumberInput.trim()}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-athletic font-bold uppercase border border-amber-500/30 disabled:opacity-30"
            >
              Assign #{customNumberInput.trim() || '?'}
            </button>
          </form>
        </div>
      </div>

      {/* --- STEP 3: PLAY VOICE-OVER ANNOUNCEMENT BUTTON --- */}
      <div className="space-y-2 pt-1 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-mono">
            3
          </span>
          <span className="text-xs font-bold text-white uppercase font-athletic tracking-wide">
            Step 3: Press Button to Play Voice-Over
          </span>
        </div>

        {/* Live Audio Preview Bubble */}
        {previewPrompt ? (
          <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Announcer Script Preview:
              </span>
              <p className="font-medium italic leading-relaxed">
                &ldquo;{previewPrompt}&rdquo;
              </p>
              {isMp3Playing && (
                <span className="text-[10px] text-emerald-300 mt-1 flex items-center gap-1 font-semibold">
                  <Music className="w-3 h-3 animate-bounce" />
                  Voice-over will play smoothly OVER the active goal horn MP3 track!
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-500 italic">
            Please tap a player above in Step 2 to select the goal scorer.
          </div>
        )}

        {/* Action Button: Play Voice-Over */}
        <button
          type="button"
          id="btn-play-voice-over"
          disabled={!scorer || isAnnouncing}
          onClick={handlePlayVoiceOver}
          className={`w-full py-2.5 px-4 rounded-xl font-athletic font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] ${
            !scorer
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              : isAnnouncing
              ? 'bg-amber-600 text-white animate-pulse'
              : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/30 ring-2 ring-amber-300/80 cursor-pointer'
          }`}
        >
          <Volume2 className={`w-4 h-4 ${isAnnouncing ? 'animate-bounce' : ''}`} />
          <span>
            {isAnnouncing
              ? '📢 Playing Voice-Over Announcement...'
              : scorer
              ? `📢 Play Voice-Over for #${scorer.number} ${scorer.name}`
              : 'Select Scorer in Step 2 to Play Voice-Over'}
          </span>
        </button>

        {/* Success Confirmation Toast */}
        {recentAnnouncementFeedback && (
          <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-500/60 text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{recentAnnouncementFeedback}</span>
          </div>
        )}
      </div>
    </div>
  );
};
