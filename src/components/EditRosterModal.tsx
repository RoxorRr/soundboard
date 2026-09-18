import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Check, Users, Camera, Sparkles, Layers, Edit3 } from 'lucide-react';
import { Player } from '../types';
import { DEFAULT_PELHAM_PLAYERS, DEFAULT_VISITOR_PLAYERS } from '../data/defaultPlayers';

interface EditRosterModalProps {
  isOpen: boolean;
  players: Player[];
  teamName?: string;
  isVisitor?: boolean;
  onClose: () => void;
  onSave: (updatedPlayers: Player[]) => void;
  onUpdateTeamName?: (newName: string) => void;
  onOpenScanner?: (playerId?: string) => void;
}

export const EditRosterModal: React.FC<EditRosterModalProps> = ({
  isOpen,
  players,
  teamName = 'Pelham Pelicans',
  isVisitor = false,
  onClose,
  onSave,
  onUpdateTeamName,
  onOpenScanner,
}) => {
  const [editedList, setEditedList] = useState<Player[]>(players);
  const [currentTeamName, setCurrentTeamName] = useState<string>(teamName);

  // Sync with prop whenever it opens
  useEffect(() => {
    setEditedList(players);
    setCurrentTeamName(teamName);
  }, [players, teamName, isOpen]);

  if (!isOpen) return null;

  const handleChange = (id: string, field: 'name' | 'number', value: string) => {
    setEditedList((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === 'number') {
          const num = parseInt(value, 10);
          return { ...p, number: isNaN(num) ? 0 : num };
        }
        return { ...p, name: value };
      })
    );
  };

  const handleResetToDefault = () => {
    const defaultSource = isVisitor ? DEFAULT_VISITOR_PLAYERS : DEFAULT_PELHAM_PLAYERS;
    setEditedList(
      defaultSource.map((def, idx) => ({
        ...def,
        goals: players[idx]?.goals ?? 0,
        assists: players[idx]?.assists ?? 0,
      }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isVisitor && onUpdateTeamName && currentTeamName.trim()) {
      onUpdateTeamName(currentTeamName.trim());
    }
    onSave(editedList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Users className={`w-5 h-5 ${isVisitor ? 'text-rose-400' : 'text-amber-400'}`} />
            <div>
              <h2 className="text-base font-bold text-white font-athletic uppercase tracking-wider">
                Edit 15-Player Roster
              </h2>
              <p className="text-[11px] text-slate-400">
                {currentTeamName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Player List */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* If Visitor Team: Editable Team Name field */}
          {isVisitor && (
            <div className="bg-slate-950/80 p-3 rounded-xl border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <label className="text-xs font-bold text-rose-300 block">
                    Visitor Team Name:
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Used in live voice audio announcements (e.g. &ldquo;[Team Name] goal!&rdquo;)
                  </span>
                </div>
              </div>
              <input
                type="text"
                value={currentTeamName}
                onChange={(e) => setCurrentTeamName(e.target.value)}
                placeholder="e.g. Grimsby Kings, Thorold Blackhawks"
                className="w-full sm:w-64 bg-slate-800 text-slate-100 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-400"
                required
              />
            </div>
          )}

          {/* Quick Import from Sticker File Banner */}
          {onOpenScanner && (
            <div className={`bg-gradient-to-r ${isVisitor ? 'from-rose-500/15 via-rose-400/10' : 'from-amber-500/15 via-amber-400/10'} to-transparent p-3 rounded-xl border ${isVisitor ? 'border-rose-500/30' : 'border-amber-500/30'} flex items-center justify-between gap-2.5`}>
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${isVisitor ? 'text-rose-400' : 'text-amber-400'} shrink-0`} />
                <div>
                  <p className={`text-xs font-bold ${isVisitor ? 'text-rose-300' : 'text-amber-300'} flex items-center gap-1.5`}>
                    <span>Scan Sticker File into All 15 Slots</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Upload or snap a sticker sheet to automatically populate all player names and numbers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenScanner();
                }}
                className={`shrink-0 px-3 py-1.5 rounded-lg ${isVisitor ? 'bg-rose-500 hover:bg-rose-400 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'} text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Scan Sticker File</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-400">
              Customize any of the 15 players or use the camera icon on individual slots:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {editedList.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800 focus-within:border-amber-500/60"
              >
                <span className="text-[11px] font-mono text-slate-500 w-4 text-right">
                  {idx + 1}.
                </span>
                <div className="w-14">
                  <label className="text-[9px] uppercase font-bold text-slate-400 block">Number</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={player.number}
                    onChange={(e) => handleChange(player.id, 'number', e.target.value)}
                    className="w-full bg-slate-800 text-slate-100 font-athletic font-bold px-2 py-1 rounded text-sm border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[9px] uppercase font-bold text-slate-400 block">Player Name</label>
                  <input
                    type="text"
                    value={player.name}
                    onChange={(e) => handleChange(player.id, 'name', e.target.value)}
                    className="w-full bg-slate-800 text-slate-100 font-semibold px-2 py-1 rounded text-sm border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="Player Name"
                    required
                  />
                </div>
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      onSave(editedList);
                      onClose();
                      onOpenScanner(player.id);
                    }}
                    className="self-end mb-0.5 p-1.5 rounded-md bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-700 transition-colors"
                    title={`Scan sticker with camera for #${player.number} ${player.name}`}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-800 mt-4">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isVisitor ? 'Reset to Visitor Defaults' : 'Reset to Pelham Defaults'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-1.5 rounded-lg ${isVisitor ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'} font-bold text-xs flex items-center gap-1.5 shadow-md transition-all`}
              >
                <Check className="w-4 h-4" />
                <span>Save Roster</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
