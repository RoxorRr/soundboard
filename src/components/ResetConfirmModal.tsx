import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  visitorTeamName?: string;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  visitorTeamName = 'Visitor Team',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1 font-athletic uppercase tracking-wider">
            Reset Game Stats?
          </h3>
          <p className="text-xs text-slate-400">
            This will reset all goals and assists for both Pelham Pelicans and {visitorTeamName} back to zero. Player rosters, names, and numbers remain untouched.
          </p>
        </div>

        <div className="bg-slate-950/60 px-4 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Confirm Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
