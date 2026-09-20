import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X,
  ShieldAlert,
  Volume2,
  Delete,
  ArrowRight,
  Check,
  Hash,
  Users,
  AlertCircle,
  Sparkles,
  Clock,
  Plus,
  Bookmark,
  Trash2,
  Pin,
  SlidersHorizontal,
  Minus,
  Timer,
} from 'lucide-react';
import { Player } from '../types';
import { generatePenaltyPrompt } from '../utils/audio';
import {
  getAllPenaltyInfractions,
  saveCustomPenalty,
  removeCustomPenalty,
  isCustomSavedPenalty,
} from '../utils/penaltyInfractions';
import {
  STANDARD_PENALTY_DURATIONS,
  formatMinutesAndSecondsToSpoken,
  formatDurationDisplay,
  getSavedGamePenaltyDuration,
  saveGamePenaltyDuration,
  PenaltyDurationOption,
} from '../utils/penaltyTime';

interface PenaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  homePlayers: Player[];
  visitorPlayers: Player[];
  activeTeamTab?: 'home' | 'visitor';
  onSwitchTeamTab?: (tab: 'home' | 'visitor') => void;
  visitorTeamName?: string;
  onAnnouncePenalty: (
    team: 'home' | 'visitor',
    player: Player,
    durationText: string,
    infraction: string,
    promptText: string,
    clockTime?: string
  ) => Promise<void> | void;
}

export const PenaltyModal: React.FC<PenaltyModalProps> = ({
  isOpen,
  onClose,
  homePlayers,
  visitorPlayers,
  onSwitchTeamTab,
  visitorTeamName = 'Visitor Team',
  onAnnouncePenalty,
}) => {
  // CRITICAL: Do NOT pre-select team. User must choose explicitly to avoid game-time mistakes.
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'visitor' | null>(null);
  const [playerInput, setPlayerInput] = useState<string>('');

  // Duration state: initializes from saved game default (or 2:00 if none saved)
  const [durationText, setDurationText] = useState<string>(() => getSavedGamePenaltyDuration().value);
  const [durationLabel, setDurationLabel] = useState<string>(() => getSavedGamePenaltyDuration().label);
  const [savedGameDefaultLabel, setSavedGameDefaultLabel] = useState<string>(() => getSavedGamePenaltyDuration().label);
  const [isCustomDurationOpen, setIsCustomDurationOpen] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<number>(2);
  const [customSeconds, setCustomSeconds] = useState<number>(0);

  // Optional Game Clock time of penalty
  const [includeClockTime, setIncludeClockTime] = useState<boolean>(false);
  const [clockTimeInput, setClockTimeInput] = useState<string>('');
  const [clockPeriod, setClockPeriod] = useState<'1st' | '2nd' | '3rd' | 'OT' | ''>('');

  const [infractionsList, setInfractionsList] = useState<string[]>(() => getAllPenaltyInfractions());
  const [selectedInfraction, setSelectedInfraction] = useState<string>('body check');
  const [customInfractionInput, setCustomInfractionInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customSaveNotice, setCustomSaveNotice] = useState<string | null>(null);
  const [includePlayerName, setIncludePlayerName] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [shakeInput, setShakeInput] = useState<boolean>(false);

  const playerInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTeam(null); // Explicit manual selection required
      setPlayerInput('');
      const savedDur = getSavedGamePenaltyDuration();
      setDurationText(savedDur.value);
      setDurationLabel(savedDur.label);
      setSavedGameDefaultLabel(savedDur.label);
      setIsCustomDurationOpen(false);
      setCustomMinutes(2);
      setCustomSeconds(0);
      setIncludeClockTime(false);
      setClockTimeInput('');
      setClockPeriod('');
      const allInfractions = getAllPenaltyInfractions();
      setInfractionsList(allInfractions);
      setSelectedInfraction(allInfractions.includes('body check') ? 'body check' : allInfractions[0] || 'hooking');
      setCustomInfractionInput('');
      setIsCustomMode(false);
      setValidationError(null);
      setShakeInput(false);
      setCustomSaveNotice(null);
    }
  }, [isOpen]);

  // Clean timers
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Listen for penalty infractions updates across views
  useEffect(() => {
    const handleUpdate = () => {
      setInfractionsList(getAllPenaltyInfractions());
    };
    window.addEventListener('pelham-penalties-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('pelham-penalties-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

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

  const triggerValidationError = useCallback((msg: string) => {
    setValidationError(msg);
    setShakeInput(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setValidationError(null);
      setShakeInput(false);
    }, 2800);
  }, []);

  const showSaveNotice = (msg: string) => {
    setCustomSaveNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setCustomSaveNotice(null);
    }, 3000);
  };

  // Matched player
  const matchedPlayer = useMemo(() => {
    if (!selectedTeam) return null;
    const num = parseInt(playerInput, 10);
    if (isNaN(num)) return null;
    return teamPlayers.find((p) => p.number === num) || null;
  }, [selectedTeam, playerInput, teamPlayers]);

  // Check if a candidate number is valid on the roster
  const isCandidateValid = useCallback(
    (candidate: string): { valid: boolean; reason?: string } => {
      if (!selectedTeam) {
        return { valid: false, reason: `Please select a team (Pelham Pelicans or ${visitorTeamName}) first` };
      }
      if (!candidate) return { valid: true };
      const num = parseInt(candidate, 10);
      if (isNaN(num)) return { valid: false, reason: 'Only numbers allowed' };

      const existsPrefix = teamPlayers.some((p) => String(p.number).startsWith(candidate));
      if (!existsPrefix) {
        return { valid: false, reason: `No player on ${teamName} has jersey #${candidate}` };
      }
      return { valid: true };
    },
    [selectedTeam, teamPlayers, teamName, visitorTeamName]
  );

  const activeInfraction = selectedInfraction.trim() || 'penalty';

  // Construct effective clock speech string if enabled
  const effectiveClockString = useMemo(() => {
    if (!includeClockTime || !clockTimeInput.trim()) return '';
    const cleanTime = clockTimeInput.trim();
    if (clockPeriod) {
      const periodMap: Record<string, string> = {
        '1st': 'first period',
        '2nd': 'second period',
        '3rd': 'third period',
        OT: 'overtime',
      };
      const periodSpoken = periodMap[clockPeriod] || clockPeriod;
      return `${cleanTime} of the ${periodSpoken}`;
    }
    return cleanTime;
  }, [includeClockTime, clockTimeInput, clockPeriod]);

  // Real-time speech preview text matching requested template:
  // 'Number 12, Pelham Pelicans two minutes for [hooking]'
  const previewAnnouncementText = useMemo(() => {
    const pNum = matchedPlayer ? matchedPlayer.number : (playerInput ? parseInt(playerInput, 10) : 12);
    const pName = matchedPlayer ? matchedPlayer.name : undefined;

    return generatePenaltyPrompt(
      isNaN(pNum) ? 12 : pNum,
      teamName,
      durationText,
      activeInfraction,
      pName,
      includePlayerName,
      effectiveClockString
    );
  }, [matchedPlayer, playerInput, teamName, durationText, activeInfraction, includePlayerName, effectiveClockString]);

  // Duration selection helpers
  const handleSelectPresetDuration = (opt: { label: string; value: string }) => {
    setDurationText(opt.value);
    setDurationLabel(opt.label);
    setIsCustomDurationOpen(false);
  };

  const handleApplyCustomDuration = (mins: number, secs: number, saveAsDefault: boolean = false) => {
    const spoken = formatMinutesAndSecondsToSpoken(mins, secs);
    const display = formatDurationDisplay(mins, secs);
    setDurationText(spoken);
    setDurationLabel(display);
    setIsCustomDurationOpen(false);

    if (saveAsDefault) {
      saveGamePenaltyDuration(spoken, display);
      setSavedGameDefaultLabel(display);
      showSaveNotice(`Saved "${display}" (${spoken || 'Without Time'}) as game default!`);
    } else {
      showSaveNotice(`Penalty duration set to ${display}`);
    }
  };

  const handleSaveCurrentAsGameDefault = () => {
    saveGamePenaltyDuration(durationText, durationLabel);
    setSavedGameDefaultLabel(durationLabel);
    showSaveNotice(`Saved "${durationLabel}" as game default penalty time!`);
  };

  // Handle direct text input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTeam) {
      triggerValidationError(`Please choose a team (Pelham Pelicans or ${visitorTeamName}) first`);
      return;
    }

    const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (digits === '') {
      setPlayerInput('');
      setValidationError(null);
      return;
    }

    const val = isCandidateValid(digits);
    if (!val.valid) {
      triggerValidationError(val.reason || `Player #${digits} does not exist`);
      return;
    }

    setValidationError(null);
    setPlayerInput(digits);
  };

  // Handle keypad digit press
  const handleKeypadPress = useCallback(
    (digit: string) => {
      if (!selectedTeam) {
        triggerValidationError(`Please choose a team (Pelham Pelicans or ${visitorTeamName}) first`);
        return;
      }
      if (playerInput.length >= 2) return;
      const candidate = playerInput + digit;
      const val = isCandidateValid(candidate);
      if (!val.valid) {
        triggerValidationError(val.reason || `Player #${candidate} does not exist`);
        return;
      }
      setValidationError(null);
      setPlayerInput(candidate);
    },
    [selectedTeam, visitorTeamName, playerInput, isCandidateValid, triggerValidationError]
  );

  const handleBackspace = useCallback(() => {
    setValidationError(null);
    setPlayerInput((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setValidationError(null);
    setPlayerInput('');
    playerInputRef.current?.focus();
  }, []);

  // Determine if a keypad digit can be pressed
  const isDigitAllowed = useCallback(
    (digit: string) => {
      if (!selectedTeam) return false;
      if (playerInput.length >= 2) return false;
      const candidate = playerInput + digit;
      return isCandidateValid(candidate).valid;
    },
    [selectedTeam, playerInput, isCandidateValid]
  );

  // Handle saving and selecting a custom penalty category
  const handleSaveAndUseCustomPenalty = () => {
    const clean = customInfractionInput.trim();
    if (!clean) {
      triggerValidationError('Please enter a penalty infraction name');
      return;
    }

    const res = saveCustomPenalty(clean);
    if (!res.success && res.error) {
      triggerValidationError(res.error);
      return;
    }

    setInfractionsList(res.list);
    setSelectedInfraction(clean.toLowerCase());
    setIsCustomMode(false);
    setCustomInfractionInput('');
    showSaveNotice(`Saved "${clean}" to penalty categories!`);
  };

  // Handle using custom penalty once without saving permanently
  const handleUseOnceCustomPenalty = () => {
    const clean = customInfractionInput.trim();
    if (!clean) {
      triggerValidationError('Please enter a penalty infraction name');
      return;
    }
    setSelectedInfraction(clean.toLowerCase());
    setIsCustomMode(false);
  };

  // Handle deleting a custom saved penalty
  const handleDeleteCustomPenalty = (e: React.MouseEvent, infraction: string) => {
    e.stopPropagation();
    const updated = removeCustomPenalty(infraction);
    setInfractionsList(updated);
    if (selectedInfraction.toLowerCase() === infraction.toLowerCase()) {
      setSelectedInfraction('body check');
    }
    showSaveNotice(`Removed "${infraction}" from custom penalties`);
  };

  // Submit penalty announcement
  const handleSubmit = async () => {
    if (!selectedTeam) {
      triggerValidationError(`Please select which team is penalized first`);
      return;
    }
    if (!matchedPlayer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAnnouncePenalty(
        selectedTeam,
        matchedPlayer,
        durationText,
        activeInfraction,
        previewAnnouncementText,
        effectiveClockString || undefined
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-athletic uppercase tracking-wider flex items-center gap-2">
                <span>Penalty Announcement</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Template: &quot;Number [X], [Team] [time] for [foul]&quot; (or without time)
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

        {/* Manual Team Selector Tabs - Not pre-selected to prevent game-time mistakes */}
        <div className="bg-slate-900/95 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              1. Penalized Team:
            </span>
            {!selectedTeam && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                Choose Team First
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="penalty-select-home-btn"
              onClick={() => {
                setSelectedTeam('home');
                setPlayerInput('');
                setValidationError(null);
                if (onSwitchTeamTab) onSwitchTeamTab('home');
                setTimeout(() => playerInputRef.current?.focus(), 60);
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
              id="penalty-select-visitor-btn"
              onClick={() => {
                setSelectedTeam('visitor');
                setPlayerInput('');
                setValidationError(null);
                if (onSwitchTeamTab) onSwitchTeamTab('visitor');
                setTimeout(() => playerInputRef.current?.focus(), 60);
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

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Unselected Team Prompt */}
          {!selectedTeam && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Please tap <strong>Pelham Pelicans</strong> or <strong>{visitorTeamName}</strong> above to choose the penalized team before entering jersey numbers.
              </span>
            </div>
          )}

          {/* Validation Alert */}
          {validationError && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-bounce">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="flex-1">{validationError}</span>
            </div>
          )}

          {/* Success / Save Notice */}
          {customSaveNotice && (
            <div className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="flex-1">{customSaveNotice}</span>
            </div>
          )}

          {/* Player Input Section */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              shakeInput
                ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40'
                : matchedPlayer
                ? 'bg-amber-500/10 border-amber-400/80 shadow-md shadow-amber-500/10'
                : !selectedTeam
                ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>2. Penalized Player Number</span>
              </span>
              {matchedPlayer && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Valid Roster Player
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-16 h-12">
                <input
                  ref={playerInputRef}
                  id="penalty-player-number-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  disabled={!selectedTeam}
                  value={playerInput}
                  onChange={handleInputChange}
                  placeholder="--"
                  className="w-full h-full text-center rounded-lg bg-slate-900 border border-slate-700 text-2xl font-athletic font-black text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
                />
                {playerInput && (
                  <span className="absolute left-1.5 top-1.5 text-[9px] font-mono text-amber-500/70">#</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {matchedPlayer ? (
                  <div>
                    <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                      <span>{matchedPlayer.name}</span>
                      <span className="text-xs text-amber-400 font-athletic font-black">#{matchedPlayer.number}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {teamName} • {matchedPlayer.goals} G, {matchedPlayer.assists} A
                    </p>
                  </div>
                ) : !selectedTeam ? (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold">Select team above first</p>
                    <p className="text-[10px] text-slate-500">Pelham Pelicans or {visitorTeamName}</p>
                  </div>
                ) : playerInput ? (
                  <div>
                    <p className="text-xs font-semibold text-amber-400">Typing #{playerInput}...</p>
                    <p className="text-[10px] text-slate-500">Must match player on {teamName}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-300 font-semibold">Enter or tap player number</p>
                    <p className="text-[10px] text-slate-500">Only active roster players on {teamName}</p>
                  </div>
                )}
              </div>

              {playerInput && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors"
                  title="Clear number"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Roster Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Quick Select from {selectedTeam ? teamName : 'Team'}:</span>
              </span>
            </div>

            {selectedTeam ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                {teamPlayers.map((player) => {
                  const isSelected = playerInput === String(player.number);
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => {
                        setPlayerInput(String(player.number));
                        setValidationError(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all active:scale-95 border ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
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
              <div className="p-2 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                👈 Select a team above to display players
              </div>
            )}
          </div>

          {/* Keypad */}
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => {
                const isAllowed = isDigitAllowed(digit);
                return (
                  <button
                    key={digit}
                    type="button"
                    disabled={!isAllowed}
                    onClick={() => handleKeypadPress(digit)}
                    className={`h-11 rounded-lg text-lg font-athletic font-black border flex items-center justify-center transition-all ${
                      isAllowed
                        ? 'bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-100 border-slate-700/80'
                        : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-30'
                    }`}
                  >
                    {digit}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={!selectedTeam || !playerInput}
                onClick={handleClear}
                className="h-11 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500 active:text-white text-rose-400 font-bold text-xs uppercase tracking-wider border border-rose-500/30 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Clear
              </button>

              {(() => {
                const isAllowed = isDigitAllowed('0');
                return (
                  <button
                    type="button"
                    disabled={!isAllowed}
                    onClick={() => handleKeypadPress('0')}
                    className={`h-11 rounded-lg text-lg font-athletic font-black border flex items-center justify-center transition-all ${
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
                disabled={!selectedTeam || !playerInput}
                onClick={handleBackspace}
                className="h-11 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 text-sm font-bold border border-slate-700/80 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Penalty Duration Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Penalty Duration</span>
                {durationLabel && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-md normal-case">
                    {durationLabel}
                  </span>
                )}
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomDurationOpen(!isCustomDurationOpen)}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                >
                  {isCustomDurationOpen ? (
                    <>
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Preset Durations</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Custom Time</span>
                    </>
                  )}
                </button>

                {durationText ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDurationText('');
                      setDurationLabel('Without Time');
                      setIsCustomDurationOpen(false);
                    }}
                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 underline flex items-center gap-1"
                    title="Announce penalty without stating duration"
                  >
                    <span>Without Time</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-full">
                    No Time
                  </span>
                )}
              </div>
            </div>

            {/* Custom Penalty Duration Creator / Stepper */}
            {isCustomDurationOpen ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5" />
                    <span>Exact Custom Penalty Time</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
                    {formatDurationDisplay(customMinutes, customSeconds)}
                  </span>
                </div>

                {/* Minute & Second Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Minutes */}
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                      <span>Minutes</span>
                      <span className="text-amber-400 font-bold font-mono">{customMinutes} min</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomMinutes((m) => Math.max(0, m - 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="flex-1 text-center bg-slate-950 border border-slate-700 rounded-lg py-1 text-sm font-mono font-bold text-white focus:ring-amber-500 focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomMinutes((m) => Math.min(60, m + 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick minute buttons */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[0, 1, 2, 3, 4, 5, 10].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCustomMinutes(m)}
                          className={`px-2 py-0.5 text-[10px] rounded-md font-semibold border ${
                            customMinutes === m
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Seconds */}
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                      <span>Seconds</span>
                      <span className="text-amber-400 font-bold font-mono">
                        :{customSeconds < 10 ? '0' : ''}{customSeconds} sec
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomSeconds((s) => Math.max(0, s - 15))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
                      >
                        -15
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={customSeconds}
                        onChange={(e) => setCustomSeconds(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                        className="flex-1 text-center bg-slate-950 border border-slate-700 rounded-lg py-1 text-sm font-mono font-bold text-white focus:ring-amber-500 focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomSeconds((s) => Math.min(59, s + 15))}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
                      >
                        +15
                      </button>
                    </div>

                    {/* Quick second buttons */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[0, 15, 30, 45].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCustomSeconds(s)}
                          className={`px-2 py-0.5 text-[10px] rounded-md font-semibold border ${
                            customSeconds === s
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          :{s < 10 ? '0' : ''}{s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Spoken translation preview */}
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                  <span className="text-slate-400">Speech says:</span>
                  <span className="font-semibold text-amber-300">
                    &ldquo;{formatMinutesAndSecondsToSpoken(customMinutes, customSeconds) || 'Without Time'}&rdquo;
                  </span>
                </div>

                {/* Custom Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCustomDurationOpen(false)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCustomDuration(customMinutes, customSeconds, false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700"
                  >
                    Apply Time
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCustomDuration(customMinutes, customSeconds, true)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                  >
                    <Pin className="w-3 h-3" />
                    <span>Apply & Save for Game</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Presets Grid */
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {STANDARD_PENALTY_DURATIONS.map((opt) => {
                    const isSelected = durationText === opt.value;
                    const isWithoutTime = opt.value === '';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectPresetDuration(opt)}
                        className={`py-1.5 px-2 rounded-xl text-xs border transition-all text-center flex flex-col items-center justify-center ${
                          isSelected
                            ? isWithoutTime
                              ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20 font-black scale-[1.02]'
                              : 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black scale-[1.02]'
                            : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold leading-tight">{opt.label}</span>
                        <span
                          className={`text-[9px] mt-0.5 leading-none ${
                            isSelected
                              ? isWithoutTime
                                ? 'text-rose-100'
                                : 'text-slate-900 font-semibold'
                              : 'text-slate-500'
                          }`}
                        >
                          {opt.sublabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Game Default persistence toolbar */}
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/70 rounded-lg border border-slate-800/80 text-[10.5px]">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span>Default for this game:</span>
                    <strong className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      {savedGameDefaultLabel}
                    </strong>
                  </span>

                  <button
                    type="button"
                    onClick={handleSaveCurrentAsGameDefault}
                    className="text-[10.5px] font-semibold text-slate-300 hover:text-amber-300 flex items-center gap-1 hover:underline"
                    title="Remember this duration so the modal opens with it throughout this game"
                  >
                    <Pin className="w-3 h-3 text-amber-400" />
                    <span>Set {durationLabel} as Game Default</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Optional: Time of Penalty on Game Clock */}
          <div className="bg-slate-950/70 rounded-xl border border-slate-800/90 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includeClockTime}
                  onChange={(e) => setIncludeClockTime(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-sky-400 w-3.5 h-3.5"
                />
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Time of Penalty on Game Clock (Optional)</span>
                </span>
              </label>

              {includeClockTime && (clockTimeInput || clockPeriod) && (
                <button
                  type="button"
                  onClick={() => {
                    setClockTimeInput('');
                    setClockPeriod('');
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-400 underline"
                >
                  Clear Clock
                </button>
              )}
            </div>

            {includeClockTime && (
              <div className="space-y-2 pt-1 border-t border-slate-800/60 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Clock time e.g. 8:42"
                      value={clockTimeInput}
                      onChange={(e) => setClockTimeInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:border-sky-500 focus:ring-sky-500"
                    />
                  </div>

                  {/* Period Tags */}
                  <div className="flex items-center gap-1">
                    {(['1st', '2nd', '3rd', 'OT'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setClockPeriod(clockPeriod === p ? '' : p)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                          clockPeriod === p
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {effectiveClockString && (
                  <p className="text-[10px] text-sky-300/80 font-mono">
                    Will append: &ldquo;Time of the penalty, {effectiveClockString}.&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Penalty Infraction Selection with Saved Custom Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>4. Type of Foul / Infraction</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsCustomMode(!isCustomMode);
                  if (!isCustomMode) {
                    setTimeout(() => customInputRef.current?.focus(), 50);
                  }
                }}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
              >
                {isCustomMode ? (
                  <span>Pick from List</span>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>+ Add Custom Foul</span>
                  </>
                )}
              </button>
            </div>

            {/* Inline Custom Foul Creator */}
            {isCustomMode ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>New Custom Penalty Category</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Saves to local penalty list</span>
                </div>

                <div className="space-y-1.5">
                  <input
                    ref={customInputRef}
                    id="penalty-custom-foul-input"
                    type="text"
                    value={customInfractionInput}
                    onChange={(e) => setCustomInfractionInput(e.target.value)}
                    placeholder="Enter custom foul (e.g. body check, spearing, kneeing, head contact...)"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveAndUseCustomPenalty();
                      }
                    }}
                  />
                  <p className="text-[10px] text-slate-400">
                    Will announce: &ldquo;{durationText ? `${durationText} for ` : 'for '}{customInfractionInput || '...'}&rdquo;
                  </p>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400">Suggestions:</span>
                  {['body check', 'body checking', 'head contact', 'kneeing', 'spearing', 'delay of game'].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setCustomInfractionInput(sug)}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(false)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUseOnceCustomPenalty}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    Use Once
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndUseCustomPenalty}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1 shadow-sm shadow-amber-500/20"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save &amp; Select</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Infraction Buttons List */
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                  {infractionsList.map((infraction) => {
                    const isSelected = selectedInfraction.toLowerCase() === infraction.toLowerCase();
                    const isCustom = isCustomSavedPenalty(infraction);
                    return (
                      <div
                        key={infraction}
                        className="relative group"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedInfraction(infraction)}
                          className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold capitalize border transition-all text-left flex items-center justify-between gap-1 truncate ${
                            isSelected
                              ? 'bg-rose-500 text-white border-rose-400 shadow-sm font-bold scale-[1.01]'
                              : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span className="truncate">{infraction}</span>
                          {isCustom && !isSelected && (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 shrink-0">
                              custom
                            </span>
                          )}
                        </button>

                        {/* Delete button for custom saved items */}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomPenalty(e, infraction)}
                            className="absolute right-1 top-1.5 p-1 rounded hover:bg-rose-950/80 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Remove "${infraction}" from saved penalties`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Announcement Template & Speech Preview */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Penalty Speech Announcement</span>
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={includePlayerName}
                  onChange={(e) => setIncludePlayerName(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-400 w-3 h-3"
                />
                <span>Include Name</span>
              </label>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <p className="text-xs font-mono font-bold text-amber-300 leading-relaxed">
                &ldquo;{previewAnnouncementText}&rdquo;
              </p>
            </div>
            <p className="text-[10px] text-slate-500">
              {durationText
                ? `Template: "Number ${matchedPlayer?.number || '12'}, ${teamName} ${durationText} for ${activeInfraction}.${effectiveClockString ? ` Time of the penalty, ${effectiveClockString}.` : ''}"`
                : `Template: "Number ${matchedPlayer?.number || '12'}, ${teamName} for ${activeInfraction}.${effectiveClockString ? ` Time of the penalty, ${effectiveClockString}.` : ''}"`}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!selectedTeam || !matchedPlayer || isSubmitting}
            onClick={handleSubmit}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
              !selectedTeam || !matchedPlayer || isSubmitting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/25 active:scale-95 font-black uppercase tracking-wider'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Announcing...'
                : !selectedTeam
                ? '1. Choose Team Above'
                : !matchedPlayer
                ? '2. Enter Player #'
                : 'Announce Penalty!'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

