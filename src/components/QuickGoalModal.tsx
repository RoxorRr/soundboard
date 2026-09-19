import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Flame, Award, Volume2, Delete, ArrowRight, Check, Hash, Users, AlertCircle, AlertTriangle } from 'lucide-react';
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [shakeField, setShakeField] = useState<'scorer' | 'assist' | null>(null);

  const scorerInputRef = useRef<HTMLInputElement>(null);
  const assistInputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync selected team when activeTeamTab changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTeam(activeTeamTab);
      setActiveField('scorer');
      setScorerInput('');
      setAssistInput('');
      setValidationError(null);
      setShakeField(null);
      // Auto focus scorer input after open
      setTimeout(() => {
        scorerInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, activeTeamTab]);

  const teamPlayers = useMemo(() => {
    return selectedTeam === 'visitor' ? visitorPlayers : homePlayers;
  }, [selectedTeam, visitorPlayers, homePlayers]);

  const teamName = selectedTeam === 'visitor' ? (visitorTeamName.trim() || 'Visitor Team') : 'Pelham Pelicans';

  // Trigger error and shake animation when an invalid number is entered
  const triggerValidationError = useCallback((message: string, field: 'scorer' | 'assist') => {
    setValidationError(message);
    setShakeField(field);

    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = setTimeout(() => {
      setValidationError(null);
      setShakeField(null);
    }, 2800);
  }, []);

  // Cleanup error timer
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

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

  // Validation function: Check if a candidate string can be a valid prefix or exact number on the team
  const isNumberValidForField = useCallback(
    (candidate: string, field: 'scorer' | 'assist'): { valid: boolean; reason?: string } => {
      if (!candidate) return { valid: true };

      const num = parseInt(candidate, 10);
      if (isNaN(num)) {
        return { valid: false, reason: 'Only numbers are allowed' };
      }

      // If checking assist field, verify it's not the goal scorer
      if (field === 'assist' && matchedScorer && candidate === String(matchedScorer.number)) {
        return {
          valid: false,
          reason: `Player #${candidate} is the goal scorer and cannot assist their own goal`,
        };
      }

      // Check if there is ANY player on the team whose jersey number starts with this candidate string
      const eligiblePlayers = teamPlayers.filter((p) => {
        if (field === 'assist' && matchedScorer && p.number === matchedScorer.number) {
          return false;
        }
        return String(p.number).startsWith(candidate);
      });

      if (eligiblePlayers.length === 0) {
        return {
          valid: false,
          reason: `No player on ${teamName} has jersey #${candidate}`,
        };
      }

      return { valid: true };
    },
    [teamPlayers, matchedScorer, teamName]
  );

  // Live Announcement Preview Text
  const previewAnnouncementText = useMemo(() => {
    if (!scorerInput) {
      return `Waiting for goal scorer jersey number...`;
    }
    if (!matchedScorer) {
      return `Scorer jersey #${scorerInput} not matched to a player on the roster.`;
    }

    const scorerPart = `${teamName} goal! Scored by number ${matchedScorer.number}, ${matchedScorer.name}!`;

    if (assistInput) {
      if (!matchedAssist) {
        return `${scorerPart} (Assist jersey #${assistInput} not matched...)`;
      }
      return `${scorerPart} Assisted by number ${matchedAssist.number}, ${matchedAssist.name}!`;
    }

    return `${scorerPart} Unassisted!`;
  }, [scorerInput, assistInput, matchedScorer, matchedAssist, teamName]);

  // Handle direct text field input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'scorer' | 'assist'
  ) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, '').slice(0, 2);

    if (digits === '') {
      if (field === 'scorer') {
        setScorerInput('');
      } else {
        setAssistInput('');
      }
      setValidationError(null);
      return;
    }

    const validation = isNumberValidForField(digits, field);
    if (!validation.valid) {
      triggerValidationError(validation.reason || `Player #${digits} does not exist`, field);
      return;
    }

    setValidationError(null);
    if (field === 'scorer') {
      setScorerInput(digits);
      // Auto-advance to assist if exact match found and no two-digit prefix possible
      const hasFurtherPrefix = teamPlayers.some(
        (p) => String(p.number).length > digits.length && String(p.number).startsWith(digits)
      );
      if (!hasFurtherPrefix && teamPlayers.some((p) => String(p.number) === digits)) {
        setTimeout(() => {
          setActiveField('assist');
          assistInputRef.current?.focus();
        }, 300);
      }
    } else {
      setAssistInput(digits);
    }
  };

  // Keypad button click handler
  const handleKeypadPress = useCallback(
    (digit: string) => {
      const current = activeField === 'scorer' ? scorerInput : assistInput;
      if (current.length >= 2) return;

      const candidate = current + digit;
      const validation = isNumberValidForField(candidate, activeField);

      if (!validation.valid) {
        triggerValidationError(validation.reason || `Player #${candidate} does not exist`, activeField);
        return;
      }

      setValidationError(null);
      if (activeField === 'scorer') {
        setScorerInput(candidate);
        // Auto-advance to assist if exact match found and no multi-digit numbers start with this
        const hasFurtherPrefix = teamPlayers.some(
          (p) => String(p.number).length > candidate.length && String(p.number).startsWith(candidate)
        );
        if (!hasFurtherPrefix && teamPlayers.some((p) => String(p.number) === candidate)) {
          setTimeout(() => {
            setActiveField('assist');
            assistInputRef.current?.focus();
          }, 300);
        }
      } else {
        setAssistInput(candidate);
      }
    },
    [activeField, scorerInput, assistInput, isNumberValidForField, triggerValidationError, teamPlayers]
  );

  const handleBackspace = useCallback(() => {
    setValidationError(null);
    if (activeField === 'scorer') {
      setScorerInput((prev) => prev.slice(0, -1));
    } else {
      setAssistInput((prev) => prev.slice(0, -1));
    }
  }, [activeField]);

  const handleClearCurrent = useCallback(() => {
    setValidationError(null);
    if (activeField === 'scorer') {
      setScorerInput('');
      scorerInputRef.current?.focus();
    } else {
      setAssistInput('');
      assistInputRef.current?.focus();
    }
  }, [activeField]);

  const handleClearAll = useCallback(() => {
    setValidationError(null);
    setScorerInput('');
    setAssistInput('');
    setActiveField('scorer');
    scorerInputRef.current?.focus();
  }, []);

  // Determine if a keypad digit can be pressed
  const isKeypadDigitAllowed = useCallback(
    (digit: string) => {
      const current = activeField === 'scorer' ? scorerInput : assistInput;
      if (current.length >= 2) return false;
      const candidate = current + digit;
      return isNumberValidForField(candidate, activeField).valid;
    },
    [activeField, scorerInput, assistInput, isNumberValidForField]
  );

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is actively in the input element (input's onChange handles it)
      if (document.activeElement === scorerInputRef.current || document.activeElement === assistInputRef.current) {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeField === 'scorer' && matchedScorer && !assistInput) {
            setActiveField('assist');
            assistInputRef.current?.focus();
          } else if (matchedScorer) {
            handleSubmit();
          }
        }
        return;
      }

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
        const next = activeField === 'scorer' ? 'assist' : 'scorer';
        setActiveField(next);
        if (next === 'scorer') scorerInputRef.current?.focus();
        else assistInputRef.current?.focus();
      } else if (e.key === 'Enter') {
        if (activeField === 'scorer' && matchedScorer && !assistInput) {
          setActiveField('assist');
          assistInputRef.current?.focus();
        } else if (matchedScorer) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeypadPress, handleBackspace, activeField, matchedScorer, assistInput, onClose]);

  // Handle Submission & Announcement (Only allowed if player exists)
  const handleSubmit = async () => {
    if (!matchedScorer || isSubmitting) return;

    if (assistInput && !matchedAssist) {
      triggerValidationError(`Assist player #${assistInput} does not exist on the roster`, 'assist');
      return;
    }

    if (matchedAssist && matchedAssist.number === matchedScorer.number) {
      triggerValidationError('Goal scorer cannot assist their own goal', 'assist');
      return;
    }

    setIsSubmitting(true);
    try {
      await onScoreGoalWithAssist(selectedTeam, matchedScorer, matchedAssist);
      if (keepOpenAfterScore) {
        setScorerInput('');
        setAssistInput('');
        setActiveField('scorer');
        setValidationError(null);
        scorerInputRef.current?.focus();
      } else {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if form is ready to submit
  const canSubmit = Boolean(
    matchedScorer &&
    (!assistInput || (matchedAssist && matchedAssist.number !== matchedScorer.number)) &&
    !isSubmitting
  );

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
                Only active roster jersey numbers can be entered
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
                setScorerInput('');
                setAssistInput('');
                setValidationError(null);
                if (onSwitchTeamTab) onSwitchTeamTab('home');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-athletic font-bold uppercase transition-all ${
                selectedTeam === 'home'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Pelham Pelicans ({homePlayers.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedTeam('visitor');
                setScorerInput('');
                setAssistInput('');
                setValidationError(null);
                if (onSwitchTeamTab) onSwitchTeamTab('visitor');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-athletic font-bold uppercase transition-all ${
                selectedTeam === 'visitor'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {visitorTeamName} ({visitorPlayers.length})
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Validation Alert Banner */}
          {validationError && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-bounce">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="flex-1">{validationError}</span>
            </div>
          )}

          {/* Dual Text Input Fields for Scorer and Assist */}
          <div className="grid grid-cols-2 gap-3">
            {/* Field 1: Goal Scorer */}
            <div
              onClick={() => {
                setActiveField('scorer');
                scorerInputRef.current?.focus();
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                shakeField === 'scorer'
                  ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40'
                  : activeField === 'scorer'
                  ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Goal Scorer</span>
                </span>
                {activeField === 'scorer' ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                    Active
                  </span>
                ) : matchedScorer ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Ready
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-14 h-12">
                  <input
                    ref={scorerInputRef}
                    id="quick-goal-scorer-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={scorerInput}
                    onChange={(e) => handleInputChange(e, 'scorer')}
                    onFocus={() => setActiveField('scorer')}
                    placeholder="--"
                    className="w-full h-full text-center rounded-lg bg-slate-900 border border-slate-700 text-2xl font-athletic font-black text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                  {scorerInput && (
                    <span className="absolute left-1.5 top-1.5 text-[9px] font-mono text-amber-500/70">#</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {matchedScorer ? (
                    <div>
                      <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                        <span>{matchedScorer.name}</span>
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      </p>
                      <p className="text-[10px] text-amber-400/90 font-mono">
                        {matchedScorer.goals} G • {matchedScorer.assists} A
                      </p>
                    </div>
                  ) : scorerInput ? (
                    <div>
                      <p className="text-xs font-medium text-amber-400 truncate">Typing #{scorerInput}...</p>
                      <p className="text-[10px] text-slate-400">Matches available roster</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Enter jersey #</p>
                      <p className="text-[10px] text-slate-500">Only roster players</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Field 2: Assist Maker */}
            <div
              onClick={() => {
                setActiveField('assist');
                assistInputRef.current?.focus();
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                shakeField === 'assist'
                  ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40'
                  : activeField === 'assist'
                  ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>Assist Maker</span>
                </span>
                {activeField === 'assist' ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-400 text-slate-950">
                    Active
                  </span>
                ) : matchedAssist ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Ready
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-14 h-12">
                  <input
                    ref={assistInputRef}
                    id="quick-goal-assist-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={assistInput}
                    onChange={(e) => handleInputChange(e, 'assist')}
                    onFocus={() => setActiveField('assist')}
                    placeholder="--"
                    className="w-full h-full text-center rounded-lg bg-slate-900 border border-slate-700 text-2xl font-athletic font-black text-sky-300 placeholder:text-slate-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  />
                  {assistInput && (
                    <span className="absolute left-1.5 top-1.5 text-[9px] font-mono text-sky-500/70">#</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {matchedAssist ? (
                    <div>
                      <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                        <span>{matchedAssist.name}</span>
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      </p>
                      <p className="text-[10px] text-sky-400/90 font-mono">
                        {matchedAssist.assists} A • {matchedAssist.goals} G
                      </p>
                    </div>
                  ) : assistInput ? (
                    <div>
                      <p className="text-xs font-medium text-sky-400 truncate">Typing #{assistInput}...</p>
                      <p className="text-[10px] text-slate-400">Matches available roster</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Optional</p>
                      <p className="text-[10px] text-slate-500">Unassisted if blank</p>
                    </div>
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
                <span>Roster Players for {activeField === 'scorer' ? 'Goal Scorer' : 'Assist'}:</span>
              </span>
              {assistInput && activeField === 'assist' && (
                <button
                  type="button"
                  onClick={() => {
                    setAssistInput('');
                    setValidationError(null);
                  }}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-bold underline"
                >
                  Clear (Unassisted)
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
              {teamPlayers.map((player) => {
                const isSelected =
                  (activeField === 'scorer' && scorerInput === String(player.number)) ||
                  (activeField === 'assist' && assistInput === String(player.number));
                const isScorer = Boolean(matchedScorer && player.number === matchedScorer.number);
                const isAssistDisabled = activeField === 'assist' && isScorer;

                return (
                  <button
                    key={player.id}
                    type="button"
                    disabled={isAssistDisabled}
                    onClick={() => {
                      if (activeField === 'scorer') {
                        setScorerInput(String(player.number));
                        setValidationError(null);
                        setActiveField('assist');
                        assistInputRef.current?.focus();
                      } else {
                        setAssistInput(String(player.number));
                        setValidationError(null);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all active:scale-95 border ${
                      isAssistDisabled
                        ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                        : isSelected
                        ? activeField === 'scorer'
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-sky-400 text-slate-950 border-sky-300 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span className="font-athletic font-black">#{player.number}</span>
                    <span className="truncate max-w-[85px] text-[11px] font-normal">{player.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Touch-Friendly Numeric Keypad with Guarded Keys */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => {
                const isAllowed = isKeypadDigitAllowed(digit);
                return (
                  <button
                    key={digit}
                    type="button"
                    disabled={!isAllowed}
                    onClick={() => handleKeypadPress(digit)}
                    className={`h-12 sm:h-14 rounded-xl text-xl font-athletic font-black border flex items-center justify-center transition-all shadow-sm ${
                      isAllowed
                        ? 'bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 border-slate-700/80 active:scale-95'
                        : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-30'
                    }`}
                    title={isAllowed ? `Enter ${digit}` : `No player number starts with this`}
                  >
                    {digit}
                  </button>
                );
              })}

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
              {(() => {
                const isAllowed = isKeypadDigitAllowed('0');
                return (
                  <button
                    type="button"
                    disabled={!isAllowed}
                    onClick={() => handleKeypadPress('0')}
                    className={`h-12 sm:h-14 rounded-xl text-xl font-athletic font-black border flex items-center justify-center transition-all shadow-sm ${
                      isAllowed
                        ? 'bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 border-slate-700/80 active:scale-95'
                        : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-30'
                    }`}
                    title={isAllowed ? 'Enter 0' : 'No player number starts with 0'}
                  >
                    0
                  </button>
                );
              })()}

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
                onClick={() => {
                  const next = activeField === 'scorer' ? 'assist' : 'scorer';
                  setActiveField(next);
                  setValidationError(null);
                  if (next === 'scorer') scorerInputRef.current?.focus();
                  else assistInputRef.current?.focus();
                }}
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
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
                !canSubmit
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
