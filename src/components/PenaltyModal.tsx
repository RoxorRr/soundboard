import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, ShieldAlert, Volume2, Delete, ArrowRight, Check, Hash, Users, AlertCircle, Sparkles, Clock } from 'lucide-react';
import { Player } from '../types';
import { generatePenaltyPrompt } from '../utils/audio';

interface PenaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  homePlayers: Player[];
  visitorPlayers: Player[];
  activeTeamTab: 'home' | 'visitor';
  onSwitchTeamTab?: (tab: 'home' | 'visitor') => void;
  visitorTeamName?: string;
  onAnnouncePenalty: (
    team: 'home' | 'visitor',
    player: Player,
    durationText: string,
    infraction: string,
    promptText: string
  ) => Promise<void> | void;
}

// Common hockey penalty infractions
const COMMON_PENALTIES = [
  'hooking',
  'slashing',
  'tripping',
  'roughing',
  'interference',
  'high-sticking',
  'cross-checking',
  'holding',
  'boarding',
  'charging',
  'elbowing',
  'delay of game',
  'unsportsmanlike conduct',
  'checking from behind',
  'too many men',
  'misconduct',
] as const;

const DURATION_OPTIONS = [
  { id: 'none', label: 'Without Time', sublabel: 'No duration', value: '' },
  { id: 'one minute', label: '1 Min', sublabel: '1:00', value: 'one minute' },
  { id: 'one minute and thirty seconds', label: '1:30 Min', sublabel: '1:30', value: 'one minute and thirty seconds' },
  { id: 'two minutes', label: '2 Min (Minor)', sublabel: '2:00', value: 'two minutes' },
  { id: 'four minutes', label: '4 Min (Double)', sublabel: '4:00', value: 'four minutes' },
  { id: 'five minutes', label: '5 Min (Major)', sublabel: '5:00', value: 'five minutes' },
  { id: 'ten minutes', label: '10 Min (Misconduct)', sublabel: '10:00', value: 'ten minutes' },
];

export const PenaltyModal: React.FC<PenaltyModalProps> = ({
  isOpen,
  onClose,
  homePlayers,
  visitorPlayers,
  activeTeamTab,
  onSwitchTeamTab,
  visitorTeamName = 'Visitor Team',
  onAnnouncePenalty,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'visitor'>(activeTeamTab);
  const [playerInput, setPlayerInput] = useState<string>('');
  const [durationText, setDurationText] = useState<string>('two minutes');
  const [selectedInfraction, setSelectedInfraction] = useState<string>('hooking');
  const [customInfraction, setCustomInfraction] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [includePlayerName, setIncludePlayerName] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [shakeInput, setShakeInput] = useState<boolean>(false);

  const playerInputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTeam(activeTeamTab);
      setPlayerInput('');
      setDurationText('two minutes');
      setSelectedInfraction('hooking');
      setCustomInfraction('');
      setIsCustomMode(false);
      setValidationError(null);
      setShakeInput(false);
      setTimeout(() => {
        playerInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, activeTeamTab]);

  // Clean error timer
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  const teamPlayers = useMemo(() => {
    return selectedTeam === 'visitor' ? visitorPlayers : homePlayers;
  }, [selectedTeam, visitorPlayers, homePlayers]);

  const teamName = selectedTeam === 'visitor' ? (visitorTeamName.trim() || 'Visitor Team') : 'Pelham Pelicans';

  const triggerValidationError = useCallback((msg: string) => {
    setValidationError(msg);
    setShakeInput(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setValidationError(null);
      setShakeInput(false);
    }, 2800);
  }, []);

  // Matched player
  const matchedPlayer = useMemo(() => {
    const num = parseInt(playerInput, 10);
    if (isNaN(num)) return null;
    return teamPlayers.find((p) => p.number === num) || null;
  }, [playerInput, teamPlayers]);

  // Check if a candidate number is valid on the roster
  const isCandidateValid = useCallback(
    (candidate: string): { valid: boolean; reason?: string } => {
      if (!candidate) return { valid: true };
      const num = parseInt(candidate, 10);
      if (isNaN(num)) return { valid: false, reason: 'Only numbers allowed' };

      const existsPrefix = teamPlayers.some((p) => String(p.number).startsWith(candidate));
      if (!existsPrefix) {
        return { valid: false, reason: `No player on ${teamName} has jersey #${candidate}` };
      }
      return { valid: true };
    },
    [teamPlayers, teamName]
  );

  const activeInfraction = isCustomMode ? customInfraction.trim() || 'penalty' : selectedInfraction;

  // Real-time speech preview text matching requested template:
  // 'Number 12, Pelham Pelikans two minutes for [hooking]'
  const previewAnnouncementText = useMemo(() => {
    const pNum = matchedPlayer ? matchedPlayer.number : (playerInput ? parseInt(playerInput, 10) : 12);
    const pName = matchedPlayer ? matchedPlayer.name : undefined;

    return generatePenaltyPrompt(
      isNaN(pNum) ? 12 : pNum,
      teamName,
      durationText,
      activeInfraction,
      pName,
      includePlayerName
    );
  }, [matchedPlayer, playerInput, teamName, durationText, activeInfraction, includePlayerName]);

  // Handle direct text input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    [playerInput, isCandidateValid, triggerValidationError]
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
      if (playerInput.length >= 2) return false;
      const candidate = playerInput + digit;
      return isCandidateValid(candidate).valid;
    },
    [playerInput, isCandidateValid]
  );

  // Submit penalty announcement
  const handleSubmit = async () => {
    if (!matchedPlayer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAnnouncePenalty(
        selectedTeam,
        matchedPlayer,
        durationText,
        activeInfraction,
        previewAnnouncementText
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

        {/* Team Selector Tabs */}
        <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Penalized Team:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedTeam('home');
                setPlayerInput('');
                setValidationError(null);
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
                setPlayerInput('');
                setValidationError(null);
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
          {/* Validation Alert */}
          {validationError && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-bounce">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="flex-1">{validationError}</span>
            </div>
          )}

          {/* Player Input Section */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              shakeInput
                ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/40'
                : matchedPlayer
                ? 'bg-amber-500/10 border-amber-400/80 shadow-md shadow-amber-500/10'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>Penalized Player Number</span>
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
                  value={playerInput}
                  onChange={handleInputChange}
                  placeholder="--"
                  className="w-full h-full text-center rounded-lg bg-slate-900 border border-slate-700 text-2xl font-athletic font-black text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
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
                ) : playerInput ? (
                  <div>
                    <p className="text-xs font-semibold text-amber-400">Typing #{playerInput}...</p>
                    <p className="text-[10px] text-slate-500">Must match player on {teamName}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-300 font-semibold">Enter or tap player number</p>
                    <p className="text-[10px] text-slate-500">Only active roster players allowed</p>
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
                <span>Quick Select from {teamName}:</span>
              </span>
            </div>

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
                onClick={handleClear}
                className="h-11 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500 active:text-white text-rose-400 font-bold text-xs uppercase tracking-wider border border-rose-500/30 flex items-center justify-center transition-all"
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
                onClick={handleBackspace}
                className="h-11 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-300 text-sm font-bold border border-slate-700/80 flex items-center justify-center transition-all"
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Penalty Duration Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Penalty Duration</span>
              </label>

              {durationText ? (
                <button
                  type="button"
                  onClick={() => setDurationText('')}
                  className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 underline flex items-center gap-1"
                  title="Announce penalty without stating duration"
                >
                  <span>Announce Without Time</span>
                </button>
              ) : (
                <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-full">
                  Time Omitted (No Duration)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {DURATION_OPTIONS.map((opt) => {
                const isSelected = durationText === opt.value;
                const isWithoutTime = opt.value === '';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDurationText(opt.value)}
                    className={`py-1.5 sm:py-2 px-2 rounded-xl text-xs border transition-all text-center flex flex-col items-center justify-center ${
                      isSelected
                        ? isWithoutTime
                          ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20 font-black scale-[1.02]'
                          : 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black scale-[1.02]'
                        : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold leading-tight">{opt.label}</span>
                    <span
                      className={`text-[9.5px] mt-0.5 leading-none ${
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
          </div>

          {/* Penalty Infraction Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Type of Foul / Infraction</span>
              </label>

              <button
                type="button"
                onClick={() => setIsCustomMode(!isCustomMode)}
                className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 underline"
              >
                {isCustomMode ? 'Pick from List' : 'Custom Foul'}
              </button>
            </div>

            {isCustomMode ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={customInfraction}
                  onChange={(e) => setCustomInfraction(e.target.value)}
                  placeholder="Enter custom foul (e.g. kneeing, spearing...)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <p className="text-[10px] text-slate-500">
                  Will announce: &ldquo;{durationText ? `${durationText} for ` : 'for '}{customInfraction || '...'}&rdquo;
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                {COMMON_PENALTIES.map((infraction) => {
                  const isSelected = selectedInfraction === infraction;
                  return (
                    <button
                      key={infraction}
                      type="button"
                      onClick={() => setSelectedInfraction(infraction)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize border transition-all text-center truncate ${
                        isSelected
                          ? 'bg-rose-500 text-white border-rose-400 shadow-sm font-bold scale-[1.02]'
                          : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {infraction}
                    </button>
                  );
                })}
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
                ? `Template: "Number ${matchedPlayer?.number || '12'}, ${teamName} ${durationText} for ${activeInfraction}."`
                : `Template: "Number ${matchedPlayer?.number || '12'}, ${teamName} for ${activeInfraction}."`}
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
            disabled={!matchedPlayer || isSubmitting}
            onClick={handleSubmit}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
              !matchedPlayer || isSubmitting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/25 active:scale-95 font-black uppercase tracking-wider'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Announcing...' : 'Announce Penalty!'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
