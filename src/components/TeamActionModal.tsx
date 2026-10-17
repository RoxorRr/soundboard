import React, { useState, useEffect } from 'react';
import {
  X,
  Flame,
  Award,
  Hash,
  ShieldAlert,
  Clock,
  Volume2,
  Sparkles,
  Sliders,
  Users,
  UserMinus,
  UserPlus,
  Camera,
  RotateCcw,
  Zap,
  Edit2,
  Check,
  Play,
  Square,
} from 'lucide-react';

interface TeamActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: 'home' | 'visitor';
  teamName: string;
  goals?: number;
  assists?: number;
  playerCount: number;
  onOpenGoalActionCenter: () => void;
  onOpenKeypadGoal: () => void;
  onOpenPenalty: () => void;
  onOpenPeriodWarning: () => void;
  onOpenSpeakerTest: () => void;
  onOpenWelcome: () => void;
  onOpenMixer: () => void;
  onOpenRosterModal: () => void;
  onOpenScanner: () => void;
  onToggleAttendanceMode: () => void;
  isAttendanceModeActive: boolean;
  onAddNewPlayer: () => void;
  onResetScores: () => void;
  onStartRenameVisitor?: () => void;
  onUpdateTeamName?: (newName: string) => void;
  onToggleMp3?: () => void;
  isMp3Playing?: boolean;
}

export const TeamActionModal: React.FC<TeamActionModalProps> = ({
  isOpen,
  onClose,
  team,
  teamName,
  goals,
  assists,
  playerCount,
  onOpenGoalActionCenter,
  onOpenKeypadGoal,
  onOpenPenalty,
  onOpenPeriodWarning,
  onOpenSpeakerTest,
  onOpenWelcome,
  onOpenMixer,
  onOpenRosterModal,
  onOpenScanner,
  onToggleAttendanceMode,
  isAttendanceModeActive,
  onAddNewPlayer,
  onResetScores,
  onStartRenameVisitor,
  onUpdateTeamName,
  onToggleMp3,
  isMp3Playing = false,
}) => {
  const isHome = team === 'home';
  const [isEditingName, setIsEditingName] = useState(false);
  const [localTeamName, setLocalTeamName] = useState(teamName);
  const [renameSuccess, setRenameSuccess] = useState(false);

  // Sync local team name when teamName or isOpen changes
  useEffect(() => {
    setLocalTeamName(teamName);
    setIsEditingName(false);
    setRenameSuccess(false);
  }, [teamName, isOpen]);

  const handleSaveTeamName = () => {
    const trimmed = localTeamName.trim();
    if (trimmed) {
      if (onUpdateTeamName) {
        onUpdateTeamName(trimmed);
      }
      setRenameSuccess(true);
      setIsEditingName(false);
      setTimeout(() => setRenameSuccess(false), 2500);
    }
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-slate-900 border-2 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 ${
          isHome ? 'border-amber-500/80 shadow-amber-500/15' : 'border-rose-500/80 shadow-rose-500/15'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${
            isHome
              ? 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-950 border-amber-500/30'
              : 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-950 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-athletic font-black text-sm shrink-0 border shadow-md ${
                isHome
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 border-amber-300'
                  : 'bg-gradient-to-br from-rose-500 to-red-600 text-white border-rose-300'
              }`}
            >
              {isHome ? 'PEL' : 'VIS'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black uppercase font-athletic tracking-wider text-white truncate">
                  {teamName}
                </h2>
                <span
                  className={`text-[10px] font-athletic uppercase tracking-wider font-bold px-1.5 py-0.2 rounded border ${
                    isHome
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {isHome ? 'Home Team Menu' : 'Away Team Menu'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {playerCount} Active Lineup Players
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0 active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Action Groups */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-4 overscroll-contain">
          {/* Visitor Rename Card */}
          {!isHome && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">
                      Visiting Team: <span className="text-rose-300">&ldquo;{teamName}&rdquo;</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {renameSuccess ? '✓ Visiting team name updated!' : 'Change opponent name across arena PA, keypad & scoreboard'}
                    </span>
                  </div>
                </div>
                {!isEditingName && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalTeamName(teamName);
                      setIsEditingName(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-athletic font-bold text-xs uppercase tracking-wider shrink-0 transition-all shadow-sm flex items-center gap-1 active:scale-95"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Rename Team</span>
                  </button>
                )}
              </div>

              {/* Inline Editor inside Visitor Menu */}
              {isEditingName && (
                <div className="pt-2 border-t border-rose-500/20 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={localTeamName}
                      onChange={(e) => setLocalTeamName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveTeamName();
                        } else if (e.key === 'Escape') {
                          setIsEditingName(false);
                        }
                      }}
                      placeholder="Type visiting team name..."
                      className="flex-1 bg-slate-900 border border-rose-500/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-400 font-athletic uppercase tracking-wider"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveTeamName}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-athletic font-bold text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1 shadow-sm active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalTeamName(teamName);
                        setIsEditingName(false);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Opponent Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 mr-1 font-athletic uppercase">Quick pick:</span>
                    {['Grimsby Kings', 'Thorold Blackhawks', 'Welland Tigers', 'St. Catharines Falcons', 'Niagara Falls Canucks'].map((opponent) => (
                      <button
                        key={opponent}
                        type="button"
                        onClick={() => {
                          setLocalTeamName(opponent);
                          if (onUpdateTeamName) {
                            onUpdateTeamName(opponent);
                            setRenameSuccess(true);
                            setIsEditingName(false);
                            setTimeout(() => setRenameSuccess(false), 2500);
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-colors cursor-pointer"
                      >
                        {opponent}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Group 1: Scoring Actions */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-athletic font-bold uppercase tracking-wider text-slate-400 px-1 block">
              Scoring & Goal Actions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Goal Action Center */}
              <button
                type="button"
                onClick={() => handleAction(onOpenGoalActionCenter)}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/40 text-left transition-all group flex items-start gap-2.5"
              >
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                  <Flame className="w-4 h-4 fill-current" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-black text-xs sm:text-sm text-white group-hover:text-amber-300 uppercase tracking-wide">
                    Goal Action Center
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    Trigger Horn, pick Scorer & Assists, and play Voice-Over
                  </p>
                </div>
              </button>

              {/* Keypad Goal Entry */}
              <button
                type="button"
                onClick={() => handleAction(onOpenKeypadGoal)}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group flex items-start gap-2.5"
              >
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 shrink-0 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                  <Hash className="w-4 h-4 font-black" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-black text-xs sm:text-sm text-white uppercase tracking-wide">
                    Keypad Goal Entry
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    Type jersey numbers with numeric keypad
                  </p>
                </div>
              </button>

              {/* Goal Horn MP3 Track (Home only) */}
              {isHome && onToggleMp3 && (
                <button
                  type="button"
                  onClick={() => handleAction(onToggleMp3)}
                  className={`p-2.5 rounded-xl border text-left transition-all group flex items-start gap-2.5 ${
                    isMp3Playing
                      ? 'bg-red-500/20 border-red-500/60 text-white animate-pulse'
                      : 'bg-slate-950 hover:bg-amber-500/10 border-slate-800 hover:border-amber-500/40'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isMp3Playing ? 'bg-red-500 text-white' : 'bg-slate-800 text-amber-400 border border-slate-700'
                    }`}
                  >
                    {isMp3Playing ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-athletic font-black text-xs sm:text-sm text-white uppercase tracking-wide">
                      {isMp3Playing ? 'Stop Goal Horn MP3' : 'Play Goal Horn MP3'}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                      {isMp3Playing ? 'Currently playing across arena' : 'Full arena horn track'}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Group 2: Lineup & Attendance Management */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-athletic font-bold uppercase tracking-wider text-slate-400 px-1 block">
              Lineup & Roster Tools
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Manage Lineup & Roster */}
              <button
                type="button"
                onClick={() => handleAction(onOpenRosterModal)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all flex items-center gap-2.5"
              >
                <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                    Edit Roster & Lineup
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Change jersey numbers & names
                  </p>
                </div>
              </button>

              {/* Remove Absent Players Attendance Mode */}
              <button
                type="button"
                onClick={() => handleAction(onToggleAttendanceMode)}
                className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  isAttendanceModeActive
                    ? 'bg-rose-500/20 border-rose-500/60 text-white'
                    : 'bg-slate-950 hover:bg-rose-500/10 border-slate-800 hover:border-rose-500/30'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                  <UserMinus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                    {isAttendanceModeActive ? 'Done Removing Absent' : 'Remove Absent Players'}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Tap absent players to remove
                  </p>
                </div>
              </button>

              {/* Add New Player */}
              <button
                type="button"
                onClick={() => handleAction(onAddNewPlayer)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all flex items-center gap-2.5"
              >
                <div className="p-1.5 rounded-lg bg-slate-800 text-emerald-400 shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                    Add Next Player
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Add a jersey number to roster
                  </p>
                </div>
              </button>

              {/* Camera Scanner */}
              <button
                type="button"
                onClick={() => handleAction(onOpenScanner)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all flex items-center gap-2.5"
              >
                <div className="p-1.5 rounded-lg bg-slate-800 text-sky-400 shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                    Scan Sticker Lineup
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Optical camera scanner
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Group 3: Game Announcements */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-athletic font-bold uppercase tracking-wider text-slate-400 px-1 block">
              Arena Voice Announcements
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Announce Penalty */}
              <button
                type="button"
                onClick={() => handleAction(onOpenPenalty)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-left transition-all flex items-center gap-2.5"
              >
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                    Announce Penalty
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Number, 2 minutes for infraction
                  </p>
                </div>
              </button>

              {/* 1 Minute Warning */}
              <button
                type="button"
                onClick={() => handleAction(onOpenPeriodWarning)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-sky-500/10 border border-slate-800 hover:border-sky-500/30 text-left transition-all flex items-center gap-2.5"
              >
                <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                    1 Min Period Warning
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    One minute remaining in period
                  </p>
                </div>
              </button>

              {/* Speaker Test & Welcome (Home only) */}
              {isHome && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAction(onOpenSpeakerTest)}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-cyan-500/10 border border-slate-800 hover:border-cyan-500/30 text-left transition-all flex items-center gap-2.5"
                  >
                    <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                        Test Arena Speaker
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        Quick sound check test
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction(onOpenWelcome)}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/30 text-left transition-all flex items-center gap-2.5"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                        Welcome Pre-Game
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        Welcome fans and visiting team
                      </p>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Group 4: Audio Mixer & Score Reset */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800">
            <span className="text-[10px] font-athletic font-bold uppercase tracking-wider text-slate-400 px-1 block">
              Arena Settings & Controls
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {isHome && (
                <button
                  type="button"
                  onClick={() => handleAction(onOpenMixer)}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/30 text-left transition-all flex items-center gap-2.5"
                >
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-athletic font-bold text-xs text-white uppercase tracking-wider">
                      Arena Mixer & Goal Horn
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      Volume, delay, MP3 sync
                    </p>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleAction(onResetScores)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-left transition-all flex items-center gap-2.5"
              >
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-athletic font-bold text-xs text-rose-400 uppercase tracking-wider">
                    Reset Lineup & Match
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Clear audio announcements & stop sound
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
