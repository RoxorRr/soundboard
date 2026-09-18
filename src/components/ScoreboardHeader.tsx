import React from 'react';
import { Volume2, VolumeX, RotateCcw, Users, RefreshCw, Radio, Sparkles, Camera } from 'lucide-react';
import { Announcement, VoiceStatus } from '../types';

interface ScoreboardHeaderProps {
  totalGoals: number;
  totalAssists: number;
  activeTeamName?: string;
  isVisitor?: boolean;
  currentAnnouncement: Announcement | null;
  isAnnouncing: boolean;
  voiceStatus: VoiceStatus | null;
  voiceFeedback?: { message: string; type: 'success' | 'warning' | 'info' } | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onReplayAnnouncement: () => void;
  onTestVoice: () => void;
  onOpenRosterModal: () => void;
  onOpenResetModal: () => void;
  onOpenScannerModal: () => void;
}

export const ScoreboardHeader: React.FC<ScoreboardHeaderProps> = ({
  totalGoals,
  totalAssists,
  activeTeamName = 'Pelham Pelicans',
  isVisitor = false,
  currentAnnouncement,
  isAnnouncing,
  voiceStatus,
  voiceFeedback,
  isMuted,
  onToggleMute,
  onReplayAnnouncement,
  onTestVoice,
  onOpenRosterModal,
  onOpenResetModal,
  onOpenScannerModal,
}) => {
  const teamInitials = isVisitor
    ? activeTeamName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase() || 'VT'
    : 'PP';

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-3 py-2 flex flex-col md:flex-row items-center justify-between gap-2 shrink-0 select-none shadow-md z-10">
      {/* Team Brand & Title */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div className="flex items-center gap-2.5">
          {/* Team Logo Badge */}
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg font-black text-xl tracking-tight border transition-colors ${
              isVisitor
                ? 'bg-gradient-to-br from-rose-500 via-rose-600 to-red-600 shadow-rose-500/20 text-white border-rose-400'
                : 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-amber-500/20 text-slate-950 border-amber-300'
            }`}
          >
            {teamInitials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-wide text-white uppercase font-athletic truncate max-w-[170px] sm:max-w-[240px]">
                {activeTeamName}
              </h1>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  isVisitor
                    ? 'bg-rose-400/20 text-rose-300 border-rose-400/30'
                    : 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                }`}
              >
                {isVisitor ? 'VISITOR' : '15 ROSTER'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Radio className={`w-3 h-3 ${isAnnouncing ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <span className="font-mono text-[11px]">
                  Voice: <strong className="text-slate-200">{voiceStatus?.voiceId || 'nhl'}</strong>
                </span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[11px] text-slate-400">
                {voiceStatus?.configured ? (
                  <span className="text-emerald-400 font-medium">ElevenLabs Active</span>
                ) : (
                  <span className="text-amber-400/90 font-medium" title="Configure ELEVENLABS_API_KEY for custom cloud voice">
                    ElevenLabs Ready (Local Voice Active)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Action icons for mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            id="mobile-scanner-btn"
            onClick={onOpenScannerModal}
            className="p-1.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center gap-1 text-xs"
            title="Scan Player Sticker"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            id="mobile-mute-toggle-btn"
            onClick={onToggleMute}
            className={`p-1.5 rounded-md border text-xs flex items-center gap-1 transition-colors ${
              isMuted
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          <button
            id="mobile-reset-btn"
            onClick={onOpenResetModal}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
            title="Reset Game"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Announcer Status Ticker */}
      <div className="flex-1 max-w-2xl w-full px-2 flex flex-col gap-1">
        <div
          className={`flex items-center justify-between px-3 py-1.5 rounded-lg border transition-all duration-300 ${
            isAnnouncing
              ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/10'
              : currentAnnouncement
              ? 'bg-slate-800/60 border-slate-700/60'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            {isAnnouncing ? (
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <p className="text-xs truncate text-slate-200 font-medium">
              {currentAnnouncement ? (
                <span>
                  <strong className="text-amber-400 font-bold uppercase tracking-wider text-[11px] mr-1.5">
                    {currentAnnouncement.type === 'goal' ? '🚨 GOAL ANNOUNCEMENT:' : '🏒 ASSIST ANNOUNCEMENT:'}
                  </strong>
                  &ldquo;{currentAnnouncement.text}&rdquo;
                </span>
              ) : (
                <span className="text-slate-500 italic">
                  Tap + on any player to score a Goal or log an Assist with live NHL voice audio...
                </span>
              )}
            </p>
          </div>

          {currentAnnouncement && (
            <button
              id="replay-announcement-btn"
              onClick={onReplayAnnouncement}
              disabled={isAnnouncing}
              className="shrink-0 text-[11px] px-2 py-0.5 rounded bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-600 flex items-center gap-1 transition-colors disabled:opacity-50"
              title="Replay announcement"
            >
              <RefreshCw className={`w-3 h-3 ${isAnnouncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Replay</span>
            </button>
          )}
        </div>

        {voiceFeedback && (
          <div
            className={`text-[11px] px-2.5 py-0.5 rounded border flex items-center justify-between transition-all ${
              voiceFeedback.type === 'success'
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                : voiceFeedback.type === 'warning'
                ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                : 'bg-blue-950/70 text-blue-300 border-blue-500/40'
            }`}
          >
            <span className="truncate">{voiceFeedback.message}</span>
            <span className="text-[10px] opacity-70 ml-2 shrink-0">audio engine</span>
          </div>
        )}
      </div>

      {/* Controls & Quick Stats */}
      <div className="hidden md:flex items-center gap-2">
        <button
          id="open-sticker-scanner-btn"
          onClick={onOpenScannerModal}
          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-400/20 hover:from-amber-500/30 hover:to-amber-400/30 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-amber-500/10 transition-all active:scale-95"
          title="Scan or upload sticker sheet file to fill all player slots"
        >
          <Camera className="w-3.5 h-3.5 text-amber-400" />
          <span>Scan Sticker File</span>
        </button>

        <button
          id="test-voice-btn"
          onClick={onTestVoice}
          disabled={isAnnouncing}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          title="Test ElevenLabs NHL voice audio"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Test Voice</span>
        </button>

        <button
          id="desktop-mute-toggle-btn"
          onClick={onToggleMute}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            isMuted
              ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
              : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Click to unmute sound' : 'Sound active'}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
              <span>Muted</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audio On</span>
            </>
          )}
        </button>

        <button
          id="open-roster-btn"
          onClick={onOpenRosterModal}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          title="Edit player numbers and names"
        >
          <Users className="w-3.5 h-3.5 text-sky-400" />
          <span>Roster (15)</span>
        </button>

        <button
          id="open-reset-btn"
          onClick={onOpenResetModal}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors hover:text-amber-300"
          title="Reset score counters"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </header>
  );
};

