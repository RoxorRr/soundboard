import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PlayerTrackerRow } from './components/PlayerTrackerRow';
import { EditRosterModal } from './components/EditRosterModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { CameraStickerScannerModal } from './components/CameraStickerScannerModal';
import { QuickGoalModal } from './components/QuickGoalModal';
import { PenaltyModal } from './components/PenaltyModal';
import { ArenaConsoleModal, ConsoleTab } from './components/ArenaConsoleModal';
import { ArenaMixerModal } from './components/ArenaMixerModal';
import { InlineGoalScorer } from './components/InlineGoalScorer';
import { TeamActionModal } from './components/TeamActionModal';
import { SettingsView } from './components/SettingsView';
import { DEFAULT_PELHAM_PLAYERS, DEFAULT_VISITOR_PLAYERS } from './data/defaultPlayers';
import { Player, Announcement, VoiceStatus } from './types';
import { soundEngine, generateGoalPrompt, generateAssistPrompt, generateGoalWithAssistPrompt, generateWelcomePrompt, generatePeriodRemainingPrompt } from './utils/audio';
import { Flame, Award, Edit2, Check, X, Shield, ShieldAlert, Sparkles, Settings, Volume2, VolumeX, Radio, RefreshCw, Maximize, Minimize, UserMinus, UserPlus, Users, Undo2, Camera, Hash, Clock, Sliders, Zap, Music, Square, Play, ChevronDown, Menu } from 'lucide-react';

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
  const appContainerRef = useRef<HTMLDivElement>(null);

  // Fullscreen mode state and handler
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Keep window scroll strictly pinned to 0,0 so scrolling inside containers never scrolls the outer window
    // which in browsers like Chrome, Edge, and Safari triggers an exit from fullscreen mode
    const preventWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('scroll', preventWindowScroll, { passive: true });

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('scroll', preventWindowScroll);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isCurrentlyFullscreen) {
        // Target appContainerRef first so the document stays completely fixed and isolated
        const elem = appContainerRef.current || document.documentElement;
        const requestFn =
          elem.requestFullscreen ||
          (elem as any).webkitRequestFullscreen ||
          (elem as any).mozRequestFullScreen ||
          (elem as any).msRequestFullscreen;

        if (requestFn) {
          try {
            await requestFn.call(elem, { navigationUI: 'hide' });
          } catch {
            await requestFn.call(elem);
          }
        }
      } else {
        const exitFn =
          document.exitFullscreen ||
          (document as any).webkitExitFullscreen ||
          (document as any).mozCancelFullScreen ||
          (document as any).msExitFullscreen;

        if (exitFn) {
          await exitFn.call(document);
        }
      }
    } catch (err: any) {
      console.warn('Fullscreen toggle failed:', err);
      setVoiceFeedback({
        message: 'Fullscreen may be restricted in embedded frames. Open the app in a new browser tab for complete fullscreen.',
        type: 'info',
      });
    }
  }, []);

  // Home (Pelham Pelicans) players state with local persistence (sorted 1-99, supports any roster count)
  const [homePlayers, setHomePlayers] = useState<Player[]>(() => {
    try {
      const savedV2 = localStorage.getItem(HOME_STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
          if (merged.length > 0) {
            return sortPlayersByNumber(merged);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved home players:', e);
    }
    return sortPlayersByNumber(DEFAULT_PELHAM_PLAYERS);
  });

  // Helper to migrate legacy visitor player names ("Visitor Player X" -> "Player Number X")
  const migrateVisitorPlayerName = (name: string, fallbackIdx?: number): string => {
    const match = name.match(/^visitor\s*player\s*(\d+)$/i);
    if (match) {
      return `Player Number ${match[1]}`;
    }
    if (name.toLowerCase() === 'visitor player') {
      return `Player Number ${fallbackIdx !== undefined ? fallbackIdx + 1 : 1}`;
    }
    return name;
  };

  // Visitor players state with local persistence (sorted 1-99, supports any roster count)
  const [visitorPlayers, setVisitorPlayers] = useState<Player[]>(() => {
    try {
      const savedV2 = localStorage.getItem(VISITOR_STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map((p: Player, idx: number) => ({
            ...p,
            name: migrateVisitorPlayerName(p.name, idx),
          }));
          return sortPlayersByNumber(migrated);
        }
      }
      // Migrate from v1 storage to preserve custom names & scores while adding the 5 new rows
      const savedV1 = localStorage.getItem(LEGACY_VISITOR_STORAGE_KEY);
      if (savedV1) {
        const parsedV1 = JSON.parse(savedV1);
        if (Array.isArray(parsedV1) && parsedV1.length > 0) {
          const existingIds = new Set(parsedV1.map((p: Player) => p.id));
          const newRows = DEFAULT_VISITOR_PLAYERS.filter((p) => !existingIds.has(p.id));
          const merged = [...parsedV1, ...newRows].map((p: Player, idx: number) => ({
            ...p,
            name: migrateVisitorPlayerName(p.name, idx),
          }));
          if (merged.length > 0) {
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
  const [isQuickGoalModalOpen, setIsQuickGoalModalOpen] = useState(false);
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);

  // Single Window Arena Announcer Console State ('goal' | 'penalty' | 'period' | 'speaker')
  const [isConsoleModalOpen, setIsConsoleModalOpen] = useState(false);
  const [consoleActiveTab, setConsoleActiveTab] = useState<ConsoleTab>('goal');

  const openConsole = useCallback((tab: ConsoleTab = 'goal') => {
    setConsoleActiveTab(tab);
    setIsConsoleModalOpen(true);
  }, []);

  // Live MP3 playback state & subscription
  const [isMp3Playing, setIsMp3Playing] = useState(false);
  useEffect(() => {
    return soundEngine.subscribeToMp3Playback((playing) => {
      setIsMp3Playing(playing);
    });
  }, []);

  const handleToggleMp3 = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playMp3();
  }, []);

  // Goal Action Center Modal state (Pop-up window similar to Keypad Goal / Penalty)
  const [isInlineGoalScorerOpen, setIsInlineGoalScorerOpen] = useState(false);

  // Arena Sound Mixer & Goal Horn Modal State
  const [isMixerModalOpen, setIsMixerModalOpen] = useState(false);
  const [isCelebrationActive, setIsCelebrationActive] = useState(false);

  const handleQuickCelebration = useCallback(async () => {

    soundEngine.unlock();
    setIsCelebrationActive(true);
    setIsAnnouncing(true);

    const announcementText = "Goal Pelham Pelicans! The puck is in the net!";
    const announcement: Announcement = {
      id: `${Date.now()}-horn-celebration`,
      type: 'goal',
      playerId: 'horn_celebration',
      playerNumber: 0,
      playerName: 'Pelham Celebration',
      text: announcementText,
      timestamp: Date.now(),
      source: voiceStatus?.speechifyConfigured ? 'speechify' : 'webspeech',
      team: 'Pelham Pelicans',
    };
    setCurrentAnnouncement(announcement);

    try {
      const res = await soundEngine.playCelebrationSequence({
        text: announcementText,
        voiceStyle: 'nhl',
      });
      if (res?.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source } : prev));
      }
    } catch (err: any) {
      console.error('Celebration error:', err);
    } finally {
      setIsCelebrationActive(false);
      setIsAnnouncing(false);
    }
  }, [voiceStatus]);

  // Lineup Attendance Edit Mode (allows one-tap removal of absent players right on the tracker)
  const [isLineupEditMode, setIsLineupEditMode] = useState(false);
  // Confirmation state if a player being removed already has scored goals or assists
  const [playerPendingRemoval, setPlayerPendingRemoval] = useState<Player | null>(null);
  // Undo state when a player is removed from the active lineup
  const [lastRemovedPlayer, setLastRemovedPlayer] = useState<{
    player: Player;
    team: 'home' | 'visitor';
  } | null>(null);

  // Preselected player when opening Goal Action Center directly from a player row
  const [preselectedScorer, setPreselectedScorer] = useState<Player | null>(null);

  // Quick Goal Trigger for a specific player
  const handleQuickGoalForPlayer = useCallback((player: Player, team: 'home' | 'visitor') => {
    setActiveTeamTab(team);
    setPreselectedScorer(player);
    setIsInlineGoalScorerOpen(true);
  }, []);


  // Quick Penalty Trigger for a specific player
  const handleQuickPenaltyForPlayer = useCallback((_player: Player, team: 'home' | 'visitor') => {
    setActiveTeamTab(team);
    openConsole('penalty');
  }, [openConsole]);

  // Home and Away Team Action Menu Modals state
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const [isAwayMenuOpen, setIsAwayMenuOpen] = useState(false);

  // Quick Add Player handler for modals and actions
  const handleAddNewPlayerQuick = useCallback((teamTarget?: 'home' | 'visitor') => {
    const target = teamTarget || activeTeamTab;
    const isVis = target === 'visitor';
    const list = isVis ? visitorPlayers : homePlayers;
    const currentTeamName = isVis ? visitorTeamName : 'Pelham Pelicans';
    const existingNumbers = new Set(list.map((p) => p.number));
    let nextNum = 1;
    while (existingNumbers.has(nextNum) && nextNum <= 99) {
      nextNum++;
    }
    const newNum = nextNum > 99 ? 0 : nextNum;
    const newP: Player = {
      id: `${target}_manual_${Date.now()}_${newNum}`,
      number: newNum,
      name: `Player #${newNum}`,
      goals: 0,
      assists: 0,
    };
    if (isVis) {
      setVisitorPlayers((prev) => sortPlayersByNumber([...prev, newP]));
    } else {
      setHomePlayers((prev) => sortPlayersByNumber([...prev, newP]));
    }
    setVoiceFeedback({
      message: `Added #${newNum} to ${currentTeamName} roster`,
      type: 'success',
    });
  }, [activeTeamTab, visitorPlayers, homePlayers, visitorTeamName]);

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
        if (data) {
          setVoiceStatus(data);
          soundEngine.syncServerVoiceDefaults(data);
        }
      })
      .catch((err) => console.warn('Could not fetch server voice status:', err));
  }, []);

  // Auto-sort existing saved rosters from smallest to largest by player number on mount, and ensure visitor default names are Player Number X
  useEffect(() => {
    setHomePlayers((prev) => sortPlayersByNumber(prev));
    setVisitorPlayers((prev) => {
      const migrated = prev.map((p, idx) => ({
        ...p,
        name: migrateVisitorPlayerName(p.name, idx),
      }));
      return sortPlayersByNumber(migrated);
    });
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
      source: voiceStatus?.speechifyConfigured ? 'speechify' : 'webspeech',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(player.id);

    try {
      // NEVER trigger horn automatically. Goal Horn is triggered strictly by user button click!
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
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
      source: voiceStatus?.speechifyConfigured ? 'speechify' : 'webspeech',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(player.id);

    try {
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
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
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
      }
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

  // Welcome Message announcement hosting opponent team & national anthem call
  const handleTestVoice = useCallback(async () => {
    soundEngine.unlock();
    const opponentTeam = visitorTeamName.trim() || 'Visiting Team';
    const prompt = generateWelcomePrompt(opponentTeam);

    const announcement: Announcement = {
      id: `welcome-${Date.now()}`,
      type: 'welcome',
      playerId: 'system',
      playerNumber: 0,
      playerName: 'Pelham Arena PA',
      text: prompt,
      timestamp: Date.now(),
      source: voiceStatus?.configured ? soundEngine.getTTSProvider() : 'webspeech',
      team: 'Pelham Pelicans',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(null);

    try {
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
      }
      if (res.error) {
        setVoiceFeedback({
          message: `Voice Notice: ${res.error}`,
          type: 'warning'
        });
      } else if (res.source === 'speechify') {
        setVoiceFeedback({
          message: `Speechify Simba 3.2 voice playing (${res.voiceId || 'announcer'})`,
          type: 'success'
        });
      } else {
        setVoiceFeedback({
          message: `Local voice playing welcome announcement for ${opponentTeam}`,
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
  }, [visitorTeamName, voiceStatus?.configured]);

  // Pre-game Speaker Check with a short test message
  const handleTestSpeaker = useCallback(async () => {
    soundEngine.unlock();
    const prompt = 'Speaker check: One, two, three. Testing arena sound system. Audio is loud and clear.';

    const announcement: Announcement = {
      id: `speaker-test-${Date.now()}`,
      type: 'welcome',
      playerId: 'system',
      playerNumber: 0,
      playerName: 'Speaker Test',
      text: prompt,
      timestamp: Date.now(),
      source: voiceStatus?.configured ? soundEngine.getTTSProvider() : 'webspeech',
      team: 'Pelham Pelicans',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(null);

    try {
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
      }
      if (res.error) {
        setVoiceFeedback({
          message: `Speaker Test Notice: ${res.error}`,
          type: 'warning'
        });
      } else if (res.source === 'speechify') {
        setVoiceFeedback({
          message: `Speechify Simba 3.2 speaker test audio played (${res.voiceId || 'announcer'})`,
          type: 'success'
        });
      } else {
        setVoiceFeedback({
          message: 'Local vocal engine speaker test audio played',
          type: 'info'
        });
      }
    } catch (err: any) {
      setVoiceFeedback({
        message: err?.message || 'Speaker test failed',
        type: 'warning'
      });
    } finally {
      setIsAnnouncing(false);
      setActiveAnnouncePlayerId(null);
    }
  }, [voiceStatus?.configured]);

  // One minute remaining in period announcement
  const handleAnnouncePeriod = useCallback(async (period: 'first' | 'second' | 'third' | 'overtime') => {
    soundEngine.unlock();
    const prompt = generatePeriodRemainingPrompt(period);

    const announcement: Announcement = {
      id: `period-${Date.now()}`,
      type: 'period',
      playerId: 'system',
      playerNumber: 0,
      playerName: 'Arena Clock',
      text: prompt,
      timestamp: Date.now(),
      source: voiceStatus?.configured ? soundEngine.getTTSProvider() : 'webspeech',
      team: 'Pelham Arena',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(null);

    try {
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
      }
      if (res.error) {
        setVoiceFeedback({
          message: `Voice Notice: ${res.error}`,
          type: 'warning'
        });
      } else {
        const periodTitle = period === 'first' ? '1st Period' : period === 'second' ? '2nd Period' : period === 'third' ? '3rd Period' : 'Overtime';
        setVoiceFeedback({
          message: `Announced: "One minute remaining in the ${periodTitle.toLowerCase()}."`,
          type: 'success'
        });
      }
    } catch (err: any) {
      setVoiceFeedback({
        message: err?.message || 'Period announcement failed',
        type: 'warning'
      });
    } finally {
      setIsAnnouncing(false);
      setActiveAnnouncePlayerId(null);
    }
  }, [voiceStatus?.configured]);

  // Custom Arena announcement
  const handleCustomAnnouncement = useCallback(async (customText: string) => {
    if (!customText.trim()) return;
    soundEngine.unlock();
    const prompt = customText.trim();

    const announcement: Announcement = {
      id: `custom-${Date.now()}`,
      type: 'welcome',
      playerId: 'system',
      playerNumber: 0,
      playerName: 'Arena Announcer',
      text: prompt,
      timestamp: Date.now(),
      source: voiceStatus?.configured ? soundEngine.getTTSProvider() : 'webspeech',
      team: 'Pelham Arena',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(null);

    try {
      const res = await soundEngine.announce(prompt, 'nhl');
      if (res.source) {
        setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
      }
      if (res.error) {
        setVoiceFeedback({
          message: `Voice Notice: ${res.error}`,
          type: 'warning'
        });
      } else {
        setVoiceFeedback({
          message: `Broadcast: "${prompt}"`,
          type: 'success'
        });
      }
    } catch (err: any) {
      setVoiceFeedback({
        message: err?.message || 'Custom announcement failed',
        type: 'warning'
      });
    } finally {
      setIsAnnouncing(false);
      setActiveAnnouncePlayerId(null);
    }
  }, [voiceStatus?.configured]);

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

  // Execute removing player from active lineup
  const executeRemovePlayer = useCallback((player: Player) => {
    const isVis = visitorPlayers.some((p) => p.id === player.id);
    const team: 'home' | 'visitor' = isVis ? 'visitor' : 'home';
    if (isVis) {
      setVisitorPlayers((prev) => prev.filter((p) => p.id !== player.id));
    } else {
      setHomePlayers((prev) => prev.filter((p) => p.id !== player.id));
    }

    setLastRemovedPlayer({ player, team });
    setPlayerPendingRemoval(null);
    setVoiceFeedback({
      message: `Removed #${player.number} ${player.name || 'player'} from today's lineup.`,
      type: 'info',
    });
  }, [visitorPlayers]);

  // Request player removal
  const handleRequestRemovePlayer = useCallback((player: Player) => {
    executeRemovePlayer(player);
  }, [executeRemovePlayer]);

  // Undo last player removal
  const handleUndoRemovePlayer = useCallback(() => {
    if (!lastRemovedPlayer) return;
    const { player, team } = lastRemovedPlayer;
    if (team === 'visitor') {
      setVisitorPlayers((prev) => sortPlayersByNumber([...prev, player]));
    } else {
      setHomePlayers((prev) => sortPlayersByNumber([...prev, player]));
    }
    setLastRemovedPlayer(null);
    setVoiceFeedback({
      message: `Restored #${player.number} ${player.name} to the lineup.`,
      type: 'success',
    });
  }, [lastRemovedPlayer]);

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

  // Score goal with primary and optional secondary assists from numeric keypad entry
  const handleScoreGoalWithAssist = useCallback(
    async (
      team: 'home' | 'visitor',
      scorer: Player,
      primaryAssist?: Player | null,
      secondaryAssist?: Player | null
    ) => {
      soundEngine.unlock();

      const isCurrentVisitor = team === 'visitor';
      const currentTeam = isCurrentVisitor
        ? (visitorTeamName.trim() || 'Visiting Team')
        : 'Pelham Pelicans';

      // 1. Update goals for scorer and assists for primary and secondary assist players
      if (isCurrentVisitor) {
        setVisitorPlayers((prev) => {
          let updated = prev.map((p) => (p.number === scorer.number ? { ...p, goals: p.goals + 1 } : p));
          if (!prev.some((p) => p.number === scorer.number)) {
            updated.push({ ...scorer, id: scorer.id || `visitor_${scorer.number}`, goals: 1, assists: 0 });
          }

          if (primaryAssist && primaryAssist.number) {
            const assistExists = updated.some((p) => p.number === primaryAssist.number);
            updated = assistExists
              ? updated.map((p) => (p.number === primaryAssist.number ? { ...p, assists: p.assists + 1 } : p))
              : [...updated, { ...primaryAssist, id: primaryAssist.id || `visitor_${primaryAssist.number}`, goals: 0, assists: 1 }];
          }

          if (secondaryAssist && secondaryAssist.number) {
            const assist2Exists = updated.some((p) => p.number === secondaryAssist.number);
            updated = assist2Exists
              ? updated.map((p) => (p.number === secondaryAssist.number ? { ...p, assists: p.assists + 1 } : p))
              : [...updated, { ...secondaryAssist, id: secondaryAssist.id || `visitor_${secondaryAssist.number}`, goals: 0, assists: 1 }];
          }

          return sortPlayersByNumber(updated);
        });
      } else {
        setHomePlayers((prev) => {
          let updated = prev.map((p) => (p.number === scorer.number ? { ...p, goals: p.goals + 1 } : p));
          if (!prev.some((p) => p.number === scorer.number)) {
            updated.push({ ...scorer, id: scorer.id || `home_${scorer.number}`, goals: 1, assists: 0 });
          }

          if (primaryAssist && primaryAssist.number) {
            const assistExists = updated.some((p) => p.number === primaryAssist.number);
            updated = assistExists
              ? updated.map((p) => (p.number === primaryAssist.number ? { ...p, assists: p.assists + 1 } : p))
              : [...updated, { ...primaryAssist, id: primaryAssist.id || `home_${primaryAssist.number}`, goals: 0, assists: 1 }];
          }

          if (secondaryAssist && secondaryAssist.number) {
            const assist2Exists = updated.some((p) => p.number === secondaryAssist.number);
            updated = assist2Exists
              ? updated.map((p) => (p.number === secondaryAssist.number ? { ...p, assists: p.assists + 1 } : p))
              : [...updated, { ...secondaryAssist, id: secondaryAssist.id || `home_${secondaryAssist.number}`, goals: 0, assists: 1 }];
          }

          return sortPlayersByNumber(updated);
        });
      }

      // 2. Generate combined voice prompt with scorer, primary assist, and secondary assist
      const prompt = generateGoalWithAssistPrompt(
        scorer.number,
        scorer.name,
        primaryAssist ? primaryAssist.number : null,
        primaryAssist ? primaryAssist.name : null,
        secondaryAssist ? secondaryAssist.number : null,
        secondaryAssist ? secondaryAssist.name : null,
        currentTeam
      );

      const announcement: Announcement = {
        id: `${Date.now()}-${scorer.number}`,
        type: 'goal',
        playerId: scorer.id,
        playerNumber: scorer.number,
        playerName: scorer.name,
        text: prompt,
        timestamp: Date.now(),
        source: voiceStatus?.speechifyConfigured ? 'speechify' : 'webspeech',
        team: currentTeam,
      };

      setCurrentAnnouncement(announcement);
      setIsAnnouncing(true);
      setActiveAnnouncePlayerId(scorer.id);

      try {
        // NEVER trigger horn automatically. Goal Horn is triggered strictly by user button click!
        const res = await soundEngine.announce(prompt, 'nhl');
        if (res.source) {
          setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
        }
        if (res.error) {
          setVoiceFeedback({
            message: `Voice notice: ${res.error}`,
            type: 'warning',
          });
        }
      } catch (err: any) {
        console.error('Goal announcement error:', err);
        setVoiceFeedback({
          message: err?.message || 'Goal announcement failed',
          type: 'warning',
        });
      } finally {
        setIsAnnouncing(false);
        setActiveAnnouncePlayerId(null);
      }
    },
    [visitorTeamName, voiceStatus?.configured]
  );

  // Handle Penalty Announcement vocal template
  const handleAnnouncePenalty = useCallback(
    async (
      team: 'home' | 'visitor',
      player: Player,
      durationText: string,
      infraction: string,
      promptText: string,
      clockTime?: string
    ) => {
      soundEngine.unlock();

      const isCurrentVisitor = team === 'visitor';
      const currentTeam = isCurrentVisitor
        ? (visitorTeamName.trim() || 'Visiting Team')
        : 'Pelham Pelicans';

      // Ensure penalized player is included in team roster if not present yet
      if (isCurrentVisitor) {
        setVisitorPlayers((prev) => {
          if (!prev.some((p) => p.number === player.number)) {
            return sortPlayersByNumber([...prev, { ...player, id: player.id || `visitor_${player.number}`, goals: 0, assists: 0 }]);
          }
          return prev;
        });
      } else {
        setHomePlayers((prev) => {
          if (!prev.some((p) => p.number === player.number)) {
            return sortPlayersByNumber([...prev, { ...player, id: player.id || `home_${player.number}`, goals: 0, assists: 0 }]);
          }
          return prev;
        });
      }

      const announcement: Announcement = {
        id: `penalty-${Date.now()}-${player.number}`,
        type: 'penalty',
        playerId: player.id,
        playerNumber: player.number,
        playerName: player.name,
        text: promptText,
        timestamp: Date.now(),
        source: voiceStatus?.speechifyConfigured ? 'speechify' : 'webspeech',
        team: currentTeam,
        penaltyInfraction: infraction,
        penaltyDuration: durationText && durationText.trim() !== '' ? durationText : 'Without time',
        penaltyClockTime: clockTime && clockTime.trim() !== '' ? clockTime.trim() : undefined,
      };

      setCurrentAnnouncement(announcement);
      setIsAnnouncing(true);
      setActiveAnnouncePlayerId(player.id);

      try {
        const res = await soundEngine.announce(promptText, 'nhl');
        if (res.source) {
          setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source, cartesiaAccount: res.cartesiaAccount } : prev));
        }
        if (res.error) {
          setVoiceFeedback({
            message: `Voice notice: ${res.error}`,
            type: 'warning',
          });
        }
      } catch (err: any) {
        console.error('Penalty announcement error:', err);
        setVoiceFeedback({
          message: err?.message || 'Penalty announcement failed',
          type: 'warning',
        });
      } finally {
        setIsAnnouncing(false);
        setActiveAnnouncePlayerId(null);
      }
    },
    [visitorTeamName, voiceStatus?.configured]
  );

  return (
    <div
      ref={appContainerRef}
      id="app-root"
      className="h-full h-[100dvh] max-h-[100dvh] w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none overscroll-none pb-[env(safe-area-inset-bottom,0px)]"
    >
      {/* Sleek, Decluttered Pro-Broadcast Header Bar */}
      <nav
        aria-label="Main Navigation"
        className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3 shrink-0 select-none shadow-sm"
      >
        {/* Left: Pelham Arena Broadcast Branding */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black font-athletic text-sm border border-amber-300 shadow-md shadow-amber-500/20 shrink-0">
            PP
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black tracking-wider uppercase font-athletic text-white truncate">
              Pelham Arena Announcer
            </h1>
            <p className="text-[10px] text-slate-400 font-medium truncate hidden sm:block">
              Split-Screen Game Broadcast · Left: Pelham Pelicans · Right: {visitorTeamName}
            </p>
          </div>
        </div>

        {/* Center: Live Matchup Pill */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-athletic uppercase tracking-wider shadow-inner shrink-0 text-slate-300">
          <span className="font-bold text-amber-400">Pelham Pelicans</span>
          <span className="text-slate-600 font-bold">vs</span>
          <span className="font-bold text-rose-400">{visitorTeamName}</span>
        </div>

        {/* Right: Audio Mute, Fullscreen, Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Announcement Snippet Pill (shown when announcing) */}
          {currentAnnouncement && currentTab !== 'settings' && (
            <div
              className={`hidden 2xl:flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] max-w-[150px] truncate transition-all ${
                isAnnouncing
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-950/90 border-slate-800 text-slate-300'
              }`}
            >
              <Radio className={`w-3 h-3 shrink-0 ${isAnnouncing ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="truncate">&ldquo;{currentAnnouncement.text}&rdquo;</span>
              <button
                onClick={handleReplayAnnouncement}
                disabled={isAnnouncing}
                className="ml-0.5 p-0.5 rounded hover:bg-slate-800 hover:text-white text-slate-400 shrink-0 transition-colors"
                title="Replay Announcement"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isAnnouncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* Quick Mute/Unmute toggle */}
          <button
            id="nav-mute-toggle-btn"
            onClick={handleToggleMute}
            className={`p-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 ${
              isMuted
                ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
            title={isMuted ? 'Audio Muted - Click to Unmute' : 'Audio Active - Click to Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            id="nav-fullscreen-toggle-btn"
            type="button"
            onClick={handleToggleFullscreen}
            className={`p-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 ${
              isFullscreen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
            title={isFullscreen ? 'Exit Full Screen mode (Esc)' : 'Switch to Full Screen mode'}
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Maximize className="w-3.5 h-3.5 text-slate-300 hover:text-white shrink-0" />
            )}
          </button>

          {/* Settings Tab Button */}
          <button
            id="tab-settings"
            onClick={() => setCurrentTab((prev) => (prev === 'settings' ? 'home' : 'settings'))}
            className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-athletic uppercase tracking-wider font-bold flex items-center gap-1 transition-all shrink-0 ${
              currentTab === 'settings'
                ? 'bg-slate-100 text-slate-950 shadow-sm shadow-white/10 ring-1 ring-slate-200'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
            title="Configure announcer voices, rosters, and match options"
          >
            <Settings className={`w-3.5 h-3.5 ${currentTab === 'settings' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span className="hidden sm:inline">Settings</span>
          </button>
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
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
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
          onOpenMixer={() => setIsMixerModalOpen(true)}
        />
      ) : (
        <>
          {/* Main Fit-to-Screen Arena Board: Vertically Split Left (Home: Pelham Pelicans) and Right (Visitor: {visitorTeamName}) */}
          <main className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-hidden">
            {/* LEFT HALF: HOME TEAM (Pelham Pelicans) */}
            <section
              id="home-team-column"
              className="flex-1 min-h-0 h-full flex flex-col p-2 sm:p-3 bg-gradient-to-b from-slate-900/60 to-slate-950/90 overflow-hidden w-full md:w-1/2"
            >
              {/* Home Column Header with Pelham Menu Button */}
              <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-amber-500/30 px-1 shrink-0 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-athletic font-black text-sm border border-amber-300 shadow-md shadow-amber-500/20 shrink-0">
                    PEL
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-black tracking-wider uppercase font-athletic text-amber-300 truncate">
                        Pelham Pelicans
                      </h2>
                      <span className="text-[10px] font-athletic uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hidden sm:inline">
                        Home
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {homePlayers.length} Active Players in Lineup
                    </p>
                  </div>
                </div>

                {/* Pelham Team Menu Button */}
                <button
                  type="button"
                  id="pelham-menu-btn"
                  onClick={() => {
                    setActiveTeamTab('home');
                    setIsHomeMenuOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-athletic font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/25 active:scale-95 transition-all shrink-0 cursor-pointer"
                  title="Open Pelham Menu: Goal Action Center, Keypad Goal, Penalty, 1 Min Warning, Horn MP3, Celebration, Lineup Tools"
                >
                  <Menu className="w-4 h-4" />
                  <span>Pelham Menu</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
              </div>

              {/* Attendance Removal Mode Alert */}
              {isLineupEditMode && (
                <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 flex items-center justify-between text-xs text-rose-200 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <UserMinus className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Lineup Attendance: Tap Remove to mark absent players</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLineupEditMode(false)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-white shrink-0 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Scrollable Roster of Pelham Players */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 sm:space-y-1.5 pr-0.5 pb-20 custom-scrollbar overscroll-contain">
                {homePlayers.map((player, idx) => (
                  <PlayerTrackerRow
                    key={player.id}
                    player={player}
                    index={idx}
                    team="home"
                    teamName="Pelham Pelicans"
                    isActiveAnnouncing={isAnnouncing && activeAnnouncePlayerId === player.id}
                    isLineupEditMode={isLineupEditMode}
                    onRemovePlayer={handleRequestRemovePlayer}
                  />
                ))}

                {homePlayers.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No players in Pelham lineup. Open Pelham Menu to add players or edit roster.
                  </div>
                )}
              </div>
            </section>

            {/* RIGHT HALF: VISITOR TEAM */}
            <section
              id="visitor-team-column"
              className="flex-1 min-h-0 h-full flex flex-col p-2 sm:p-3 bg-gradient-to-b from-slate-900/60 to-slate-950/90 overflow-hidden w-full md:w-1/2"
            >
              {/* Visitor Column Header with Visitor Menu Button */}
              <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-rose-500/30 px-1 shrink-0 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center font-athletic font-black text-sm border border-rose-300 shadow-md shadow-rose-500/20 shrink-0">
                    VIS
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-black tracking-wider uppercase font-athletic text-rose-300 truncate">
                        {visitorTeamName}
                      </h2>
                      <span className="text-[10px] font-athletic uppercase font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hidden sm:inline">
                        Visitor
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {visitorPlayers.length} Active Players in Lineup
                    </p>
                  </div>
                </div>

                {/* Visitor Team Menu Button */}
                <button
                  type="button"
                  id="visitor-menu-btn"
                  onClick={() => {
                    setActiveTeamTab('visitor');
                    setIsAwayMenuOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-athletic font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-500/25 active:scale-95 transition-all shrink-0 cursor-pointer"
                  title="Open Visitor Menu: Goal Action Center, Keypad Goal, Penalty, 1 Min Warning, Rename Team, Lineup Tools"
                >
                  <Menu className="w-4 h-4" />
                  <span>Visitor Menu</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
              </div>

              {/* Attendance Removal Mode Alert */}
              {isLineupEditMode && (
                <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 flex items-center justify-between text-xs text-rose-200 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <UserMinus className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Lineup Attendance: Tap Remove to mark absent players</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLineupEditMode(false)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500 hover:bg-rose-400 text-white shrink-0 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Scrollable Roster of Visitor Players */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 sm:space-y-1.5 pr-0.5 pb-20 custom-scrollbar overscroll-contain">
                {visitorPlayers.map((player, idx) => (
                  <PlayerTrackerRow
                    key={player.id}
                    player={player}
                    index={idx}
                    team="visitor"
                    teamName={visitorTeamName}
                    isActiveAnnouncing={isAnnouncing && activeAnnouncePlayerId === player.id}
                    isLineupEditMode={isLineupEditMode}
                    onRemovePlayer={handleRequestRemovePlayer}
                  />
                ))}

                {visitorPlayers.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No players in visitor lineup. Open Visitor Menu to add players or edit roster.
                  </div>
                )}
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

      {/* Unified Arena Announcer Console: Single Window for Keypad Goal, Penalty, Period Alerts, Speaker & Welcome */}
      <ArenaConsoleModal
        isOpen={isConsoleModalOpen || isQuickGoalModalOpen || isPenaltyModalOpen}
        onClose={() => {
          setIsConsoleModalOpen(false);
          setIsQuickGoalModalOpen(false);
          setIsPenaltyModalOpen(false);
        }}
        activeTab={
          isQuickGoalModalOpen
            ? 'goal'
            : isPenaltyModalOpen
            ? 'penalty'
            : consoleActiveTab
        }
        onTabChange={(tab) => {
          setConsoleActiveTab(tab);
          if (tab === 'goal') {
            setIsQuickGoalModalOpen(true);
            setIsPenaltyModalOpen(false);
          } else if (tab === 'penalty') {
            setIsPenaltyModalOpen(true);
            setIsQuickGoalModalOpen(false);
          } else {
            setIsQuickGoalModalOpen(false);
            setIsPenaltyModalOpen(false);
          }
        }}
        homePlayers={homePlayers}
        visitorPlayers={visitorPlayers}
        activeTeamTab={activeTeamTab}
        onSwitchTeamTab={(tab) => setActiveTeamTab(tab)}
        visitorTeamName={visitorTeamName}
        isAnnouncing={isAnnouncing}
        currentAnnouncement={currentAnnouncement}
        onScoreGoalWithAssist={handleScoreGoalWithAssist}
        onAnnouncePenalty={handleAnnouncePenalty}
        onAnnouncePeriod={handleAnnouncePeriod}
        onTestSpeaker={handleTestSpeaker}
        onWelcomeMessage={handleTestVoice}
        onCustomAnnouncement={handleCustomAnnouncement}
        onReplayAnnouncement={handleReplayAnnouncement}
        onOpenMixer={() => setIsMixerModalOpen(true)}
      />

      {/* Arena Audio Mixer & Goal Horn Modal */}
      <ArenaMixerModal
        isOpen={isMixerModalOpen}
        onClose={() => setIsMixerModalOpen(false)}
        visitorTeamName={visitorTeamName}
        isAnnouncing={isAnnouncing}
      />

      {/* Goal Action Center: Pop-Up Window Modal */}
      <InlineGoalScorer
        isOpen={isInlineGoalScorerOpen}
        onClose={() => {
          setIsInlineGoalScorerOpen(false);
          setPreselectedScorer(null);
        }}
        homePlayers={homePlayers}
        visitorPlayers={visitorPlayers}
        activeTeamTab={activeTeamTab}
        visitorTeamName={visitorTeamName}
        isMp3Playing={isMp3Playing}
        onToggleMp3={handleToggleMp3}
        isAnnouncing={isAnnouncing}
        initialScorer={preselectedScorer}
        onScoreGoalWithAssist={handleScoreGoalWithAssist}
      />

      {/* Home Team (Pelham Pelicans) Pop-Up Action Menu Modal */}
      <TeamActionModal
        isOpen={isHomeMenuOpen}
        onClose={() => setIsHomeMenuOpen(false)}
        team="home"
        teamName="Pelham Pelicans"
        goals={homeGoals}
        assists={homeAssists}
        playerCount={homePlayers.length}
        onOpenGoalActionCenter={() => {
          setActiveTeamTab('home');
          setCurrentTab('home');
          setPreselectedScorer(null);
          setIsInlineGoalScorerOpen(true);
        }}
        onOpenKeypadGoal={() => {
          setActiveTeamTab('home');
          setCurrentTab('home');
          openConsole('goal');
        }}
        onOpenPenalty={() => {
          setActiveTeamTab('home');
          setCurrentTab('home');
          openConsole('penalty');
        }}
        onOpenPeriodWarning={() => openConsole('period')}
        onOpenSpeakerTest={() => openConsole('speaker')}
        onOpenWelcome={() => handleTestVoice()}
        onOpenCelebration={() => handleQuickCelebration()}
        onOpenMixer={() => setIsMixerModalOpen(true)}
        onOpenRosterModal={() => {
          setActiveTeamTab('home');
          setIsRosterModalOpen(true);
        }}
        onOpenScanner={() => {
          setActiveTeamTab('home');
          handleOpenScanner();
        }}
        onToggleAttendanceMode={() => setIsLineupEditMode((prev) => !prev)}
        isAttendanceModeActive={isLineupEditMode}
        onAddNewPlayer={handleAddNewPlayerQuick}
        onResetScores={() => setIsResetModalOpen(true)}
      />

      {/* Away Team (Visitor) Pop-Up Action Menu Modal */}
      <TeamActionModal
        isOpen={isAwayMenuOpen}
        onClose={() => setIsAwayMenuOpen(false)}
        team="visitor"
        teamName={visitorTeamName}
        goals={visitorGoals}
        assists={visitorAssists}
        playerCount={visitorPlayers.length}
        onOpenGoalActionCenter={() => {
          setActiveTeamTab('visitor');
          setCurrentTab('visitor');
          setPreselectedScorer(null);
          setIsInlineGoalScorerOpen(true);
        }}
        onOpenKeypadGoal={() => {
          setActiveTeamTab('visitor');
          setCurrentTab('visitor');
          openConsole('goal');
        }}
        onOpenPenalty={() => {
          setActiveTeamTab('visitor');
          setCurrentTab('visitor');
          openConsole('penalty');
        }}
        onOpenPeriodWarning={() => openConsole('period')}
        onOpenSpeakerTest={() => openConsole('speaker')}
        onOpenWelcome={() => handleTestVoice()}
        onOpenCelebration={() => handleQuickCelebration()}
        onOpenMixer={() => setIsMixerModalOpen(true)}
        onOpenRosterModal={() => {
          setActiveTeamTab('visitor');
          setIsRosterModalOpen(true);
        }}
        onOpenScanner={() => {
          setActiveTeamTab('visitor');
          handleOpenScanner();
        }}
        onToggleAttendanceMode={() => setIsLineupEditMode((prev) => !prev)}
        isAttendanceModeActive={isLineupEditMode}
        onAddNewPlayer={handleAddNewPlayerQuick}
        onResetScores={() => setIsResetModalOpen(true)}
        onStartRenameVisitor={() => {
          setTempVisitorName(visitorTeamName);
          setIsEditingVisitorName(true);
        }}
      />

      {/* Confirmation Modal when removing a player who already has goals or assists */}
      {playerPendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-athletic uppercase tracking-wide">
                  Remove #{playerPendingRemoval.number} {playerPendingRemoval.name}?
                </h3>
                <p className="text-xs text-slate-400">
                  This player has points recorded in today&apos;s game
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
              <p>
                <strong className="text-white">#{playerPendingRemoval.number} {playerPendingRemoval.name}</strong> currently has{' '}
                <span className="text-amber-400 font-bold">{playerPendingRemoval.goals} goal(s)</span> and{' '}
                <span className="text-sky-400 font-bold">{playerPendingRemoval.assists} assist(s)</span>.
              </p>
              <p className="text-slate-400 text-[11px]">
                Removing them will remove their slot from the active lineup. You can restore them anytime with Undo or the Add Player button.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPlayerPendingRemoval(null)}
                className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
              >
                Keep in Lineup
              </button>
              <button
                type="button"
                onClick={() => executeRemovePlayer(playerPendingRemoval)}
                className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all"
              >
                Yes, Remove Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Undo Pill after removing a player */}
      {lastRemovedPlayer && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 border border-rose-500/50 shadow-2xl rounded-xl px-4 py-2.5 flex items-center gap-3 text-xs text-slate-200 animate-in fade-in slide-in-from-bottom-2">
          <UserMinus className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            Removed <strong className="text-white font-bold">#{lastRemovedPlayer.player.number} {lastRemovedPlayer.player.name || 'player'}</strong> from lineup
          </span>
          <button
            type="button"
            onClick={handleUndoRemovePlayer}
            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={() => setLastRemovedPlayer(null)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
