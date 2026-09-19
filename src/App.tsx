import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PlayerTrackerRow } from './components/PlayerTrackerRow';
import { EditRosterModal } from './components/EditRosterModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { CameraStickerScannerModal } from './components/CameraStickerScannerModal';
import { QuickGoalModal } from './components/QuickGoalModal';
import { PenaltyModal } from './components/PenaltyModal';
import { SettingsView } from './components/SettingsView';
import { DEFAULT_PELHAM_PLAYERS, DEFAULT_VISITOR_PLAYERS } from './data/defaultPlayers';
import { Player, Announcement, VoiceStatus } from './types';
import { soundEngine, generateGoalPrompt, generateAssistPrompt, generateGoalWithAssistPrompt, generateWelcomePrompt } from './utils/audio';
import { Flame, Award, Edit2, Check, X, Shield, ShieldAlert, Sparkles, Settings, Volume2, VolumeX, Radio, RefreshCw, Maximize, Minimize, UserMinus, UserPlus, Users, Undo2, Camera, Hash } from 'lucide-react';

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

  // Visitor players state with local persistence (sorted 1-99, supports any roster count)
  const [visitorPlayers, setVisitorPlayers] = useState<Player[]>(() => {
    try {
      const savedV2 = localStorage.getItem(VISITOR_STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
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

  // Lineup Attendance Edit Mode (allows one-tap removal of absent players right on the tracker)
  const [isLineupEditMode, setIsLineupEditMode] = useState(false);
  // Confirmation state if a player being removed already has scored goals or assists
  const [playerPendingRemoval, setPlayerPendingRemoval] = useState<Player | null>(null);
  // Undo state when a player is removed from the active lineup
  const [lastRemovedPlayer, setLastRemovedPlayer] = useState<{
    player: Player;
    team: 'home' | 'visitor';
  } | null>(null);

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

  // Sound Test with welcome announcement hosting opponent team
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
      source: voiceStatus?.configured ? 'elevenlabs' : 'webspeech',
      team: 'Pelham Pelicans',
    };

    setCurrentAnnouncement(announcement);
    setIsAnnouncing(true);
    setActiveAnnouncePlayerId(null);

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
    const team = activeTeamTab;
    if (team === 'visitor') {
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
  }, [activeTeamTab]);

  // Request player removal (prompts confirmation if player has goals/assists recorded)
  const handleRequestRemovePlayer = useCallback((player: Player) => {
    const totalPoints = (player.goals || 0) + (player.assists || 0);
    if (totalPoints > 0) {
      setPlayerPendingRemoval(player);
    } else {
      executeRemovePlayer(player);
    }
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
        source: voiceStatus?.configured ? 'elevenlabs' : 'webspeech',
        team: currentTeam,
      };

      setCurrentAnnouncement(announcement);
      setIsAnnouncing(true);
      setActiveAnnouncePlayerId(scorer.id);

      try {
        const res = await soundEngine.announce(prompt, 'nhl');
        if (res.source) {
          setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source } : prev));
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
      promptText: string
    ) => {
      soundEngine.unlock();

      const isCurrentVisitor = team === 'visitor';
      const currentTeam = isCurrentVisitor
        ? (visitorTeamName.trim() || 'Visiting Team')
        : 'Pelham Pelicans';

      const announcement: Announcement = {
        id: `penalty-${Date.now()}-${player.number}`,
        type: 'penalty',
        playerId: player.id,
        playerNumber: player.number,
        playerName: player.name,
        text: promptText,
        timestamp: Date.now(),
        source: voiceStatus?.configured ? 'elevenlabs' : 'webspeech',
        team: currentTeam,
        penaltyInfraction: infraction,
        penaltyDuration: durationText && durationText.trim() !== '' ? durationText : 'Without time',
      };

      setCurrentAnnouncement(announcement);
      setIsAnnouncing(true);
      setActiveAnnouncePlayerId(player.id);

      try {
        const res = await soundEngine.announce(promptText, 'nhl');
        if (res.source) {
          setCurrentAnnouncement((prev) => (prev ? { ...prev, source: res.source } : prev));
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

          {/* Quick Keypad Goal & Assist Entry Trigger */}
          {currentTab !== 'settings' && (
            <button
              id="nav-quick-goal-btn"
              type="button"
              onClick={() => setIsQuickGoalModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-95 text-slate-950 font-athletic font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shadow-amber-500/20"
              title="Input jersey numbers of scorer and assist maker with numeric keypad"
            >
              <Hash className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keypad Goal</span>
              <span className="sm:hidden">Keypad</span>
            </button>
          )}

          {/* Quick Penalty Announcement Trigger */}
          {currentTab !== 'settings' && (
            <button
              id="nav-penalty-btn"
              type="button"
              onClick={() => setIsPenaltyModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-rose-500/20 active:scale-95 text-rose-300 hover:text-white border border-rose-500/30 font-athletic font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
              title="Announce a penalty: 'Number [X], [Team] two minutes for [foul]'"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Penalty</span>
              <span className="sm:hidden">Pen</span>
            </button>
          )}

          {/* Sound Test Welcome Announcement Button */}
          <button
            id="nav-sound-test-btn"
            type="button"
            onClick={handleTestVoice}
            disabled={isAnnouncing}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-amber-500/20 active:scale-95 text-amber-300 hover:text-white border border-amber-500/30 font-athletic font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            title={`Sound Test: Welcome announcement hosting ${visitorTeamName}`}
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isAnnouncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sound Test</span>
            <span className="sm:hidden">Test</span>
          </button>

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

          {/* Fullscreen Toggle Button */}
          <button
            id="nav-fullscreen-toggle-btn"
            type="button"
            onClick={handleToggleFullscreen}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isFullscreen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
            title={isFullscreen ? 'Exit Full Screen mode (Esc)' : 'Switch to Full Screen mode'}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden xl:inline text-[11px]">Exit Full</span>
              </>
            ) : (
              <>
                <Maximize className="w-3.5 h-3.5 text-slate-300 hover:text-white shrink-0" />
                <span className="hidden xl:inline text-[11px]">Full Screen</span>
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

          {/* Lineup Attendance & Roster Management Bar */}
          <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className={`px-2.5 py-1 rounded-md text-xs font-athletic font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isVisitor
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{activeTeamName}:</span>
                <span className="font-mono font-black text-white">{activePlayers.length} Active Players</span>
              </div>

              {/* Quick Remove Absent Players Toggle */}
              <button
                type="button"
                onClick={() => setIsLineupEditMode((prev) => !prev)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  isLineupEditMode
                    ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30 ring-1 ring-rose-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                }`}
                title={isLineupEditMode ? 'Finish removing absent players' : 'Click to quickly tap and remove players who are absent today'}
              >
                <UserMinus className={`w-3.5 h-3.5 ${isLineupEditMode ? 'text-white' : 'text-rose-400'}`} />
                <span>{isLineupEditMode ? 'Finish Removing Absent' : 'Remove Absent Players'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Quick Keypad Goal & Assist Entry */}
              <button
                type="button"
                onClick={() => setIsQuickGoalModalOpen(true)}
                className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                  isVisitor
                    ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
                title="Input jersey numbers of scorer and assist maker with numeric keypad"
              >
                <Hash className="w-3.5 h-3.5 font-black" />
                <span className="font-athletic uppercase tracking-wider">Keypad Goal</span>
              </button>

              {/* Penalty Announcement */}
              <button
                type="button"
                id="roster-penalty-btn"
                onClick={() => setIsPenaltyModalOpen(true)}
                className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 hover:bg-rose-500/20 text-rose-300 hover:text-white border border-rose-500/30 flex items-center gap-1.5 transition-colors shadow-sm"
                title="Announce penalty with template: Number [X], [Team] two minutes for [foul]"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-athletic uppercase tracking-wider">Penalty</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRosterModalOpen(true)}
                className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors"
                title="Edit jersey numbers, player names, or add/remove players"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Manage Lineup & Roster</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenScanner()}
                className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors hidden sm:flex"
                title="Scan sticker sheet with camera"
              >
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>Scan Sticker</span>
              </button>
            </div>
          </div>

          {/* Banner when Lineup Attendance Mode is active */}
          {isLineupEditMode && (
            <div className="bg-rose-950/80 border-b border-rose-500/50 px-3 py-2 flex items-center justify-between gap-2 text-xs text-rose-200 animate-in fade-in">
              <div className="flex items-center gap-2">
                <UserMinus className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  <strong>Lineup Attendance Mode:</strong> Tap the red <strong>Remove</strong> button on any player who is not present today. Changes are saved automatically.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLineupEditMode(false)}
                className="px-3 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shrink-0 transition-colors shadow-sm"
              >
                Done (Lineup Ready)
              </button>
            </div>
          )}

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
              <button
                type="button"
                onClick={() => setIsQuickGoalModalOpen(true)}
                className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                  isVisitor
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                }`}
                title="Enter jersey # of scorer & assist maker with numeric keypad"
              >
                <Hash className="w-3 h-3" />
                <span className="hidden sm:inline">Keypad Entry</span>
              </button>
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
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 sm:space-y-1.5 pr-0.5 pb-28 sm:pb-32 custom-scrollbar overscroll-contain">
            {activePlayers.map((player, idx) => (
              <PlayerTrackerRow
                key={player.id}
                player={player}
                index={idx}
                mode="goals"
                teamName={activeTeamName}
                isActiveAnnouncing={isAnnouncing && activeAnnouncePlayerId === player.id}
                isLineupEditMode={isLineupEditMode}
                onIncrement={handleGoalIncrement}
                onDecrement={handleGoalDecrement}
                onScanSticker={(p) => handleOpenScanner(p.id)}
                onRemovePlayer={handleRequestRemovePlayer}
              />
            ))}

            {/* Roster Bottom Clearance Card to guarantee the last player is fully visible above browser chrome */}
            <div className="pt-2 pb-6 px-3 flex items-center justify-center gap-2 text-slate-500 text-[11px] font-athletic uppercase tracking-wider select-none border-t border-slate-900/60 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
              <span>End of {activeTeamName} Roster ({activePlayers.length} Players)</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
            </div>
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
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 sm:space-y-1.5 pr-0.5 pb-28 sm:pb-32 custom-scrollbar overscroll-contain">
            {activePlayers.map((player, idx) => (
              <PlayerTrackerRow
                key={player.id}
                player={player}
                index={idx}
                mode="assists"
                teamName={activeTeamName}
                isActiveAnnouncing={isAnnouncing && activeAnnouncePlayerId === player.id}
                isLineupEditMode={isLineupEditMode}
                onIncrement={handleAssistIncrement}
                onDecrement={handleAssistDecrement}
                onScanSticker={(p) => handleOpenScanner(p.id)}
                onRemovePlayer={handleRequestRemovePlayer}
              />
            ))}

            {/* Roster Bottom Clearance Card to guarantee the last player is fully visible above browser chrome */}
            <div className="pt-2 pb-6 px-3 flex items-center justify-center gap-2 text-slate-500 text-[11px] font-athletic uppercase tracking-wider select-none border-t border-slate-900/60 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
              <span>End of {activeTeamName} Roster ({activePlayers.length} Players)</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
            </div>
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

      {/* Quick Goal & Assist Entry Modal with Numeric Keypad */}
      <QuickGoalModal
        isOpen={isQuickGoalModalOpen}
        onClose={() => setIsQuickGoalModalOpen(false)}
        homePlayers={homePlayers}
        visitorPlayers={visitorPlayers}
        activeTeamTab={activeTeamTab}
        onSwitchTeamTab={(tab) => setActiveTeamTab(tab)}
        visitorTeamName={visitorTeamName}
        onScoreGoalWithAssist={handleScoreGoalWithAssist}
      />

      {/* Penalty Announcement Modal with Template & Foul Type Selector */}
      <PenaltyModal
        isOpen={isPenaltyModalOpen}
        onClose={() => setIsPenaltyModalOpen(false)}
        homePlayers={homePlayers}
        visitorPlayers={visitorPlayers}
        activeTeamTab={activeTeamTab}
        onSwitchTeamTab={(tab) => setActiveTeamTab(tab)}
        visitorTeamName={visitorTeamName}
        onAnnouncePenalty={handleAnnouncePenalty}
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
