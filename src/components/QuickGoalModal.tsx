import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Flame, Award, Volume2, Delete, ArrowRight, Check, Hash, Users, Sparkles } from 'lucide-react';
import { Player } from '../types';

interface QuickGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  homePlayers: Player[];
  visitorPlayers: Player[];
  activeTeamTab: 'home' | 'visitor';
  onSwitchTeamTab?: (tab: 'home' | 'visitor') => void;
  visitorTeamName?: string;
  onScoreGoalWithAssist: (
    team: 'home' | 'visitor',
    scorer: Player,
    assistPlayer?: Player | null
  ) => Promise<void> | void;
}

export const QuickGoalModal: React.FC<QuickGoalModalProps> = ({
  isOpen,
  onClose,
  homePlayers,
  visitorPlayers,
  activeTeamTab,
  onSwitchTeamTab,
  visitorTeamName = 'Visitor Team',
  onScoreGoalWithAssist,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'visitor'>(activeTeamTab);
  const [activeField, setActiveField] = useState<'scorer' | 'assist'>('scorer');
  const [scorerInput, setScorerInput] = useState<string>('');
  const [assistInput, setAssistInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [keepOpenAfterScore, setKeepOpenAfterScore] = useState<boolean>(false);

  // Sync selected team when activeTeamTab changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTeam(activeTeamTab);
      setActiveField('scorer');
      setScorerInput('');
      setAssistInput('');
    }
  }, [isOpen, activeTeamTab]);

  const teamPlayers = useMemo(() => {
    return selectedTeam === 'visitor' ? visitorPlayers : homePlayers;
  }, [selectedTeam, visitorPlayers, homePlayers]);

  const teamName = selectedTeam === 'visitor' ? (visitorTeamName.trim() || 'Visitor Team') : 'Pelham Pelicans';

  // Matched players based on input numbers
  const matchedScorer = useMemo(() => {
    const num = parseInt(scorerInput, 10);
    if (isNaN(num)) return null;
    return teamPlayers.find((p) => p.number === num) || null;
  }, [scorerInput, teamPlayers]);

  const matchedAssist = useMemo(() => {
    const num = parseInt(assistInput, 10);
    if (isNaN(num)) return null;
    return teamPlayers.find((p) => p.number === num) || null;
  }, [assistInput, teamPlayers]);

  // Live Announcement Preview Text
  const previewAnnouncementText = useMemo(() => {
    if (!scorerInput) {
      return `Waiting for goal scorer jersey number...`;
    }
    const scorerName = matchedScorer?.name || `Player #${scorerInput}`;
    const scorerPart = `${teamName} goal! Scored by number ${scorerInput}, ${scorerName}!`;

    if (assistInput) {
      const assistName = matchedAssist?.name || `Player #${assistInput}`;
      return `${scorerPart} Assisted by number ${assistInput}, ${assistName}!`;
    }

    return `${scorerPart} Unassisted!`;
  }, [scorerInput, assistInput, matchedScorer, matchedAssist, teamName]);

  // Keypad button click handler
  const handleKeypadPress = useCallback((digit: string) => {
    if (activeField === 'scorer') {
      if (scorerInput.length < 2) {
        setScorerInput((prev) => prev + digit);
      }
    } else {
      if (assistInput.length < 2) {
        setAssistInput((prev) => prev + digit);
      }
    }
  }, [activeField, scorerInput, assistInput]);

  const handleBackspace = useCallback(() => {
    if (activeField === 'scorer') {
      setScorerInput((prev) => prev.slice(0, -1));
    } else {
      setAssistInput((prev) => prev.slice(0, -1));
    }
  }, [activeField]);

  const handleClearCurrent = useCallback(() => {
    if (activeField === 'scorer') {
      setScorerInput('');
    } else {
      setAssistInput('');
    }
  }, [activeField]);

  const handleClearAll = useCallback(() => {
    setScorerInput('');
    setAssistInput('');
    setActiveField('scorer');
  }, []);

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setActiveField((prev) => (prev === 'scorer' ? 'assist' : 'scorer'));
      } else if (e.key === 'Enter') {
        if (activeField === 'scorer' && scorerInput && !assistInput) {
          setActiveField('assist');
        } else if (scorerInput) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeypadPress, handleBackspace, activeField, scorerInput, assistInput, onClose]);

  // Handle Submission & Announcement
  const handleSubmit = async () => {
    if (!scorerInput || isSubmitting) return;

    const scorerNum = parseInt(scorerInput, 10);
    if (isNaN(scorerNum)) return;

    // Use existing matched player or create placeholder representation
    const scorerPlayer: Player = matchedScorer || {
      id: `custom_scorer_${scorerNum}`,
      number: scorerNum,
      name: `Player #${scorerNum}`,
      goals: 0,
      assists: 0,
    };

    let assistPlayer: Player | null = null;
    if (assistInput) {
      const assistNum = parseInt(assistInput, 10);
      if (!isNaN(assistNum)) {
        assistPlayer = matchedAssist || {
          id: `custom_assist_${assistNum}`,
          number: assistNum,
          name: `Player #${assistNum}`,
          goals: 0,
          assists: 0,
        };
      }
    }

    setIsSubmitting(true);
    try {
      await onScoreGoalWithAssist(selectedTeam, scorerPlayer, assistPlayer);
      if (keepOpenAfterScore) {
        setScorerInput('');
        setAssistInput('');
        setActiveField('scorer');
      } else {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${selectedTeam === 'visitor' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'} border border-current/20`}>
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-athletic uppercase tracking-wider flex items-center gap-2">
                <span>Quick Goal & Assist Entry</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Input jersey numbers to score and announce via voice
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team Selector Tabs */}
        <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Team:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedTeam('home');
                if (onSwitchTeamTab) onSwitchTeamTab('home');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-athletic font-bold uppercase transition-all ${
                selectedTeam === 'home'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Pelham Pelicans
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTeam('visitor');
                if (onSwitchTeamTab) onSwitchTeamTab('visitor');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-athletic font-bold uppercase transition-all ${
                selectedTeam === 'visitor'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {visitorTeamName}
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Dual Input Fields for Scorer and Assist */}
          <div className="grid grid-cols-2 gap-3">
            {/* Field 1: Goal Scorer */}
            <div
              onClick={() => setActiveField('scorer')}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                activeField === 'scorer'
                  ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Goal Scorer</span>
                </span>
                {activeField === 'scorer' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 animate-pulse">
                    Typing #
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="w-12 h-11 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xl font-athletic font-black text-amber-300">
                  {scorerInput ? `#${scorerInput}` : <span className="text-slate-600 font-normal">--</span>}
                </div>
                <div className="min-w-0 flex-1">
                  {matchedScorer ? (
                    <div>
                      <p className="text-xs font-bold text-white truncate">{matchedScorer.name}</p>
                      <p className="text-[10px] text-amber-400/90 font-mono">
                        {matchedScorer.goals} G • {matchedScorer.assists} A
                      </p>
                    </div>
                  ) : scorerInput ? (
                    <div>
                      <p className="text-xs font-medium text-slate-400 truncate">#{scorerInput} (Unlisted)</p>
                      <p className="text-[10px] text-slate-500">Will announce #{scorerInput}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Tap to enter #</p>
                  )}
                </div>
              </div>
            </div>

            {/* Field 2: Assist Maker */}
            <div
              onClick={() => setActiveField('assist')}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                activeField === 'assist'
                  ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>Assist Maker</span>
                </span>
                {activeField === 'assist' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 animate-pulse">
                    Typing #
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="w-12 h-11 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xl font-athletic font-black text-sky-300">
                  {assistInput ? `#${assistInput}` : <span className="text-slate-600 font-normal">--</span>}
                </div>
                <div className="min-w-0 flex-1">
                  {matchedAssist ? (
                    <div>
                      <p className="text-xs font-bold text-white truncate">{matchedAssist.name}</p>
                      <p className="text-[10px] text-sky-400/90 font-mono">
                        {matchedAssist.assists} A • {matchedAssist.goals} G
                      </p>
                    </div>
                  ) : assistInput ? (
                    <div>
                      <p className="text-xs font-medium text-slate-400 truncate">#{assistInput} (Unlisted)</p>
                      <p className="text-[10px] text-slate-500">Will announce #{assistInput}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Optional (Unassisted)</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Roster Chips for Active Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Quick Player Select for {activeField === 'scorer' ? 'Goal Scorer' : 'Assist'}:</span>
              </span>
              {assistInput && activeField === 'assist' && (
                <button
                  type="button"
                  onClick={() => setAssistInput('')}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-bold"
                >
                  Set as Unassisted
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
              {teamPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    if (activeField === 'scorer') {
                      setScorerInput(String(player.number));
                      setActiveField('assist');
                    } else {
                      setAssistInput(String(player.number));
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all active:scale-95 border ${
                    (activeField === 'scorer' && scorerInput === String(player.number)) ||
                    (activeField === 'assist' && assistInput === String(player.number))
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <span className="font-athletic font-black">#{player.number}</span>
                  <span className="truncate max-w-[85px] text-[11px] font-normal">{player.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Touch-Friendly Numeric Keypad */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-12 sm:h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 text-xl font-athletic font-black border border-slate-700/80 flex items-center justify-center transition-all shadow-sm active:scale-95"
                >
                  {digit}
                </button>
              ))}

              {/* Clear Current Field */}
              <button
                type="button"
                onClick={handleClearCurrent}
                className="h-12 sm:h-14 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500 active:text-white text-rose-400 font-bold text-xs uppercase tracking-wider border border-rose-500/30 flex items-center justify-center transition-all"
                title="Clear current input"
              >
                Clear
              </button>

              {/* Zero */}
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-12 sm:h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 text-xl font-athletic font-black border border-slate-700/80 flex items-center justify-center transition-all shadow-sm active:scale-95"
              >
                0
              </button>

              {/* Backspace */}
              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 sm:h-14 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 text-sm font-bold border border-slate-700/80 flex items-center justify-center transition-all shadow-sm active:scale-95"
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Keypad Navigation Controls */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveField((prev) => (prev === 'scorer' ? 'assist' : 'scorer'))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                <span>Switch to {activeField === 'scorer' ? 'Assist' : 'Scorer'} Field</span>
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                Reset Fields
              </button>
            </div>
          </div>

          {/* Live Voice Speech Preview */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Voice Announcement Preview</span>
              </span>
              <span className="text-[10px] text-slate-500">Arena Horn + Announcer</span>
            </div>
            <p className="text-xs font-semibold text-slate-200 leading-relaxed italic">
              &ldquo;{previewAnnouncementText}&rdquo;
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={keepOpenAfterScore}
              onChange={(e) => setKeepOpenAfterScore(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-[11px]">Keep open after score</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!scorerInput || isSubmitting}
              onClick={handleSubmit}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
                !scorerInput || isSubmitting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : selectedTeam === 'visitor'
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-500/25 active:scale-95'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/25 active:scale-95'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Announcing...' : 'Announce Goal & Assist!'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
