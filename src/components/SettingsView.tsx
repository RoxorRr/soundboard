import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Camera,
  Users,
  RotateCcw,
  Radio,
  Edit2,
  Check,
  Award,
  Flame,
  Settings,
  Info,
} from 'lucide-react';
import { Announcement, VoiceStatus, Player } from '../types';

interface SettingsViewProps {
  homePlayers: Player[];
  visitorPlayers: Player[];
  visitorTeamName: string;
  onUpdateVisitorName: (name: string) => void;
  homeGoals: number;
  homeAssists: number;
  visitorGoals: number;
  visitorAssists: number;
  activeTeamTab: 'home' | 'visitor';
  onSelectTeamTab: (team: 'home' | 'visitor') => void;
  isMuted: boolean;
  onToggleMute: () => void;
  voiceStatus: VoiceStatus | null;
  voiceFeedback: { message: string; type: 'success' | 'warning' | 'info' } | null;
  currentAnnouncement: Announcement | null;
  isAnnouncing: boolean;
  onReplayAnnouncement: () => void;
  onTestVoice: () => void;
  onOpenRosterModal: (team?: 'home' | 'visitor') => void;
  onOpenScannerModal: (team?: 'home' | 'visitor') => void;
  onOpenResetModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  homePlayers,
  visitorPlayers,
  visitorTeamName,
  onUpdateVisitorName,
  homeGoals,
  homeAssists,
  visitorGoals,
  visitorAssists,
  activeTeamTab,
  onSelectTeamTab,
  isMuted,
  onToggleMute,
  voiceStatus,
  voiceFeedback,
  currentAnnouncement,
  isAnnouncing,
  onReplayAnnouncement,
  onTestVoice,
  onOpenRosterModal,
  onOpenScannerModal,
  onOpenResetModal,
}) => {
  const [isEditingVisitorName, setIsEditingVisitorName] = useState(false);
  const [tempVisitorName, setTempVisitorName] = useState(visitorTeamName);

  const handleSaveVisitorName = () => {
    if (tempVisitorName.trim()) {
      onUpdateVisitorName(tempVisitorName.trim());
    }
    setIsEditingVisitorName(false);
  };

  const visitorInitials =
    visitorTeamName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'VT';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6 custom-scrollbar select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300">
              <Settings className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white uppercase font-athletic tracking-wide">
                Settings & Team Controls
              </h1>
              <p className="text-xs text-slate-400">
                Manage logos, audio announcer, team rosters, and game scores
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
            <span>Score:</span>
            <strong className="text-amber-400">PELHAM {homeGoals}</strong>
            <span>-</span>
            <strong className="text-rose-400">{visitorGoals} {visitorInitials}</strong>
          </div>
        </div>

        {/* SECTION 1: Team Logos & Branding */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-athletic flex items-center gap-2">
            <span>Team Logos & Active Rosters</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pelham Pelicans Logo Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                activeTeamTab === 'home'
                  ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Pelham Logo Badge */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg font-black text-2xl tracking-tight border bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-amber-500/20 text-slate-950 border-amber-300 shrink-0">
                    PP
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white uppercase font-athletic tracking-wider">
                        Pelham Pelicans
                      </h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        {homePlayers.length} ROSTER
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Home Team • Primary Roster
                    </p>
                    <div className="flex items-center gap-3 text-xs mt-2 text-slate-300 font-mono">
                      <span className="flex items-center gap-1 text-amber-400">
                        <Flame className="w-3.5 h-3.5" />
                        <strong>{homeGoals}</strong> Goals
                      </span>
                      <span className="flex items-center gap-1 text-sky-400">
                        <Award className="w-3.5 h-3.5" />
                        <strong>{homeAssists}</strong> Assists
                      </span>
                    </div>
                  </div>
                </div>

                {activeTeamTab === 'home' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Selected
                  </span>
                )}
              </div>

              {/* Action Buttons for Pelham */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenRosterModal('home')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Roster ({homePlayers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenScannerModal('home')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  <span>Scan Sticker File</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTeamTab('home')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium ml-auto"
                >
                  Go to Tracker →
                </button>
              </div>
            </div>

            {/* Visitor Team Logo Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                activeTeamTab === 'visitor'
                  ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-500/10'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Visitor Logo Badge */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg font-black text-2xl tracking-tight border bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 shadow-rose-500/20 text-white border-rose-400 shrink-0">
                    {visitorInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isEditingVisitorName ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={tempVisitorName}
                            onChange={(e) => setTempVisitorName(e.target.value)}
                            className="bg-slate-800 text-white font-bold text-xs px-2 py-1 rounded border border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveVisitorName}
                            className="p-1 rounded bg-rose-500 text-white text-xs"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-base font-black text-white uppercase font-athletic tracking-wider truncate">
                            {visitorTeamName}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setTempVisitorName(visitorTeamName);
                              setIsEditingVisitorName(true);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-300"
                            title="Rename Visitor Team"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-400/20 text-rose-300 border border-rose-400/30 shrink-0">
                        {visitorPlayers.length} ROSTER
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Visiting Team • Opponent Roster
                    </p>
                    <div className="flex items-center gap-3 text-xs mt-2 text-slate-300 font-mono">
                      <span className="flex items-center gap-1 text-rose-400">
                        <Flame className="w-3.5 h-3.5" />
                        <strong>{visitorGoals}</strong> Goals
                      </span>
                      <span className="flex items-center gap-1 text-sky-400">
                        <Award className="w-3.5 h-3.5" />
                        <strong>{visitorAssists}</strong> Assists
                      </span>
                    </div>
                  </div>
                </div>

                {activeTeamTab === 'visitor' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Selected
                  </span>
                )}
              </div>

              {/* Action Buttons for Visitor */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenRosterModal('visitor')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-rose-400" />
                  <span>Edit Roster ({visitorPlayers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenScannerModal('visitor')}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-rose-400" />
                  <span>Scan Sticker File</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTeamTab('visitor')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium ml-auto"
                >
                  Go to Tracker →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Announcer Voice & Audio Settings */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-athletic flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>NHL Voice Announcer & Audio Output</span>
          </h2>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Audio Status & Speech Synthesis</h3>
                  {voiceStatus?.configured ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      ElevenLabs Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      Local Browser Voice Ready
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Plays professional play-by-play announcements when a Goal or Assist is recorded.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="settings-mute-toggle-btn"
                  onClick={onToggleMute}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    isMuted
                      ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-4 h-4 text-red-400" />
                      <span>Sound is Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span>Sound is ON</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="settings-test-voice-btn"
                  onClick={onTestVoice}
                  disabled={isAnnouncing}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAnnouncing ? 'Playing...' : 'Test Announcer Voice'}</span>
                </button>
              </div>
            </div>

            {/* Current / Recent Announcement display */}
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Latest Play Announcement:</span>
                </span>
                {currentAnnouncement && (
                  <button
                    type="button"
                    onClick={onReplayAnnouncement}
                    disabled={isAnnouncing}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isAnnouncing ? 'animate-spin' : ''}`} />
                    <span>Replay Announcement</span>
                  </button>
                )}
              </div>

              <div
                className={`p-3 rounded-lg border text-xs transition-all ${
                  isAnnouncing
                    ? 'bg-amber-950/40 border-amber-500/60 text-slate-100 shadow-md shadow-amber-500/10'
                    : currentAnnouncement
                    ? 'bg-slate-950 border-slate-800 text-slate-300'
                    : 'bg-slate-950/50 border-slate-800/80 text-slate-500 italic'
                }`}
              >
                {currentAnnouncement ? (
                  <div>
                    <span className="font-bold uppercase tracking-wider text-amber-400 mr-2">
                      {currentAnnouncement.type === 'goal' ? '🚨 GOAL CALL:' : '🏒 ASSIST CALL:'}
                    </span>
                    &ldquo;{currentAnnouncement.text}&rdquo;
                  </div>
                ) : (
                  <span>No announcement recorded yet. Tap + on any player to hear live voice audio.</span>
                )}
              </div>

              {voiceFeedback && (
                <div
                  className={`mt-2 text-xs px-3 py-1.5 rounded-lg border flex items-center justify-between ${
                    voiceFeedback.type === 'success'
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                      : voiceFeedback.type === 'warning'
                      ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                      : 'bg-blue-950/70 text-blue-300 border-blue-500/40'
                  }`}
                >
                  <span className="truncate">{voiceFeedback.message}</span>
                  <span className="text-[10px] opacity-70 ml-2 font-mono shrink-0">audio engine</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Game Reset & Match Management */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-athletic flex items-center gap-2">
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Match Reset & Data Management</span>
          </h2>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Reset Game Scoreboard</h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-md">
                Resets all goal and assist tallies back to 0 for both Pelham Pelicans and the Visiting team. Player names and numbers are retained.
              </p>
            </div>

            <button
              type="button"
              id="settings-reset-game-btn"
              onClick={onOpenResetModal}
              className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 hover:border-rose-400 font-bold text-xs flex items-center gap-2 transition-all shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Game Scores</span>
            </button>
          </div>
        </div>

        {/* System Info Note */}
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-500 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Rosters and custom team names automatically save to local browser storage. All 20 player slots are available on the tracker screen.
          </span>
        </div>
      </div>
    </div>
  );
};
