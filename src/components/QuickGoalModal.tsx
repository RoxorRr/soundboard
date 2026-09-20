import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Flame, Award, Volume2, Delete, ArrowRight, Check, Hash, Users, AlertCircle, Sparkles } from 'lucide-react';
import { Player } from '../types';
import { generateGoalWithAssistPrompt } from '../utils/audio';

interface QuickGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  homePlayers: Player[];
  visitorPlayers: Player[];
  activeTeamTab?: 'home' | 'visitor';
  onSwitchTeamTab?: (tab: 'home' | 'visitor') => void;
  visitorTeamName?: string;
  onScoreGoalWithAssist: (
    team: 'home' | 'visitor',
    scorer: Player,
    primaryAssist?: Player | null,
    secondaryAssist?: Player | null
  ) => Promise<void> | void;
}

type ActiveFieldType = 'scorer' | 'assist1' | 'assist2';

export const QuickGoalModal: React.FC<QuickGoalModalProps> = ({
  isOpen,
  onClose,
  homePlayers,
  visitorPlayers,
  onSwitchTeamTab,
  visitorTeamName = 'Visitor Team',
  onScoreGoalWithAssist,
}) => {
  // CRITICAL: Do NOT pre-select team. User must choose manually to prevent scoring mistakes during the game.
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'visitor' | null>(null);
  const [activeField, setActiveField] = useState<ActiveFieldType>('scorer');
  const [scorerInput, setScorerInput] = useState<string>('');
  const [assist1Input, setAssist1Input] = useState<string>('');
  const [assist2Input, setAssist2Input] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [keepOpenAfterScore, setKeepOpenAfterScore] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [shakeField, setShakeField] = useState<ActiveFieldType | null>(null);

  const scorerInputRef = useRef<HTMLInputElement>(null);
  const assist1InputRef = useRef<HTMLInputElement>(null);
  const assist2InputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset/sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTeam(null); // Explicit manual selection required
      setActiveField('scorer');
      setScorerInput('');
      setAssist1Input('');
      setAssist2Input('');
      setValidationError(null);
      setShakeField(null);
    }
  }, [isOpen]);

  const teamPlayers = useMemo(() => {
    if (selectedTeam === 'visitor') return visitorPlayers;
    if (selectedTeam === 'home') return homePlayers;
    return [];
  }, [selectedTeam, visitorPlayers, homePlayers]);

  const teamName =
    selectedTeam === 'visitor'
      ? visitorTeamName.trim() || 'Visitor Team'
      : selectedTeam === 'home'
      ? 'Pelham Pelicans'
      : 'Unselected Team';

  const triggerValidationError = useCallback((message: string, field: ActiveFieldType) => {
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

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  // Matched players
  const matchedScorer = useMemo(() => {
    if (!selectedTeam) return null;
    const num = parseInt(scorerInput, 10);
    if (isNaN(num)) return null;
    return teamPlayers.find((p) => p.number === num) || null;
  }, [selectedTeam, scorerInput, teamPlayers]);

  const matchedAssist1 = useMemo(() => {
    if (!selectedTeam) return null;
    const num = parseInt(assist1Input, 10);
    if (isNaN(num)) return null;
    return teamPlayers.find((p) => p.number === num) || null;
  }, [selectedTeam, assist1Input, teamPlayers]);

  const matchedAssist2 = useMemo(() => {
    if (!selectedTeam) return null;
    const num = parseInt(assist2Input, 10);
    if (isNaN(num)) return null;
    return teamPlayers.find((p) => p.number === num) || null;
  }, [selectedTeam, assist2Input, teamPlayers]);

  // Validation function: Check if candidate number is valid on the roster for the target field
  const isNumberValidForField = useCallback(
    (candidate: string, field: ActiveFieldType): { valid: boolean; reason?: string } => {
      if (!selectedTeam) {
        return { valid: false, reason: `Please choose a scoring team (Pelham Pelicans or ${visitorTeamName}) first` };
      }
      if (!candidate) return { valid: true };

      const num = parseInt(candidate, 10);
      if (isNaN(num)) {
        return { valid: false, reason: 'Only numbers are allowed' };
      }

      // Conflict checks
      if (field === 'assist1') {
        if (matchedScorer && candidate === String(matchedScorer.number)) {
          return { valid: false, reason: `Player #${candidate} scored the goal and cannot assist their own goal` };
        }
        if (matchedAssist2 && candidate === String(matchedAssist2.number)) {
          return { valid: false, reason: `Player #${candidate} is already selected as secondary assist` };
        }
      }

      if (field === 'assist2') {
        if (matchedScorer && candidate === String(matchedScorer.number)) {
          return { valid: false, reason: `Player #${candidate} scored the goal and cannot assist their own goal` };
        }
        if (matchedAssist1 && candidate === String(matchedAssist1.number)) {
          return { valid: false, reason: `Player #${candidate} is already selected as primary assist` };
        }
      }

      // Check against roster prefix
      const eligiblePlayers = teamPlayers.filter((p) => {
        if (field === 'assist1') {
          if (matchedScorer && p.number === matchedScorer.number) return false;
          if (matchedAssist2 && p.number === matchedAssist2.number) return false;
        }
        if (field === 'assist2') {
          if (matchedScorer && p.number === matchedScorer.number) return false;
          if (matchedAssist1 && p.number === matchedAssist1.number) return false;
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
    [selectedTeam, teamPlayers, matchedScorer, matchedAssist1, matchedAssist2, teamName, visitorTeamName]
  );

  // Live Announcement Preview Text
  const previewAnnouncementText = useMemo(() => {
    if (!selectedTeam) {
      return `Please choose Pelham Pelicans or ${visitorTeamName} above to begin...`;
    }
    if (!scorerInput) {
      return `Waiting for ${teamName} goal scorer jersey number...`;
    }
    if (!matchedScorer) {
      return `Scorer jersey #${scorerInput} not matched to a player on ${teamName}.`;
    }

    return generateGoalWithAssistPrompt(
      matchedScorer.number,
      matchedScorer.name,
      matchedAssist1?.number,
      matchedAssist1?.name,
      matchedAssist2?.number,
      matchedAssist2?.name,
      teamName
    );
  }, [selectedTeam, scorerInput, matchedScorer, matchedAssist1, matchedAssist2, teamName, visitorTeamName]);

  // Handle direct text input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: ActiveFieldType) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, '').slice(0, 2);

    if (digits === '') {
      if (field === 'scorer') setScorerInput('');
      else if (field === 'assist1') setAssist1Input('');
      else setAssist2Input('');
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
      const hasFurtherPrefix = teamPlayers.some(
        (p) => String(p.number).length > digits.length && String(p.number).startsWith(digits)
      );
      if (!hasFurtherPrefix && teamPlayers.some((p) => String(p.number) === digits)) {
        setTimeout(() => {
          setActiveField('assist1');
          assist1InputRef.current?.focus();
        }, 250);
      }
    } else if (field === 'assist1') {
      setAssist1Input(digits);
      const hasFurtherPrefix = teamPlayers.some(
        (p) => String(p.number).length > digits.length && String(p.number).startsWith(digits)
      );
      if (!hasFurtherPrefix && teamPlayers.some((p) => String(p.number) === digits)) {
        setTimeout(() => {
          setActiveField('assist2');
          assist2InputRef.current?.focus();
        }, 250);
      }
    } else {
      setAssist2Input(digits);
    }
  };

  // Keypad button click handler
  const handleKeypadPress = useCallback(
    (digit: string) => {
      let current = '';
      if (activeField === 'scorer') current = scorerInput;
      else if (activeField === 'assist1') current = assist1Input;
      else current = assist2Input;

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
        const hasFurtherPrefix = teamPlayers.some(
          (p) => String(p.number).length > candidate.length && String(p.number).startsWith(candidate)
        );
        if (!hasFurtherPrefix && teamPlayers.some((p) => String(p.number) === candidate)) {
          setTimeout(() => {
            setActiveField('assist1');
            assist1InputRef.current?.focus();
          }, 250);
        }
      } else if (activeField === 'assist1') {
        setAssist1Input(candidate);
        const hasFurtherPrefix = teamPlayers.some(
          (p) => String(p.number).length > candidate.length && String(p.number).startsWith(candidate)
        );
        if (!hasFurtherPrefix && teamPlayers.some((p) => String(p.number) === candidate)) {
          setTimeout(() => {
            setActiveField('assist2');
            assist2InputRef.current?.focus();
          }, 250);
        }
      } else {
        setAssist2Input(candidate);
      }
    },
    [activeField, scorerInput, assist1Input, assist2Input, isNumberValidForField, triggerValidationError, teamPlayers]
  );

  const handleBackspace = useCallback(() => {
    setValidationError(null);
    if (activeField === 'scorer') {
      setScorerInput((prev) => prev.slice(0, -1));
    } else if (activeField === 'assist1') {
      setAssist1Input((prev) => prev.slice(0, -1));
    } else {
      setAssist2Input((prev) => prev.slice(0, -1));
    }
  }, [activeField]);

  const handleClearCurrent = useCallback(() => {
    setValidationError(null);
    if (activeField === 'scorer') {
      setScorerInput('');
      scorerInputRef.current?.focus();
    } else if (activeField === 'assist1') {
      setAssist1Input('');
      assist1InputRef.current?.focus();
    } else {
      setAssist2Input('');
      assist2InputRef.current?.focus();
    }
  }, [activeField]);

  const handleClearAll = useCallback(() => {
    setValidationError(null);
    setScorerInput('');
    setAssist1Input('');
    setAssist2Input('');
    setActiveField('scorer');
    scorerInputRef.current?.focus();
  }, []);

  const isKeypadDigitAllowed = useCallback(
    (digit: string) => {
      let current = '';
      if (activeField === 'scorer') current = scorerInput;
      else if (activeField === 'assist1') current = assist1Input;
      else current = assist2Input;

      if (current.length >= 2) return false;
      const candidate = current + digit;
      return isNumberValidForField(candidate, activeField).valid;
    },
    [activeField, scorerInput, assist1Input, assist2Input, isNumberValidForField]
  );

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement === scorerInputRef.current ||
        document.activeElement === assist1InputRef.current ||
        document.activeElement === assist2InputRef.current
      ) {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeField === 'scorer' && matchedScorer && !assist1Input) {
            setActiveField('assist1');
            assist1InputRef.current?.focus();
          } else if (activeField === 'assist1' && matchedAssist1 && !assist2Input) {
            setActiveField('assist2');
            assist2InputRef.current?.focus();
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
        const cycle: ActiveFieldType[] = ['scorer', 'assist1', 'assist2'];
        const nextIdx = (cycle.indexOf(activeField) + 1) % cycle.length;
        const next = cycle[nextIdx];
        setActiveField(next);
        if (next === 'scorer') scorerInputRef.current?.focus();
        else if (next === 'assist1') assist1InputRef.current?.focus();
        else assist2InputRef.current?.focus();
      } else if (e.key === 'Enter') {
        if (activeField === 'scorer' && matchedScorer && !assist1Input) {
          setActiveField('assist1');
          assist1InputRef.current?.focus();
        } else if (activeField === 'assist1' && matchedAssist1 && !assist2Input) {
          setActiveField('assist2');
          assist2InputRef.current?.focus();
        } else if (matchedScorer) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeypadPress, handleBackspace, activeField, matchedScorer, matchedAssist1, assist1Input, assist2Input, onClose]);

  // Submit Goal with Primary and/or Secondary Assist
  const handleSubmit = async () => {
    if (!selectedTeam) {
      triggerValidationError(`Please choose a scoring team (Pelham Pelicans or ${visitorTeamName}) first`, 'scorer');
      return;
    }

    if (!matchedScorer || isSubmitting) return;

    if (assist1Input && !matchedAssist1) {
      triggerValidationError(`Primary assist player #${assist1Input} does not exist on roster`, 'assist1');
      return;
    }

    if (assist2Input && !matchedAssist2) {
      triggerValidationError(`Secondary assist player #${assist2Input} does not exist on roster`, 'assist2');
      return;
    }

    if (matchedAssist1 && matchedAssist1.number === matchedScorer.number) {
      triggerValidationError('Goal scorer cannot assist their own goal', 'assist1');
      return;
    }

    if (matchedAssist2 && matchedAssist2.number === matchedScorer.number) {
      triggerValidationError('Goal scorer cannot assist their own goal', 'assist2');
      return;
    }

    if (matchedAssist1 && matchedAssist2 && matchedAssist1.number === matchedAssist2.number) {
      triggerValidationError('Primary and secondary assist cannot be the same player', 'assist2');
      return;
    }

    setIsSubmitting(true);
    try {
      await onScoreGoalWithAssist(selectedTeam, matchedScorer, matchedAssist1, matchedAssist2);
      if (keepOpenAfterScore) {
        setScorerInput('');
        setAssist1Input('');
        setAssist2Input('');
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

  const canSubmit = Boolean(
    matchedScorer &&
    (!assist1Input || (matchedAssist1 && matchedAssist1.number !== matchedScorer.number)) &&
    (!assist2Input || (matchedAssist2 && matchedAssist2.number !== matchedScorer.number)) &&
    (!matchedAssist1 || !matchedAssist2 || matchedAssist1.number !== matchedAssist2.number) &&
    !isSubmitting
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[94dvh]">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${selectedTeam === 'visitor' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'} border border-current/20`}>
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-athletic uppercase tracking-wider flex items-center gap-2">
                <span>Goal & Assists Entry</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-sans normal-case font-medium">
                  Primary + Secondary
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Only active roster numbers can be entered for both teams
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

        {/* Team Selector Tabs - Manual Selection Required */}
        <div className="bg-slate-900/95 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              1. Scoring Team:
            </span>
            {!selectedTeam && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                Choose Team First
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="quick-goal-select-home-btn"
              onClick={() => {
                setSelectedTeam('home');
                setScorerInput('');
                setAssist1Input('');
                setAssist2Input('');
                setValidationError(null);
                if (onSwitchTeamTab) onSwitchTeamTab('home');
                setTimeout(() => scorerInputRef.current?.focus(), 60);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-athletic font-bold uppercase transition-all flex items-center gap-1.5 ${
                selectedTeam === 'home'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 font-black ring-2 ring-amber-400 scale-[1.02]'
                  : !selectedTeam
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-2 border-amber-500/60 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              <span>Pelham Pelicans ({homePlayers.length})</span>
              {selectedTeam === 'home' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>
            <button
              type="button"
              id="quick-goal-select-visitor-btn"
              onClick={() => {
                setSelectedTeam('visitor');
                setScorerInput('');
                setAssist1Input('');
                setAssist2Input('');
                setValidationError(null);
                if (onSwitchTeamTab) onSwitchTeamTab('visitor');
                setTimeout(() => scorerInputRef.current?.focus(), 60);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-athletic font-bold uppercase transition-all flex items-center gap-1.5 ${
                selectedTeam === 'visitor'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 font-black ring-2 ring-rose-400 scale-[1.02]'
                  : !selectedTeam
                  ? 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-2 border-rose-500/60 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              <span>{visitorTeamName} ({visitorPlayers.length})</span>
              {selectedTeam === 'visitor' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-3.5">
          {/* Unselected Team Prompt */}
          {!selectedTeam && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
              <span>
                Please tap <strong>Pelham Pelicans</strong> or <strong>{visitorTeamName}</strong> above to choose the scoring team before entering jersey numbers.
              </span>
            </div>
          )}

          {/* Validation Alert Banner */}
          {validationError && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-bounce">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="flex-1">{validationError}</span>
            </div>
          )}

          {/* 3-Field Grid: Goal Scorer, Primary Assist, Secondary Assist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Field 1: Goal Scorer */}
            <div
              onClick={() => {
                if (selectedTeam) {
                  setActiveField('scorer');
                  scorerInputRef.current?.focus();
                }
              }}
              className={`p-2.5 rounded-xl border transition-all relative ${
                !selectedTeam
                  ? 'bg-slate-950/40 border-slate-800/60 opacity-80 cursor-not-allowed'
                  : 'cursor-pointer'
              } ${
                shakeField === 'scorer'
                  ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40'
                  : activeField === 'scorer' && selectedTeam
                  ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Goal Scorer</span>
                </span>
                {activeField === 'scorer' && selectedTeam ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                    Active
                  </span>
                ) : matchedScorer ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Ready
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-12 h-11 shrink-0">
                  <input
                    ref={scorerInputRef}
                    id="quick-goal-scorer-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    disabled={!selectedTeam}
                    value={scorerInput}
                    onChange={(e) => handleInputChange(e, 'scorer')}
                    onFocus={() => setActiveField('scorer')}
                    placeholder="--"
                    className="w-full h-full text-center rounded-lg bg-slate-900 border border-slate-700 text-xl font-athletic font-black text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  {scorerInput && (
                    <span className="absolute left-1 top-1 text-[8px] font-mono text-amber-500/70">#</span>
                  )}
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
                    <p className="text-xs font-medium text-amber-400 truncate">#{scorerInput}...</p>
                  ) : (
                    <p className="text-[11px] text-slate-400">Jersey #</p>
                  )}
                </div>
              </div>
            </div>

            {/* Field 2: Primary Assist */}
            <div
              onClick={() => {
                if (selectedTeam) {
                  setActiveField('assist1');
                  assist1InputRef.current?.focus();
                }
              }}
              className={`p-2.5 rounded-xl border transition-all relative ${
                !selectedTeam
                  ? 'bg-slate-950/40 border-slate-800/60 opacity-80 cursor-not-allowed'
                  : 'cursor-pointer'
              } ${
                shakeField === 'assist1'
                  ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40'
                  : activeField === 'assist1' && selectedTeam
                  ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>Primary Assist</span>
                </span>
                {activeField === 'assist1' && selectedTeam ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-400 text-slate-950">
                    Active
                  </span>
                ) : matchedAssist1 ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Ready
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-500">Optional</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-12 h-11 shrink-0">
                  <input
                    ref={assist1InputRef}
                    id="quick-goal-assist1-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    disabled={!selectedTeam}
                    value={assist1Input}
                    onChange={(e) => handleInputChange(e, 'assist1')}
                    onFocus={() => setActiveField('assist1')}
                    placeholder="--"
                    className="w-full h-full text-center rounded-lg bg-slate-900 border border-slate-700 text-xl font-athletic font-black text-sky-300 placeholder:text-slate-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  {assist1Input && (
                    <span className="absolute left-1 top-1 text-[8px] font-mono text-sky-500/70">#</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {matchedAssist1 ? (
                    <div>
                      <p className="text-xs font-bold text-white truncate">{matchedAssist1.name}</p>
                      <p className="text-[10px] text-sky-400/90 font-mono">
                        {matchedAssist1.assists} A • {matchedAssist1.goals} G
                      </p>
                    </div>
                  ) : assist1Input ? (
                    <p className="text-xs font-medium text-sky-400 truncate">#{assist1Input}...</p>
                  ) : (
                    <p className="text-[11px] text-slate-400">1st Assist #</p>
                  )}
                </div>
              </div>
            </div>

            {/* Field 3: Secondary Assist */}
            <div
              onClick={() => {
                if (selectedTeam) {
                  setActiveField('assist2');
                  assist2InputRef.current?.focus();
                }
              }}
              className={`p-2.5 rounded-xl border transition-all relative ${
                !selectedTeam
                  ? 'bg-slate-950/40 border-slate-800/60 opacity-80 cursor-not-allowed'
                  : 'cursor-pointer'
              } ${
                shakeField === 'assist2'
                  ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40'
                  : activeField === 'assist2' && selectedTeam
                  ? 'bg-indigo-500/10 border-indigo-400 ring-2 ring-indigo-400/40 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>2nd Assist</span>
                </span>
                {activeField === 'assist2' && selectedTeam ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-400 text-slate-950">
                    Active
                  </span>
                ) : matchedAssist2 ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Ready
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-500">Optional</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-12 h-11 shrink-0">
                  <input
                    ref={assist2InputRef}
                    id="quick-goal-assist2-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    disabled={!selectedTeam}
                    value={assist2Input}
                    onChange={(e) => handleInputChange(e, 'assist2')}
                    onFocus={() => setActiveField('assist2')}
                    placeholder="--"
                    className="w-full h-full text-center rounded-lg bg-slate-900 border border-slate-700 text-xl font-athletic font-black text-indigo-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  {assist2Input && (
                    <span className="absolute left-1 top-1 text-[8px] font-mono text-indigo-500/70">#</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {matchedAssist2 ? (
                    <div>
                      <p className="text-xs font-bold text-white truncate">{matchedAssist2.name}</p>
                      <p className="text-[10px] text-indigo-400/90 font-mono">
                        {matchedAssist2.assists} A • {matchedAssist2.goals} G
                      </p>
                    </div>
                  ) : assist2Input ? (
                    <p className="text-xs font-medium text-indigo-400 truncate">#{assist2Input}...</p>
                  ) : (
                    <p className="text-[11px] text-slate-400">2nd Assist #</p>
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
                <span>
                  Select for{' '}
                  <span className="text-amber-400 font-bold">
                    {activeField === 'scorer'
                      ? 'Goal Scorer'
                      : activeField === 'assist1'
                      ? 'Primary Assist'
                      : 'Secondary Assist'}
                  </span>
                  :
                </span>
              </span>

              {activeField === 'assist1' && assist1Input && (
                <button
                  type="button"
                  onClick={() => {
                    setAssist1Input('');
                    setValidationError(null);
                  }}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-bold underline"
                >
                  Clear Primary Assist
                </button>
              )}
              {activeField === 'assist2' && assist2Input && (
                <button
                  type="button"
                  onClick={() => {
                    setAssist2Input('');
                    setValidationError(null);
                  }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline"
                >
                  Clear Secondary Assist
                </button>
              )}
            </div>

            {selectedTeam ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                {teamPlayers.map((player) => {
                  const isScorer = Boolean(matchedScorer && player.number === matchedScorer.number);
                  const isAssist1 = Boolean(matchedAssist1 && player.number === matchedAssist1.number);
                  const isAssist2 = Boolean(matchedAssist2 && player.number === matchedAssist2.number);

                  const isCurrentFieldSelected =
                    (activeField === 'scorer' && scorerInput === String(player.number)) ||
                    (activeField === 'assist1' && assist1Input === String(player.number)) ||
                    (activeField === 'assist2' && assist2Input === String(player.number));

                  // Disable if already used in another field
                  const isConflictDisabled =
                    (activeField === 'assist1' && (isScorer || isAssist2)) ||
                    (activeField === 'assist2' && (isScorer || isAssist1));

                  return (
                    <button
                      key={player.id}
                      type="button"
                      disabled={isConflictDisabled}
                      onClick={() => {
                        if (activeField === 'scorer') {
                          setScorerInput(String(player.number));
                          setValidationError(null);
                          setActiveField('assist1');
                          assist1InputRef.current?.focus();
                        } else if (activeField === 'assist1') {
                          setAssist1Input(String(player.number));
                          setValidationError(null);
                          setActiveField('assist2');
                          assist2InputRef.current?.focus();
                        } else {
                          setAssist2Input(String(player.number));
                          setValidationError(null);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all active:scale-95 border ${
                        isConflictDisabled
                          ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                          : isCurrentFieldSelected
                          ? activeField === 'scorer'
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                            : activeField === 'assist1'
                            ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-sm'
                            : 'bg-indigo-400 text-slate-950 border-indigo-300 shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      <span className="font-athletic font-black">#{player.number}</span>
                      <span className="truncate max-w-[85px] text-[11px] font-normal">{player.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                👈 Select a team above to display players and enter goals
              </div>
            )}
          </div>

          {/* Keypad */}
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => {
                const isAllowed = isKeypadDigitAllowed(digit);
                return (
                  <button
                    key={digit}
                    type="button"
                    disabled={!isAllowed}
                    onClick={() => handleKeypadPress(digit)}
                    className={`h-11 sm:h-12 rounded-lg text-lg font-athletic font-black border flex items-center justify-center transition-all ${
                      isAllowed
                        ? 'bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 border-slate-700/80'
                        : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-30'
                    }`}
                    title={isAllowed ? `Enter ${digit}` : `No player starts with this`}
                  >
                    {digit}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleClearCurrent}
                className="h-11 sm:h-12 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500 active:text-white text-rose-400 font-bold text-xs uppercase tracking-wider border border-rose-500/30 flex items-center justify-center transition-all"
              >
                Clear
              </button>

              {(() => {
                const isAllowed = isKeypadDigitAllowed('0');
                return (
                  <button
                    type="button"
                    disabled={!isAllowed}
                    onClick={() => handleKeypadPress('0')}
                    className={`h-11 sm:h-12 rounded-lg text-lg font-athletic font-black border flex items-center justify-center transition-all ${
                      isAllowed
                        ? 'bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 border-slate-700/80'
                        : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-30'
                    }`}
                  >
                    0
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={handleBackspace}
                className="h-11 sm:h-12 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 text-sm font-bold border border-slate-700/80 flex items-center justify-center transition-all shadow-sm active:scale-95"
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Field Selector Bar */}
            <div className="flex items-center justify-between gap-1 pt-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveField('scorer');
                    scorerInputRef.current?.focus();
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                    activeField === 'scorer' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. Scorer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveField('assist1');
                    assist1InputRef.current?.focus();
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                    activeField === 'assist1' ? 'bg-sky-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2. 1st Assist
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveField('assist2');
                    assist2InputRef.current?.focus();
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                    activeField === 'assist2' ? 'bg-indigo-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3. 2nd Assist
                </button>
              </div>

              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1 rounded text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Reset All
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
              <span className="text-[10px] text-slate-500">Play-by-play Arena Voice</span>
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
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-500/25 active:scale-95 font-black uppercase tracking-wider'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/25 active:scale-95 font-black uppercase tracking-wider'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Announcing...'
                  : !selectedTeam
                  ? '1. Select Team First'
                  : !matchedScorer
                  ? '2. Enter Scorer #'
                  : 'Announce Goal & Assists!'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
