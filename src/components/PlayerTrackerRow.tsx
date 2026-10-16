import React from 'react';
import { Plus, Minus, Camera, UserMinus, Flame, Award, Zap } from 'lucide-react';
import { Player } from '../types';

interface PlayerTrackerRowProps {
  player: Player;
  index: number;
  mode: 'goals' | 'assists' | 'connected';
  isActiveAnnouncing: boolean;
  teamName?: string;
  isLineupEditMode?: boolean;
  onIncrement: (player: Player) => void;
  onDecrement: (player: Player) => void;
  onScanSticker?: (player: Player) => void;
  onRemovePlayer?: (player: Player) => void;
  // Connected cross-track handlers
  onConnectedGoalIncrement?: (player: Player) => void;
  onConnectedGoalDecrement?: (player: Player) => void;
  onConnectedAssistIncrement?: (player: Player) => void;
  onConnectedAssistDecrement?: (player: Player) => void;
  onConnectGoalAndAssist?: (player: Player) => void;
}

export const PlayerTrackerRow: React.FC<PlayerTrackerRowProps> = ({
  player,
  index,
  mode,
  isActiveAnnouncing,
  teamName = 'Pelham Pelicans',
  isLineupEditMode = false,
  onIncrement,
  onDecrement,
  onScanSticker,
  onRemovePlayer,
  onConnectedGoalIncrement,
  onConnectedGoalDecrement,
  onConnectedAssistIncrement,
  onConnectedAssistDecrement,
  onConnectGoalAndAssist,
}) => {
  const isGoal = mode === 'goals';
  const isConnected = mode === 'connected';
  const count = isGoal ? player.goals : player.assists;
  const totalPoints = (player.goals || 0) + (player.assists || 0);

  // If in fully connected mode: render unified Goals + Assists row
  if (isConnected) {
    const handleGoalPlus = () => {
      if (onConnectedGoalIncrement) onConnectedGoalIncrement(player);
      else if (isGoal) onIncrement(player);
    };
    const handleGoalMinus = () => {
      if (onConnectedGoalDecrement) onConnectedGoalDecrement(player);
      else if (isGoal) onDecrement(player);
    };
    const handleAssistPlus = () => {
      if (onConnectedAssistIncrement) onConnectedAssistIncrement(player);
      else if (!isGoal) onIncrement(player);
    };
    const handleAssistMinus = () => {
      if (onConnectedAssistDecrement) onConnectedAssistDecrement(player);
      else if (!isGoal) onDecrement(player);
    };

    return (
      <div
        id={`player-row-connected-${player.id}`}
        className={`group relative flex flex-wrap sm:flex-nowrap items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border transition-all duration-200 gap-2 ${
          isActiveAnnouncing
            ? 'bg-amber-500/15 border-amber-400 shadow-md shadow-amber-500/15 ring-1 ring-amber-400'
            : totalPoints > 0
            ? 'bg-slate-900/85 border-slate-700/80 hover:border-slate-600'
            : 'bg-slate-950/60 border-slate-800/60 hover:border-slate-700/80'
        }`}
      >
        {/* Player Identity (Jersey Number + Name + Total Points) */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Jersey Number Badge */}
          <span
            className={`shrink-0 w-8 h-8 rounded font-black flex items-center justify-center font-athletic text-sm border shadow-inner ${
              totalPoints > 0
                ? 'bg-gradient-to-br from-amber-400 to-sky-400 text-slate-950 border-amber-300 font-bold'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {player.number}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs sm:text-sm font-bold text-slate-100 truncate tracking-tight">
                {player.name}
              </p>
              {/* Total Points Badge */}
              <span
                className={`text-[10px] font-athletic font-bold px-1.5 py-0.2 rounded border tabular-nums shrink-0 ${
                  totalPoints > 0
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title={`${player.goals} Goals + ${player.assists} Assists = ${totalPoints} Points`}
              >
                {totalPoints} PTS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate">
              {teamName} #{player.number}
            </p>
          </div>

          {/* Lineup edit remove button */}
          {isLineupEditMode && onRemovePlayer && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePlayer(player);
              }}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 shrink-0"
              title={`Remove #${player.number} ${player.name} from lineup (not present)`}
            >
              <UserMinus className="w-3 h-3 text-rose-400" />
              <span>Remove</span>
            </button>
          )}

          {!isLineupEditMode && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {onRemovePlayer && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePlayer(player);
                  }}
                  className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  title={`Remove #${player.number} ${player.name} (not present)`}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
              {onScanSticker && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScanSticker(player);
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                  title={`Scan sticker to update #${player.number} ${player.name}`}
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dual Connected Controls: Goals & Assists Side-by-Side */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* GOAL CONTROLS */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-md border border-amber-500/20">
            <span className="text-[10px] font-athletic font-bold text-amber-400 uppercase tracking-wider px-1 flex items-center gap-0.5">
              <Flame className="w-3 h-3 text-amber-400 fill-current" /> G:
            </span>
            <div
              className={`w-7 text-center font-athletic font-black text-lg tabular-nums ${
                player.goals > 0 ? 'text-amber-400' : 'text-slate-600'
              }`}
            >
              {player.goals}
            </div>
            <button
              id={`btn-decrement-goal-${player.id}`}
              onClick={handleGoalMinus}
              disabled={player.goals === 0}
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-20 text-slate-300 border border-slate-700 flex items-center justify-center text-xs"
              title="Minus 1 goal"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id={`btn-increment-goal-${player.id}`}
              onClick={handleGoalPlus}
              className="h-6 px-1.5 rounded bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs flex items-center gap-0.5 active:scale-95 shadow-sm"
              title="Add Goal and announce"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span className="font-athletic text-[10px]">Goal</span>
            </button>
          </div>

          {/* ASSIST CONTROLS */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-md border border-sky-500/20">
            <span className="text-[10px] font-athletic font-bold text-sky-400 uppercase tracking-wider px-1 flex items-center gap-0.5">
              <Award className="w-3 h-3 text-sky-400" /> A:
            </span>
            <div
              className={`w-7 text-center font-athletic font-black text-lg tabular-nums ${
                player.assists > 0 ? 'text-sky-400' : 'text-slate-600'
              }`}
            >
              {player.assists}
            </div>
            <button
              id={`btn-decrement-assist-${player.id}`}
              onClick={handleAssistMinus}
              disabled={player.assists === 0}
              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-20 text-slate-300 border border-slate-700 flex items-center justify-center text-xs"
              title="Minus 1 assist"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id={`btn-increment-assist-${player.id}`}
              onClick={handleAssistPlus}
              className="h-6 px-1.5 rounded bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 font-bold text-xs flex items-center gap-0.5 active:scale-95 shadow-sm"
              title="Add Assist and announce"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span className="font-athletic text-[10px]">Assist</span>
            </button>
          </div>

          {/* Connected Quick Action: Open Goal Action Center preselected */}
          {onConnectGoalAndAssist && (
            <button
              type="button"
              onClick={() => onConnectGoalAndAssist(player)}
              className="h-6 px-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-athletic font-bold uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95"
              title={`Connect Goal & Assist for #${player.number} ${player.name} in Goal Action Center`}
            >
              <Zap className="w-3 h-3 text-amber-400 fill-current" />
              <span className="hidden sm:inline">Connect</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // STANDARD SPLIT MODE (Goals or Assists Column), but with connected info and quick complementary button!
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
      {/* Player Identity (Jersey Number + Name + Connected stat note) */}
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

        {/* Player Name and Quick Actions */}
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1.5">
              <p className="text-xs sm:text-sm font-bold text-slate-100 truncate tracking-tight">
                {player.name}
              </p>
              {/* Connected Stat Pill: In Goals column shows Assists; in Assists column shows Goals */}
              <span
                className={`text-[10px] font-mono px-1 rounded ${
                  isGoal
                    ? player.assists > 0
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold'
                      : 'text-slate-500'
                    : player.goals > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                    : 'text-slate-500'
                }`}
                title={
                  isGoal
                    ? `${player.assists} assists connected (${totalPoints} total points)`
                    : `${player.goals} goals connected (${totalPoints} total points)`
                }
              >
                {isGoal ? `${player.assists}A · ${totalPoints}P` : `${player.goals}G · ${totalPoints}P`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate">
              {teamName} #{player.number}
            </p>
          </div>

          {/* If Lineup Attendance Edit Mode is active: Show prominent red Remove button */}
          {isLineupEditMode && onRemovePlayer && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePlayer(player);
              }}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 shrink-0 ml-1"
              title={`Remove #${player.number} ${player.name} from lineup (not present)`}
            >
              <UserMinus className="w-3 h-3 text-rose-400" />
              <span>Remove</span>
            </button>
          )}

          {/* Quick actions on hover when not in lineup edit mode */}
          {!isLineupEditMode && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {onRemovePlayer && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePlayer(player);
                  }}
                  className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  title={`Remove #${player.number} ${player.name} (not present)`}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
              {onScanSticker && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScanSticker(player);
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                  title={`Scan sticker to update #${player.number} ${player.name}`}
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Connected Quick Action + Big Counter & Action Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Quick Connected Cross-Link: In Goal Tracker, a quick "+ Assist" button; In Assist Tracker, a quick "+ Goal" button */}
        {isGoal && onConnectedAssistIncrement && (
          <button
            type="button"
            onClick={() => onConnectedAssistIncrement(player)}
            className="hidden sm:flex h-6 px-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[10px] font-athletic font-bold uppercase tracking-wider items-center gap-0.5 active:scale-95 transition-all"
            title={`Quick add Assist for #${player.number} (Connected to Assists Tracker)`}
          >
            <Plus className="w-2.5 h-2.5 stroke-[3]" />
            <span>Assist</span>
          </button>
        )}

        {!isGoal && onConnectedGoalIncrement && (
          <button
            type="button"
            onClick={() => onConnectedGoalIncrement(player)}
            className="hidden sm:flex h-6 px-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-athletic font-bold uppercase tracking-wider items-center gap-0.5 active:scale-95 transition-all"
            title={`Quick add Goal for #${player.number} (Connected to Goal Tracker)`}
          >
            <Plus className="w-2.5 h-2.5 stroke-[3]" />
            <span>Goal</span>
          </button>
        )}

        {/* Quick Connect button to open Goal Action Center preselected */}
        {onConnectGoalAndAssist && (
          <button
            type="button"
            onClick={() => onConnectGoalAndAssist(player)}
            className="p-1 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition-colors"
            title={`Connect Goal & Assist in Goal Action Center for #${player.number}`}
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Big Number Score Counter */}
        <div
          className={`w-10 sm:w-12 text-center font-athletic font-black text-2xl sm:text-3xl tabular-nums tracking-tighter transition-colors ${
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
