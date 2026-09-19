import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerTrackerRow } from './components/PlayerTrackerRow';
import { EditRosterModal } from './components/EditRosterModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { CameraStickerScannerModal } from './components/CameraStickerScannerModal';
import { SettingsView } from './components/SettingsView';
import { DEFAULT_PELHAM_PLAYERS, DEFAULT_VISITOR_PLAYERS } from './data/defaultPlayers';
import { Player, Announcement, VoiceStatus } from './types';
import { soundEngine, generateGoalPrompt, generateAssistPrompt } from './utils/audio';
import { Flame, Award, Edit2, Check, X, Shield, Sparkles, Settings, Volume2, VolumeX, Radio, RefreshCw } from 'lucide-react';

const HOME_STORAGE_KEY = 'pelham_pelicans_players_v2';
const VISITOR_STORAGE_KEY = 'pelham_visitor_players_v2';
const LEGACY_HOME_STORAGE_KEY = 'pelham_pelicans_players_v1';
const LEGACY_VISITOR_STORAGE_KEY = 'pelham_visitor_players_v1';
const VISITOR_NAME_KEY = 'pelham_visitor_team_name';

/** Helper to sort players ascending by their jersey numbers (smallest to largest) */
const sortPlayersByNumber = (list: Player[]): Player[] => {
  return [...list].sort((a, b) => a.number - b.number);
};

export default function App() {
  // Home (Pelham Pelicans) 20 players state with local persistence (sorted 1-99)
  const [homePlayers, setHomePlayers] = useState<Player[]>(() => {
    try {
      const savedV2 = localStorage.getItem(HOME_STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_PELHAM_PLAYERS.length) {
          return sortPlayersByNumber(parsed);
        }
      }
      // Migrate from v1 storage to preserve custom names & scores while adding the 5 new rows
      const savedV1 = localStorage.getItem(LEGACY_HOME_STORAGE_KEY);
      if (savedV1) {
        const parsedV1 = JSON.parse(savedV1);
        if (Array.isArray(parsedV1) && parsedV1.length > 0) {
          const existingIds = new Set(parsedV1.map((p: Player) => p.id));
          const newRows = DEFAULT_PELHAM_PLAYERS.filter((p) => !existingIds.has(p.id));
          const merged = [...parsedV1, ...newRows];
          if (merged.length === DEFAULT_PELHAM_PLAYERS.length) {
            return sortPlayersByNumber(merged);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved home players:', e);
    }
    return sortPlayersByNumber(DEFAULT_PELHAM_PLAYERS);
  });

  // Visitor 20 players state with local persistence (sorted 1-99)
  const [visitorPlayers, setVisitorPlayers] = useState<Player[]>(() => {
    try {
      const savedV2 = localStorage.getItem(VISITOR_STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_VISITOR_PLAYERS.length) {
          return sortPlayersByNumber(parsed);
        }
      }
      // Migrate from v1 storage to preserve custom names & scores while adding the 5 new rows
      const savedV1 = localStorage.getItem(LEGACY_VISITOR_STORAGE_KEY);
      if (savedV1) {
        const parsedV1 = JSON.parse(savedV1);
        if (Array.isArray(parsedV1) && parsedV1.length > 0) {
          const existingIds = new Set(parsedV1.map((p: Player) => p.id));
          const newRows = DEFAULT_VISITOR_PLAYERS.filter((p) => !existingIds.has(p.id));
          const merged = [...parsedV1, ...newRows];
          if (merged.length === DEFAULT_VISITOR_PLAYERS.length) {
            return sortPlayersByNumber(merged);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved visitor players:', e);
    }
    return sortPlayersByNumber(DEFAULT_VISITOR_PLAYERS);
  });

  // Visitor team name with local persistence
  const [visitorTeamName, setVisitorTeamName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(VISITOR_NAME_KEY);
      if (saved && saved.trim()) {
        return saved.trim();
      }
    } catch (e) {
      console.warn('Failed to load visitor team name:', e);
    }
    return 'Visiting Team';
  });

  // Active Team Tab ('home' = Pelham Pelicans | 'visitor' = Visitor Team)
  const [activeTeamTab, setActiveTeamTab] = useState<'home' | 'visitor'>('home');
  // Active Navigation Tab ('home' | 'visitor' | 'settings')
  const [currentTab, setCurrentTab] = useState<'home' | 'visitor' | 'settings'>('home');

  // Visitor team inline rename state
  const [isEditingVisitorName, setIsEditingVisitorName] = useState(false);
  const [tempVisitorName, setTempVisitorName] = useState(visitorTeamName);

  // UI and sound state
  const [isMuted, setIsMuted] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [activeAnnouncePlayerId, setActiveAnnouncePlayerId] = useState<string | null>(null);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<{
    message: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);

  // Auto-dismiss voice feedback after 6 seconds
  useEffect(() => {
    if (!voiceFeedback) return;
    const timer = setTimeout(() => {
      setVoiceFeedback(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [voiceFeedback]);

  // Modals state
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannerTargetPlayerId, setScannerTargetPlayerId] = useState<string | null>(null);

  // Mobile sub-tab state ('goals' | 'assists')
  const [mobileTab, setMobileTab] = useState<'goals' | 'assists'>('goals');

  // Sync home players to local storage
  useEffect(() => {
    try {
      localStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(homePlayers));
    } catch (e) {
      console.warn('Failed to persist home players:', e);
    }
  }, [homePlayers]);

  // Sync visitor players to local storage
  useEffect(() => {
    try {
      localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(visitorPlayers));
    } catch (e) {
      console.warn('Failed to persist visitor players:', e);
    }
  }, [visitorPlayers]);

  // Sync visitor team name to local storage
  useEffect(() => {
    try {
      localStorage.setItem(VISITOR_NAME_KEY, visitorTeamName);
    } catch (e) {
      console.warn('Failed to persist visitor team name:', e);
    }
  }, [visitorTeamName]);

  // Check voice status on mount
  useEffect(() => {
    fetch('/api/status')
      .then(async (res) => {
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return null;
        return res.json();
      })
      .then((data: VoiceStatus | null) => {
        if (data) setVoiceStatus(data);
      })
      .catch((err) => console.warn('Could not fetch server voice status:', err));
  }, []);

  // Auto-sort existing saved rosters from smallest to largest by player number on mount
  useEffect(() => {
    setHomePlayers((prev) => sortPlayersByNumber(prev));
    setVisitorPlayers((prev) => sortPlayersByNumber(prev));
  }, []);

  // Compute team totals
  const homeGoals = useMemo(() => homePlayers.reduce((sum, p) => sum + p.goals, 0), [homePlayers]);
  const homeAssists = useMemo(() => homePlayers.reduce((sum, p) => sum + p.assists, 0), [homePlayers]);
  const visitorGoals = useMemo(() => visitorPlayers.reduce((sum, p) => sum + p.goals, 0), [visitorPlayers]);
  const visitorAssists = useMemo(() => visitorPlayers.reduce((sum, p) => sum + p.assists, 0), [visitorPlayers]);

  const isVisitor = activeTeamTab === 'visitor';
  const activePlayers = useMemo(() => {
    const list = isVisitor ? visitorPlayers : homePlayers;
    return sortPlayersByNumber(list);
  }, [isVisitor, visitorPlayers, homePlayers]);
  const activeTeamName = isVisitor ? visitorTeamName : 'Pelham Pelicans';
  const activeGoals = isVisitor ? visitorGoals : homeGoals;
  const activeAssists = isVisitor ? visitorAssists : homeAssists;

  // Handle Goal Trigger
  const handleGoalIncrement = useCallback(async (player: Player) => {
    soundEngine.unlock();

    const isCurrentVisitor = activeTeamTab === 'visitor';
    const currentTeam = isCurrentVisitor ? (visitorTeamName.trim() || 'Visiting Team') : 'Pelham Pelicans';

    // 1. Instantly update score for active team
    if (isCurrentVisitor) {
      setVisitorPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, goals: p.goals + 1 } : p))
      );
    } else {
      setHomePlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, goals: p.goals + 1 } : p))
      );
    }

    // 2. Audio prompt with team name: e.g. "Pelham Pelicans goal! Scored by..." or "Grimsby Kings goal! Scored by..."
    const prompt = generateGoalPrompt(player.number, player.name, currentTeam);

    const announcement: Announcement = {
      id: `${Date.now()}-${player.id}`,
      type: 'goal',
      playerId: player.id,
      playerNumber: player.number,
      playerName: player.name,
      text: prompt,
      timestamp: Date.now(),
      source: voiceStatus?.configured ? 'elevenlabs' : 'webspeech',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(player.id);

    try {
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source } : prev));
      }
      if (res.error) {
        setVoiceFeedback({
          message: `Voice notice: ${res.error}`,
          type: 'warning'
        });
      }
    } catch (err: any) {
      console.error('Goal announcement error:', err);
      setVoiceFeedback({
        message: err?.message || 'Goal announcement failed',
        type: 'warning'
      });
    } finally {
      setIsAnnouncing(false);
      setActiveAnnouncePlayerId(null);
    }
  }, [activeTeamTab, visitorTeamName, voiceStatus?.configured]);

  // Handle Goal Decrement (correction)
  const handleGoalDecrement = useCallback((player: Player) => {
    if (activeTeamTab === 'visitor') {
      setVisitorPlayers((prev) =>
        prev.map((p) => (p.id === player.id && p.goals > 0 ? { ...p, goals: p.goals - 1 } : p))
      );
    } else {
      setHomePlayers((prev) =>
        prev.map((p) => (p.id === player.id && p.goals > 0 ? { ...p, goals: p.goals - 1 } : p))
      );
    }
  }, [activeTeamTab]);

  // Handle Assist Trigger
  const handleAssistIncrement = useCallback(async (player: Player) => {
    soundEngine.unlock();

    if (activeTeamTab === 'visitor') {
      setVisitorPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, assists: p.assists + 1 } : p))
      );
    } else {
      setHomePlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, assists: p.assists + 1 } : p))
      );
    }

    const prompt = generateAssistPrompt(player.number, player.name);

    const announcement: Announcement = {
      id: `${Date.now()}-${player.id}`,
      type: 'assist',
      playerId: player.id,
      playerNumber: player.number,
      playerName: player.name,
      text: prompt,
      timestamp: Date.now(),
      source: voiceStatus?.configured ? 'elevenlabs' : 'webspeech',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(player.id);

    try {
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source } : prev));
      }
      if (res.error) {
        setVoiceFeedback({
          message: `Voice notice: ${res.error}`,
          type: 'warning'
        });
      }
    } catch (err: any) {
      console.error('Assist announcement error:', err);
      setVoiceFeedback({
        message: err?.message || 'Assist announcement failed',
        type: 'warning'
      });
    } finally {
      setIsAnnouncing(false);
      setActiveAnnouncePlayerId(null);
    }
  }, [activeTeamTab, voiceStatus?.configured]);

  // Handle Assist Decrement (correction)
  const handleAssistDecrement = useCallback((player: Player) => {
    if (activeTeamTab === 'visitor') {
      setVisitorPlayers((prev) =>
        prev.map((p) => (p.id === player.id && p.assists > 0 ? { ...p, assists: p.assists - 1 } : p))
      );
    } else {
      setHomePlayers((prev) =>
        prev.map((p) => (p.id === player.id && p.assists > 0 ? { ...p, assists: p.assists - 1 } : p))
      );
    }
  }, [activeTeamTab]);

  // Replay current announcement
  const handleReplayAnnouncement = useCallback(async () => {
    if (!currentAnnouncement || isAnnouncing) return;
    soundEngine.unlock();
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(currentAnnouncement.playerId);
    try {
      const res = await soundEngine.announce(currentAnnouncement.text, 'nhl');
      if (res.error) {
        setVoiceFeedback({
          message: `Voice notice: ${res.error}`,
          type: 'warning'
        });
      }
    } catch (err: any) {
      setVoiceFeedback({
        message: err?.message || 'Replay failed',
        type: 'warning'
      });
    } finally {
      setIsAnnouncing(false);
      setActiveAnnouncePlayerId(null);
    }
  }, [currentAnnouncement, isAnnouncing]);

  // Quick Test Voice with active team name & first player
  const handleTestVoice = useCallback(async () => {
    soundEngine.unlock();
    const currentList = activeTeamTab === 'visitor' ? visitorPlayers : homePlayers;
    const testPlayer = currentList[0] || { number: 12, name: 'Player 1', id: 'test' };
    const prompt = generateGoalPrompt(testPlayer.number, testPlayer.name, activeTeamName);

    const announcement: Announcement = {
      id: `test-${Date.now()}`,
      type: 'goal',
      playerId: testPlayer.id,
      playerNumber: testPlayer.number,
      playerName: testPlayer.name,
      text: prompt,
      timestamp: Date.now(),
      source: voiceStatus?.configured ? 'elevenlabs' : 'webspeech',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(testPlayer.id);

    try {
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source } : prev));
      }
      if (res.error) {
        setVoiceFeedback({
          message: `Voice Notice: ${res.error}`,
          type: 'warning'
        });
      } else if (res.source === 'elevenlabs') {
        setVoiceFeedback({
          message: `ElevenLabs voice playing (${res.voiceId || 'announcer'})`,
          type: 'success'
        });
      } else {
        setVoiceFeedback({
          message: 'Local browser voice playing',
          type: 'info'
        });
      }
    } catch (err: any) {
      setVoiceFeedback({
        message: err?.message || 'Voice test failed',
        type: 'warning'
      });
    } finally {
      setIsAnnouncing(false);
      setActiveAnnouncePlayerId(null);
    }
  }, [activeTeamTab, visitorPlayers, homePlayers, activeTeamName, voiceStatus?.configured]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Reset scores for both teams
  const handleResetScores = useCallback(() => {
    setHomePlayers((prev) =>
      prev.map((p) => ({
        ...p,
        goals: 0,
        assists: 0,
      }))
    );
    setVisitorPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        goals: 0,
        assists: 0,
      }))
    );
    setCurrentAnnouncement(null);
    soundEngine.stopAll();
  }, []);

  const handleSaveRoster = useCallback((updated: Player[]) => {
    const sorted = sortPlayersByNumber(updated);
    if (activeTeamTab === 'visitor') {
      setVisitorPlayers(sorted);
    } else {
      setHomePlayers(sorted);
    }
  }, [activeTeamTab]);

  const handleOpenScanner = useCallback((playerId?: string) => {
    setScannerTargetPlayerId(playerId || null);
    setIsScannerModalOpen(true);
  }, []);

  const handleUpdatePlayerFromSticker = useCallback((playerId: string, newNumber: number, newName: string) => {
    if (activeTeamTab === 'visitor') {
      setVisitorPlayers((prev) =>
        sortPlayersByNumber(
          prev.map((p) => (p.id === playerId ? { ...p, number: newNumber, name: newName } : p))
        )
      );
    } else {
      setHomePlayers((prev) =>
        sortPlayersByNumber(
          prev.map((p) => (p.id === playerId ? { ...p, number: newNumber, name: newName } : p))
        )
      );
    }
  }, [activeTeamTab]);

  const handleSaveAllPlayersFromSticker = useCallback((updatedPlayers: Player[]) => {
    const sorted = sortPlayersByNumber(updatedPlayers);
    if (activeTeamTab === 'visitor') {
      setVisitorPlayers(sorted);
    } else {
      setHomePlayers(sorted);
    }
  }, [activeTeamTab]);

  // Save visitor team name from inline editor
  const handleSaveVisitorName = useCallback(() => {
    if (tempVisitorName.trim()) {
      setVisitorTeamName(tempVisitorName.trim());
    }
    setIsEditingVisitorName(false);
  }, [tempVisitorName]);

  return (
    <div className="h-screen max-h-screen w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Clean & Compact Navigation Bar with Team Tabs and Settings */}
      <nav
        aria-label="Main Navigation"
        className="bg-slate-900 border-b border-slate-800 px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 select-none shadow-sm"
      >
        {/* Left: Team Tabs & Settings Tab */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* TAB 1: Pelham Pelicans */}
          <button
            id="tab-home-pelham"
            onClick={() => {
              setActiveTeamTab('home');
              setCurrentTab('home');
            }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-athletic uppercase tracking-wider font-black flex items-center gap-1.5 sm:gap-2 transition-all ${
              currentTab === 'home'
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-300'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <span
              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                currentTab === 'home' ? 'bg-slate-950/25 text-slate-950' : 'bg-amber-400/20 text-amber-300'
              }`}
            >
              PP
            </span>
            <span className="hidden xs:inline sm:inline">Pelham Pelicans</span>
            <span className="xs:hidden sm:hidden inline">Pelham</span>
            <span
              className={`ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                currentTab === 'home' ? 'bg-slate-950 text-amber-400' : 'bg-slate-950/60 text-slate-300'
              }`}
            >
              {homeGoals}
            </span>
          </button>

          {/* TAB 2: Visitor Team */}
          <button
            id="tab-visitor-team"
            onClick={() => {
              setActiveTeamTab('visitor');
              setCurrentTab('visitor');
            }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-athletic uppercase tracking-wider font-black flex items-center gap-1.5 sm:gap-2 transition-all ${
              currentTab === 'visitor'
                ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/20 ring-1 ring-rose-300'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <span
              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                currentTab === 'visitor' ? 'bg-black/25 text-white' : 'bg-rose-400/20 text-rose-300'
              }`}
            >
              VT
            </span>
            <span className="truncate max-w-[90px] sm:max-w-[170px]">
              {visitorTeamName}
            </span>
            <span
              className={`ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                currentTab === 'visitor' ? 'bg-slate-950 text-rose-400' : 'bg-slate-950/60 text-slate-300'
              }`}
            >
              {visitorGoals}
            </span>
          </button>

          {/* TAB 3: Settings Tab */}
          <button
            id="tab-settings"
            onClick={() => setCurrentTab('settings')}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-athletic uppercase tracking-wider font-black flex items-center gap-1.5 sm:gap-2 transition-all ${
              currentTab === 'settings'
                ? 'bg-slate-100 text-slate-950 shadow-md shadow-white/10 ring-1 ring-slate-200'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
            }`}
          >
            <Settings className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${currentTab === 'settings' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Settings</span>
          </button>
        </div>

        {/* Right: Quick Controls on Nav */}
        <div className="flex items-center gap-2">
          {/* Announcement Snippet Pill (shown when not in settings and announcement exists) */}
          {currentAnnouncement && currentTab !== 'settings' && (
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs max-w-[240px] xl:max-w-xs truncate transition-all ${
                isAnnouncing
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-950/90 border-slate-800 text-slate-300'
              }`}
            >
              <Radio className={`w-3 h-3 shrink-0 ${isAnnouncing ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="truncate text-[11px] font-medium">&ldquo;{currentAnnouncement.text}&rdquo;</span>
              <button
                onClick={handleReplayAnnouncement}
                disabled={isAnnouncing}
                className="ml-1 p-0.5 rounded hover:bg-slate-800 hover:text-white text-slate-400 shrink-0 transition-colors"
                title="Replay Announcement"
              >
                <RefreshCw className={`w-3 h-3 ${isAnnouncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* Quick Mute/Unmute toggle */}
          <button
            id="nav-mute-toggle-btn"
            onClick={handleToggleMute}
            className={`p-1.5 sm:px-2 sm:py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isMuted
                ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
            title={isMuted ? 'Audio Muted - Click to Unmute' : 'Audio Active - Click to Mute'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="hidden xl:inline text-[11px]">Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden xl:inline text-[11px]">Sound On</span>
              </>
            )}
          </button>

          {/* Live Match Scoreboard Pill */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs shrink-0">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Score:</span>
            <span className="font-athletic font-bold text-amber-400">PELHAM {homeGoals}</span>
            <span className="text-slate-600 font-bold">-</span>
            <span className="font-athletic font-bold text-rose-400">{visitorGoals} {visitorTeamName.toUpperCase()}</span>
          </div>
        </div>
      </nav>

      {/* Conditionally Render Settings Tab OR Arena Tracker */}
      {currentTab === 'settings' ? (
        <SettingsView
          homePlayers={homePlayers}
          visitorPlayers={visitorPlayers}
          visitorTeamName={visitorTeamName}
          onUpdateVisitorName={setVisitorTeamName}
          homeGoals={homeGoals}
          homeAssists={homeAssists}
          visitorGoals={visitorGoals}
          visitorAssists={visitorAssists}
          activeTeamTab={activeTeamTab}
          onSelectTeamTab={(team) => {
            setActiveTeamTab(team);
            setCurrentTab(team);
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          voiceStatus={voiceStatus}
          voiceFeedback={voiceFeedback}
          currentAnnouncement={currentAnnouncement}
          isAnnouncing={isAnnouncing}
          onReplayAnnouncement={handleReplayAnnouncement}
          onTestVoice={handleTestVoice}
          onOpenRosterModal={(team) => {
            if (team) setActiveTeamTab(team);
            setIsRosterModalOpen(true);
          }}
          onOpenScannerModal={(team) => {
            if (team) setActiveTeamTab(team);
            handleOpenScanner();
          }}
          onOpenResetModal={() => setIsResetModalOpen(true)}
        />
      ) : (
        <>
          {/* Visitor Team Editable Banner (Shown when Visitor Tab is active) */}
          {isVisitor && (
            <div className="bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-slate-950/90 border-b border-rose-500/30 px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider font-athletic shrink-0">
                  Visitor Team:
                </span>

                {isEditingVisitorName ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveVisitorName();
                    }}
                    className="flex items-center gap-1.5 flex-1 max-w-sm"
                  >
                    <input
                      type="text"
                      value={tempVisitorName}
                      onChange={(e) => setTempVisitorName(e.target.value)}
                      placeholder="e.g. Grimsby Kings, Thorold Blackhawks"
                      className="bg-slate-800 text-white font-bold text-xs sm:text-sm px-2.5 py-1 rounded-md border border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 w-full"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempVisitorName(visitorTeamName);
                        setIsEditingVisitorName(false);
                      }}
                      className="px-2 py-1 rounded-md bg-slate-800 text-slate-400 hover:text-white text-xs shrink-0 transition-colors"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm sm:text-base font-black text-white uppercase font-athletic tracking-wide truncate">
                      {visitorTeamName}
                    </span>
                    <button
                      onClick={() => {
                        setTempVisitorName(visitorTeamName);
                        setIsEditingVisitorName(true);
                      }}
                      className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-300 flex items-center gap-1 text-xs transition-colors"
                      title="Edit visitor team name"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium hidden sm:inline">Rename</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3 h-3 text-rose-400" />
                <span>Audio Announcement:</span>
                <span className="text-rose-300 font-medium">
                  &ldquo;{visitorTeamName} goal! Scored by...&rdquo;
                </span>
              </div>
            </div>
          )}

          {/* Mobile Sub-Tab Switcher (Goals vs Assists on mobile) */}
          <div className="lg:hidden flex border-b border-slate-800 bg-slate-900/95 shrink-0 px-2 py-1.5 gap-2">
            <button
              onClick={() => setMobileTab('goals')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                mobileTab === 'goals'
                  ? isVisitor
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>GOALS ({activeGoals})</span>
            </button>
            <button
              onClick={() => setMobileTab('assists')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                mobileTab === 'assists'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>ASSISTS ({activeAssists})</span>
            </button>
          </div>

      {/* Main Fit-to-Screen Arena Split Board */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
        {/* LEFT SIDE: GOALS TRACKER */}
        <section
          id="goals-column"
          className={`flex flex-col min-h-0 h-full p-2 sm:p-3 bg-gradient-to-b from-slate-900/60 to-slate-950/90 ${
            mobileTab === 'assists' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Section Header with Big Goal Total */}
          <div
            className={`flex items-center justify-between pb-2 mb-1.5 border-b px-1 shrink-0 ${
              isVisitor ? 'border-rose-500/20' : 'border-amber-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center border ${
                  isVisitor
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                }`}
              >
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h2
                  className={`text-sm sm:text-base font-black tracking-wider uppercase font-athletic flex items-center gap-1.5 ${
                    isVisitor ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  Goals Tracker
                  <span className="text-[10px] font-normal text-slate-400 lowercase tracking-normal">
                    ({activeTeamName} • {activePlayers.length} players)
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400">
                  Audio: &ldquo;{activeTeamName} goal! Scored by...&rdquo;
                </p>
              </div>
            </div>

            {/* Big Team Goals Scoreboard */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                Team Total:
              </span>
              <div
                className={`bg-slate-950 px-3 py-0.5 rounded-lg border shadow-inner flex items-center justify-center min-w-[56px] ${
                  isVisitor ? 'border-rose-500/40' : 'border-amber-500/40'
                }`}
              >
                <span
                  className={`font-athletic font-black text-2xl sm:text-3xl tabular-nums ${
                    isVisitor ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {activeGoals}
                </span>
              </div>
            </div>
          </div>

          {/* Player Rows for Goals - Engineered to fit on screen */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 sm:space-y-1.5 pr-0.5 custom-scrollbar">
            {activePlayers.map((player, idx) => (
              <PlayerTrackerRow
                key={player.id}
                player={player}
                index={idx}
                mode="goals"
                teamName={activeTeamName}
                isActiveAnnouncing={isAnnouncing && activeAnnouncePlayerId === player.id}
                onIncrement={handleGoalIncrement}
                onDecrement={handleGoalDecrement}
                onScanSticker={(p) => handleOpenScanner(p.id)}
              />
            ))}
          </div>
        </section>

        {/* RIGHT SIDE: ASSISTS TRACKER */}
        <section
          id="assists-column"
          className={`flex flex-col min-h-0 h-full p-2 sm:p-3 bg-gradient-to-b from-slate-900/60 to-slate-950/90 ${
            mobileTab === 'goals' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Section Header with Big Assist Total */}
          <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-sky-500/20 px-1 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black tracking-wider text-sky-400 uppercase font-athletic flex items-center gap-1.5">
                  Assists Tracker
                  <span className="text-[10px] font-normal text-slate-400 lowercase tracking-normal">
                    ({activeTeamName} • {activePlayers.length} players)
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400">
                  Audio: &ldquo;Assisted by number...&rdquo;
                </p>
              </div>
            </div>

            {/* Big Team Assists Scoreboard */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                Team Total:
              </span>
              <div className="bg-slate-950 px-3 py-0.5 rounded-lg border border-sky-500/40 shadow-inner flex items-center justify-center min-w-[56px]">
                <span className="font-athletic font-black text-2xl sm:text-3xl text-sky-400 tabular-nums">
                  {activeAssists}
                </span>
              </div>
            </div>
          </div>

          {/* Player Rows for Assists - Engineered to fit on screen */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 sm:space-y-1.5 pr-0.5 custom-scrollbar">
            {activePlayers.map((player, idx) => (
              <PlayerTrackerRow
                key={player.id}
                player={player}
                index={idx}
                mode="assists"
                teamName={activeTeamName}
                isActiveAnnouncing={isAnnouncing && activeAnnouncePlayerId === player.id}
                onIncrement={handleAssistIncrement}
                onDecrement={handleAssistDecrement}
                onScanSticker={(p) => handleOpenScanner(p.id)}
              />
            ))}
          </div>
        </section>
      </main>
        </>
      )}

      {/* Roster Modal */}
      <EditRosterModal
        isOpen={isRosterModalOpen}
        players={activePlayers}
        teamName={activeTeamName}
        isVisitor={isVisitor}
        onClose={() => setIsRosterModalOpen(false)}
        onSave={handleSaveRoster}
        onUpdateTeamName={setVisitorTeamName}
        onOpenScanner={handleOpenScanner}
      />

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        visitorTeamName={visitorTeamName}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetScores}
      />

      {/* Camera Sticker Scanner Modal */}
      <CameraStickerScannerModal
        isOpen={isScannerModalOpen}
        players={activePlayers}
        teamName={activeTeamName}
        selectedPlayerId={scannerTargetPlayerId}
        onClose={() => setIsScannerModalOpen(false)}
        onUpdatePlayer={handleUpdatePlayerFromSticker}
        onUpdateAllPlayers={handleSaveAllPlayersFromSticker}
      />
    </div>
  );
}
