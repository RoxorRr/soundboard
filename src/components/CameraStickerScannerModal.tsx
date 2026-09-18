import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Upload,
  Check,
  X,
  AlertCircle,
  Sparkles,
  SwitchCamera,
  FileText,
  Layers,
  FileSpreadsheet,
  List,
  Save,
  RotateCcw,
} from 'lucide-react';
import { Player, StickerScanResult, ScannedPlayerItem } from '../types';

interface CameraStickerScannerModalProps {
  isOpen: boolean;
  players: Player[];
  teamName?: string;
  selectedPlayerId?: string | null;
  onClose: () => void;
  onUpdatePlayer: (playerId: string, newNumber: number, newName: string) => void;
  onUpdateAllPlayers?: (updatedPlayers: Player[]) => void;
}

export const CameraStickerScannerModal: React.FC<CameraStickerScannerModalProps> = ({
  isOpen,
  players,
  teamName = 'Pelham Pelicans',
  selectedPlayerId,
  onClose,
  onUpdatePlayer,
  onUpdateAllPlayers,
}) => {
  // Mode: 'all' (populate all 15 slots from sticker file) vs 'single' (update 1 slot)
  const [scanMode, setScanMode] = useState<'all' | 'single'>(
    selectedPlayerId ? 'single' : 'all'
  );

  // Input source tab: 'upload' | 'camera' | 'paste'
  const [inputTab, setInputTab] = useState<'upload' | 'camera' | 'paste'>('upload');

  // Single player target
  const [targetPlayerId, setTargetPlayerId] = useState<string>(
    selectedPlayerId || (players.length > 0 ? players[0].id : '')
  );

  // Camera state
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Scanning & payload state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [scanResult, setScanResult] = useState<StickerScanResult | null>(null);

  // Single player edits
  const [singleNumber, setSingleNumber] = useState<number>(0);
  const [singleName, setSingleName] = useState<string>('');

  // 15 Slots draft state
  const [slotDrafts, setSlotDrafts] = useState<Array<{ number: number; name: string }>>(() =>
    players.map((p) => ({ number: p.number, name: p.name }))
  );

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize or reset slot drafts when players change or modal opens
  useEffect(() => {
    if (isOpen) {
      setSlotDrafts(players.map((p) => ({ number: p.number, name: p.name })));
      if (selectedPlayerId) {
        setTargetPlayerId(selectedPlayerId);
        setScanMode('single');
        setInputTab('camera');
      } else {
        setScanMode('all');
        setInputTab('upload');
      }
    }
  }, [isOpen, selectedPlayerId, players]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('Video play error:', e));
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access or upload an image file instead.'
          : err.message || 'Could not access camera. You can also upload a photo of the sticker.'
      );
    }
  }, [cameraFacing]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Manage camera lifecycle
  useEffect(() => {
    if (isOpen && inputTab === 'camera' && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, inputTab, capturedImage, startCamera, stopCamera]);

  // Switch camera front/back
  const handleToggleFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture current frame from camera
  const handleCapture = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        setFileName('Camera Snapshot');
        stopCamera();
        processScan({ image: dataUrl });
      }
    } catch (e: any) {
      setCameraError('Failed to capture frame: ' + e.message);
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle uploaded file (image, PDF, or text/csv)
  const handleProcessFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setCameraError(null);

    const isTextFile = file.type.includes('text') || file.name.endsWith('.csv') || file.name.endsWith('.txt');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isTextFile) {
      const textReader = new FileReader();
      textReader.onload = (e) => {
        const text = e.target?.result as string;
        setPastedText(text);
        processScan({ rawText: text });
      };
      textReader.readAsText(file);
      return;
    }

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setCapturedImage(null);
        processScan({ image: dataUrl, mimeType: 'application/pdf' });
      };
      reader.readAsDataURL(file);
      return;
    }

    // Default: Image file
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Downscale large camera photos to max 1280px
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCapturedImage(optimizedDataUrl);
          stopCamera();
          processScan({ image: optimizedDataUrl, mimeType: 'image/jpeg' });
        } else {
          setCapturedImage(rawDataUrl);
          stopCamera();
          processScan({ image: rawDataUrl });
        }
      };
      img.onerror = () => {
        setCapturedImage(rawDataUrl);
        stopCamera();
        processScan({ image: rawDataUrl });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  // Send request to backend
  const processScan = async (params: { image?: string; rawText?: string; mimeType?: string }) => {
    setIsScanning(true);
    setScanResult(null);
    setSuccessMessage(null);
    setCameraError(null);

    try {
      const response = await fetch('/api/scan-sticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: params.image,
          rawText: params.rawText,
          mimeType: params.mimeType,
          currentRoster: players.map((p) => ({ number: p.number, name: p.name })),
        }),
      });

      let data: any = null;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (response.status === 404) {
          throw new Error(
            'API endpoint /api/scan-sticker returned 404. If you deployed to Vercel, please ensure your project includes the /api serverless functions directory and redeploy.'
          );
        } else if (response.status === 413) {
          throw new Error(
            'Image file is too large for the server. Please try a smaller photo or enter player numbers and names manually.'
          );
        } else {
          const cleanSnippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
          throw new Error(cleanSnippet || `Server returned error (${response.status})`);
        }
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to extract text from sticker file');
      }

      const result: StickerScanResult = data.data;
      setScanResult(result);

      // 1. If multiple players detected, populate all 15 slots
      if (Array.isArray(result.players) && result.players.length > 0) {
        setSlotDrafts((prev) => {
          const next = [...prev];
          result.players!.forEach((scanned, index) => {
            if (index < next.length) {
              next[index] = {
                number: scanned.number > 0 ? scanned.number : next[index].number,
                name: scanned.name.trim() ? scanned.name.trim() : next[index].name,
              };
            }
          });
          return next;
        });

        // Default to 'all' mode if multiple players found
        if (result.players.length > 1) {
          setScanMode('all');
        }
      }

      // 2. Also populate single player values
      setSingleNumber(result.number || 0);
      setSingleName(result.name || '');

      // Check if primary number matches an existing player
      if (result.number > 0) {
        const matchingPlayer = players.find((p) => p.number === result.number);
        if (matchingPlayer) {
          setTargetPlayerId(matchingPlayer.id);
        }
      }

      if ((!result.players || result.players.length === 0) && result.number === 0 && !result.name.trim()) {
        setCameraError('Could not detect any player stickers or names on the file. You can adjust the image or enter names manually.');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setCameraError(err.message || 'Could not analyze sticker file. You can enter the player names manually below.');
      setScanResult({
        number: 0,
        name: '',
        players: [],
        confidence: 'low',
        notes: 'Manual entry fallback',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Change individual slot in 15 slots list
  const handleSlotDraftChange = (index: number, field: 'number' | 'name', value: string) => {
    setSlotDrafts((prev) => {
      const next = [...prev];
      if (field === 'number') {
        const num = parseInt(value, 10);
        next[index] = { ...next[index], number: isNaN(num) ? 0 : num };
      } else {
        next[index] = { ...next[index], name: value };
      }
      return next;
    });
  };

  // Clear a slot
  const handleClearSlot = (index: number) => {
    setSlotDrafts((prev) => {
      const next = [...prev];
      next[index] = { number: 0, name: `Player ${index + 1}` };
      return next;
    });
  };

  // Reset to original roster
  const handleResetSlots = () => {
    setSlotDrafts(players.map((p) => ({ number: p.number, name: p.name })));
  };

  // Apply changes to all 15 slots
  const handleSaveAllSlots = () => {
    if (!onUpdateAllPlayers) {
      // Fallback: update players sequentially
      slotDrafts.forEach((draft, idx) => {
        if (players[idx]) {
          onUpdatePlayer(players[idx].id, draft.number, draft.name);
        }
      });
    } else {
      const updatedList: Player[] = players.map((p, idx) => ({
        ...p,
        number: slotDrafts[idx]?.number ?? p.number,
        name: slotDrafts[idx]?.name?.trim() || p.name,
      }));
      onUpdateAllPlayers(updatedList);
    }

    setSuccessMessage(`Successfully saved all ${slotDrafts.length} player names into all roster slots!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Apply single player update
  const handleApplySingleUpdate = () => {
    if (!targetPlayerId || !singleName.trim()) return;

    onUpdatePlayer(targetPlayerId, singleNumber, singleName.trim());
    const target = players.find((p) => p.id === targetPlayerId);
    setSuccessMessage(`Updated ${target ? target.name : 'Player'} to #${singleNumber} ${singleName.trim()}!`);

    setTimeout(() => {
      handleRetake();
    }, 1200);
  };

  // Retake or clear current file
  const handleRetake = () => {
    setCapturedImage(null);
    setFileName(null);
    setPastedText('');
    setScanResult(null);
    setSuccessMessage(null);
    setCameraError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (inputTab === 'camera') {
      startCamera();
    }
  };

  if (!isOpen) return null;

  const currentTargetPlayer = players.find((p) => p.id === targetPlayerId);
  const detectedCount = scanResult?.players?.length || (scanResult?.name ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white font-athletic uppercase tracking-wider flex items-center gap-2">
                Sticker File & Roster Scanner
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  ALL {players.length} SLOTS
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Populate all {players.length} player slots for <strong className="text-slate-200">{teamName}</strong> from sticker sheet, photo, or document
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Control Bar: Mode Toggle & Source Selector */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          {/* Scan Target Mode: All Slots vs Single Slot */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setScanMode('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                scanMode === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fill All {players.length} Slots</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('single')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                scanMode === 'single'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Single Player Slot</span>
            </button>
          </div>

          {/* Input Source Tabs */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setInputTab('upload');
                stopCamera();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                inputTab === 'upload'
                  ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputTab('camera');
                setCapturedImage(null);
                startCamera();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                inputTab === 'camera'
                  ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputTab('paste');
                stopCamera();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                inputTab === 'paste'
                  ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Text</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Success Banner */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {cameraError && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{cameraError}</p>
              </div>
            </div>
          )}

          {/* Input Panel depending on active tab */}
          {!scanResult && (
            <div className="space-y-3">
              {/* TAB 1: File Upload / Drag & Drop */}
              {inputTab === 'upload' && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isDraggingOver
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-950/60'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.csv,.txt"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="sticker-sheet-file-input"
                  />

                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>

                  <p className="text-sm font-bold text-white mb-1">
                    Click to browse or drop your sticker file here
                  </p>
                  <p className="text-xs text-slate-400 max-w-md">
                    Accepts photos of sticker sheets, helmet labels, PDF roster sheets, or text/CSV exports.
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-300/80 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gemini AI automatically extracts all {players.length} player names & numbers</span>
                  </div>
                </div>
              )}

              {/* TAB 2: Live Camera Viewfinder */}
              {inputTab === 'camera' && (
                <div className="relative w-full aspect-video sm:aspect-[16/9] max-h-[300px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                  {!capturedImage ? (
                    <>
                      <video
                        ref={videoRef}
                        playsInline
                        autoPlay
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Framing Guide HUD */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                        <div className="relative w-11/12 h-5/6 border border-dashed border-amber-400/50 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.1)]">
                          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
                          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
                          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-amber-400" />

                          <span className="bg-slate-900/85 backdrop-blur px-2.5 py-1 rounded text-[11px] font-medium text-amber-300 tracking-wide">
                            {scanMode === 'all'
                              ? 'Fit full sticker sheet in frame'
                              : 'Fit single player sticker in frame'}
                          </span>
                        </div>
                      </div>

                      {/* Flip Camera Button */}
                      <button
                        type="button"
                        onClick={handleToggleFacing}
                        className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 backdrop-blur transition-all"
                        title="Switch front/back camera"
                      >
                        <SwitchCamera className="w-4 h-4" />
                      </button>

                      {/* Snap Button */}
                      <div className="absolute bottom-3 inset-x-0 flex justify-center">
                        <button
                          type="button"
                          onClick={handleCapture}
                          disabled={isCapturing}
                          className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
                        >
                          <Camera className="w-4 h-4 stroke-[2.5]" />
                          <span>Snap Photo</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <img
                      src={capturedImage}
                      alt="Captured sticker"
                      className="w-full h-full object-contain bg-slate-950"
                    />
                  )}
                </div>
              )}

              {/* TAB 3: Paste Text Input */}
              {inputTab === 'paste' && (
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>Paste Sticker List / Roster Text</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPastedText(
                          `#12 Adrian Repka\n#17 Maklin Kunka\n#4 Liam Carter\n#7 Owen Miller\n#8 Connor Hughes\n#9 Noah Smith\n#10 Ethan Davies\n#11 Lucas Brown\n#14 Cole Anderson\n#19 Mason Taylor\n#22 Jackson White\n#27 Caleb Wilson\n#33 Logan Martin\n#44 Dylan Harris\n#77 Ryan Thompson`
                        )
                      }
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Insert Example Roster
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste jersey numbers and player names here, e.g.:&#10;#12 Adrian Repka&#10;#17 Maklin Kunka&#10;#4 Liam Carter..."
                    className="w-full bg-slate-900 text-slate-100 text-xs font-mono p-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!pastedText.trim() || isScanning}
                      onClick={() => processScan({ rawText: pastedText })}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Extract Players into All Slots</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading Animation while Gemini processes */}
          {isScanning && (
            <div className="p-8 rounded-2xl bg-slate-950/80 border border-amber-500/40 flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative">
                <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <Sparkles className="w-4 h-4 text-amber-400 absolute inset-0 m-auto" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Reading Sticker File with Gemini AI...</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detecting all player names, numbers, and mapping to team slots
                </p>
              </div>
            </div>
          )}

          {/* RESULTS DISPLAY & SLOT MAPPING REVIEW */}
          {scanResult && !isScanning && (
            <div className="space-y-3.5">
              {/* Extraction Header Summary */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-athletic flex items-center gap-2">
                      <span>Extracted {detectedCount} Player{detectedCount === 1 ? '' : 's'} from File</span>
                      {scanResult.confidence && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {scanResult.confidence} confidence
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {scanResult.notes || 'Review and adjust player names before saving into all slots.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Another File</span>
                </button>
              </div>

              {/* ALL 15 SLOTS REVIEW TABLE */}
              {scanMode === 'all' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      <span>{players.length} Roster Slots Mapping:</span>
                    </p>
                    <button
                      type="button"
                      onClick={handleResetSlots}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to current</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
                    {slotDrafts.map((draft, idx) => {
                      const origPlayer = players[idx];
                      const isChanged =
                        origPlayer && (origPlayer.number !== draft.number || origPlayer.name !== draft.name);

                      return (
                        <div
                          key={`slot-${idx}`}
                          className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                            isChanged
                              ? 'bg-amber-950/30 border-amber-500/50 shadow-sm shadow-amber-500/5'
                              : 'bg-slate-950/60 border-slate-800/80'
                          }`}
                        >
                          <div className="w-12 shrink-0">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">
                              Slot {idx + 1}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={draft.number}
                              onChange={(e) => handleSlotDraftChange(idx, 'number', e.target.value)}
                              className="w-full bg-slate-800 text-slate-100 font-athletic font-black text-sm px-1.5 py-1 rounded border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">
                              Player Name
                            </span>
                            <input
                              type="text"
                              value={draft.name}
                              onChange={(e) => handleSlotDraftChange(idx, 'name', e.target.value)}
                              placeholder="Player Name"
                              className="w-full bg-slate-800 text-slate-100 font-bold text-xs px-2 py-1 rounded border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                              required
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleClearSlot(idx)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors shrink-0"
                            title="Clear slot"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Primary Save All Button */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400 hidden sm:block">
                      Clicking save will update all {slotDrafts.length} player names and jersey numbers immediately.
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveAllSlots}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-athletic font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Save All {slotDrafts.length} Players into All Slots</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SINGLE SLOT REVIEW PANEL */}
              {scanMode === 'single' && (
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-300 font-athletic uppercase">
                      Target Roster Slot:
                    </label>
                    <select
                      value={targetPlayerId}
                      onChange={(e) => setTargetPlayerId(e.target.value)}
                      className="bg-slate-800 text-slate-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700"
                    >
                      {players.map((p, idx) => (
                        <option key={p.id} value={p.id}>
                          Slot {idx + 1}: #{p.number} {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Jersey #
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={singleNumber}
                        onChange={(e) => setSingleNumber(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-slate-800 text-slate-100 font-athletic font-black text-base px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Player Name
                      </label>
                      <input
                        type="text"
                        value={singleName}
                        onChange={(e) => setSingleName(e.target.value)}
                        placeholder="Player Name"
                        className="w-full bg-slate-800 text-slate-100 font-bold text-sm px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleApplySingleUpdate}
                      disabled={!singleName.trim()}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        Apply to {currentTargetPlayer ? `Slot #${currentTargetPlayer.number}` : 'Slot'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
