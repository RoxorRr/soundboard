import React from 'react';
import { Plus, Minus, Camera } from 'lucide-react';
import { Player } from '../types';

interface PlayerTrackerRowProps {
  player: Player;
  index: number;
  mode: 'goals' | 'assists';
  isActiveAnnouncing: boolean;
  teamName?: string;
  onIncrement: (player: Player) => void;
  onDecrement: (player: Player) => void;
  onScanSticker?: (player: Player) => void;
}

export const PlayerTrackerRow: React.FC<PlayerTrackerRowProps> = ({
  player,
  index,
  mode,
  isActiveAnnouncing,
  teamName = 'Pelham Pelicans',
  onIncrement,
  onDecrement,
  onScanSticker,
}) => {
  const isGoal = mode === 'goals';
  const count = isGoal ? player.goals : player.assists;

  return (
    <div
      id={`player-row-${mode}-${player.id}`}
      className={`group relative flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border transition-all duration-200 ${
        isActiveAnnouncing
          ? isGoal
            ? 'bg-amber-500/15 border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400'
            : 'bg-sky-500/15 border-sky-400 shadow-md shadow-sky-500/10 ring-1 ring-sky-400'
          : count > 0
          ? 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
          : 'bg-slate-950/60 border-slate-800/60 hover:border-slate-700/80'
      }`}
    >
      {/* Player Identity (Jersey Number + Name) */}
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        {/* Jersey Number Badge */}
        <span
          className={`shrink-0 w-8 h-8 rounded font-black flex items-center justify-center font-athletic text-sm border shadow-inner ${
            isGoal
              ? count > 0
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                : 'bg-slate-800 text-slate-300 border-slate-700'
              : count > 0
              ? 'bg-sky-400 text-slate-950 border-sky-300 font-bold'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {player.number}
        </span>

        {/* Player Name */}
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <div className="min-w-0 truncate">
            <p className="text-xs sm:text-sm font-bold text-slate-100 truncate tracking-tight">
              {player.name}
            </p>
            <p className="text-[10px] text-slate-400 font-medium truncate">
              {teamName} #{player.number}
            </p>
          </div>

          {/* Quick scan sticker icon button for this player */}
          {onScanSticker && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onScanSticker(player);
              }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-opacity"
              title={`Scan sticker to update #${player.number} ${player.name}`}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right Side: Big Number & Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Big Number Score Counter */}
        <div
          className={`w-12 sm:w-14 text-center font-athletic font-black text-2xl sm:text-3xl tabular-nums tracking-tighter transition-colors ${
            count > 0
              ? isGoal
                ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                : 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]'
              : 'text-slate-600'
          }`}
          title={`${player.name}: ${count} ${isGoal ? 'Goals' : 'Assists'}`}
        >
          {count}
        </div>

        {/* Decrement Button (-) */}
        <button
          id={`btn-decrement-${mode}-${player.id}`}
          onClick={() => onDecrement(player)}
          disabled={count === 0}
          className="w-7 h-7 rounded-md bg-slate-800/80 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-slate-400 hover:text-slate-200 border border-slate-700 flex items-center justify-center transition-all"
          title={`Minus 1 ${isGoal ? 'goal' : 'assist'}`}
          aria-label={`Decrease ${player.name} ${isGoal ? 'goals' : 'assists'}`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Increment / Score Button (+) with Big Audio Trigger */}
        <button
          id={`btn-increment-${mode}-${player.id}`}
          onClick={() => onIncrement(player)}
          className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-md font-bold text-xs flex items-center gap-1 active:scale-95 shadow-sm transition-all ${
            isGoal
              ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 border border-amber-300 shadow-amber-500/20'
              : 'bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 border border-sky-300 shadow-sky-500/20'
          }`}
          title={`Record ${isGoal ? 'Goal' : 'Assist'} and trigger NHL announcer audio`}
          aria-label={`Add ${isGoal ? 'goal' : 'assist'} for ${player.name}`}
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span className="font-athletic uppercase tracking-wider text-[11px] sm:text-xs">
            {isGoal ? 'Goal' : 'Assist'}
          </span>
        </button>
      </div>
    </div>
  );
};
