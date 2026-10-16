import React from 'react';
import { UserMinus } from 'lucide-react';
import { Player } from '../types';

interface PlayerTrackerRowProps {
  player: Player;
  index: number;
  team: 'home' | 'visitor';
  teamName: string;
  isActiveAnnouncing?: boolean;
  isLineupEditMode?: boolean;
  onRemovePlayer?: (player: Player) => void;
}

export const PlayerTrackerRow: React.FC<PlayerTrackerRowProps> = ({
  player,
  team,
  teamName,
  isActiveAnnouncing = false,
  isLineupEditMode = false,
  onRemovePlayer,
}) => {
  const isHome = team === 'home';

  return (
    <div
      id={`player-row-${team}-${player.id}`}
      className={`group relative flex items-center justify-between px-3 py-2 sm:py-2.5 rounded-xl border transition-all duration-150 gap-2.5 select-none ${
        isActiveAnnouncing
          ? isHome
            ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400'
            : 'bg-rose-500/20 border-rose-400 shadow-lg shadow-rose-500/20 ring-1 ring-rose-400'
          : 'bg-slate-900/80 border-slate-800 shadow-sm'
      }`}
    >
      {/* Player Identity: Jersey Number Badge + Name (Informational) */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Jersey Number Badge */}
        <span
          className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-athletic font-black text-sm sm:text-base flex items-center justify-center border shadow-md ${
            isHome
              ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 border-amber-300 shadow-amber-500/20'
              : 'bg-gradient-to-br from-rose-500 to-red-600 text-white border-rose-300 shadow-rose-500/20'
          }`}
        >
          {player.number}
        </span>

        {/* Player Name & Subtitle */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm sm:text-base font-bold text-white truncate tracking-tight">
              {player.name || `Player #${player.number}`}
            </h4>
            {isActiveAnnouncing && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase font-athletic bg-amber-500 text-slate-950 animate-pulse">
                On Air
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium truncate">
            {teamName} · #{player.number}
          </p>
        </div>
      </div>

      {/* Right Action Area: Only in Lineup Edit Mode for removing absent players */}
      {isLineupEditMode && onRemovePlayer && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemovePlayer(player);
            }}
            className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold font-athletic uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shadow-sm shadow-rose-500/30 ring-1 ring-rose-400 cursor-pointer"
            title={`Remove #${player.number} ${player.name} from lineup (absent today)`}
          >
            <UserMinus className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>
      )}
    </div>
  );
};
