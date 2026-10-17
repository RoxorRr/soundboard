import fs from "fs";
import path from "path";

// In-memory cache for ultra-fast serverless and express responses
export interface StoredGoalHorn {
  hasCustomHorn: boolean;
  audioBase64: string | null;
  mimeType: string;
  filename: string;
  fileSize: number;
  duration?: number;
  updatedAt: number;
  mixerSettings?: {
    hornEnabled?: boolean;
    hornVolume?: number;
    voiceVolume?: number;
    masterVolume?: number;
    selectedPreset?: string;
    hornDurationLimit?: number;
    voiceTriggerMode?: "after_horn" | "delay";
    voiceDelaySeconds?: number;
    duckHornOnVoice?: boolean;
    autoTriggerOnGoal?: boolean;
  };
}

export const DEFAULT_SERVER_HORN: StoredGoalHorn = {
  hasCustomHorn: true,
  audioBase64: "/audio/pelham_pelicans_goal_horn.mp3",
  mimeType: "audio/mpeg",
  filename: "pelham_pelicans_goal_horn.mp3",
  fileSize: 2161720,
  duration: 90,
  updatedAt: 1730000000000,
  mixerSettings: {
    hornEnabled: true,
    hornVolume: 0.95,
    voiceVolume: 1.0,
    masterVolume: 1.0,
    selectedPreset: "custom",
    hornDurationLimit: 0,
    voiceTriggerMode: "delay",
    voiceDelaySeconds: 2.0,
    duckHornOnVoice: false, // Default: unselected
    autoTriggerOnGoal: false,
  },
};

let inMemoryHorn: StoredGoalHorn | null = null;

function getStorePaths(): string[] {
  const paths: string[] = [];
  try {
    paths.push(path.join(process.cwd(), "goal_horn_store.json"));
  } catch (_) {}
  try {
    paths.push(path.join("/tmp", "pelham_goal_horn_store.json"));
  } catch (_) {}
  return paths;
}

function loadHornFromDisk(): StoredGoalHorn {
  if (inMemoryHorn && inMemoryHorn.hasCustomHorn && inMemoryHorn.audioBase64) {
    return inMemoryHorn;
  }

  for (const filePath of getStorePaths()) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.updatedAt === "number" && parsed.audioBase64) {
          if (parsed.mixerSettings) {
            parsed.mixerSettings.duckHornOnVoice = false;
          }
          inMemoryHorn = parsed;
          return parsed;
        }
      }
    } catch (_) {}
  }

  // Fallback to the authentic bundled Pelham Pelicans Goal Horn MP3 track
  inMemoryHorn = { ...DEFAULT_SERVER_HORN };
  return inMemoryHorn;
}

function saveHornToDisk(data: StoredGoalHorn): void {
  inMemoryHorn = data;
  const serialized = JSON.stringify(data);
  for (const filePath of getStorePaths()) {
    try {
      fs.writeFileSync(filePath, serialized, "utf8");
    } catch (_) {}
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // GET: Fetch stored goal horn audio and mixer preferences across all devices
  if (req.method === "GET") {
    const horn = loadHornFromDisk();

    return res.status(200).json({
      hasCustomHorn: true,
      audioBase64: horn.audioBase64 || DEFAULT_SERVER_HORN.audioBase64,
      mimeType: horn.mimeType || "audio/mpeg",
      filename: horn.filename || "pelham_pelicans_goal_horn.mp3",
      fileSize: horn.fileSize || DEFAULT_SERVER_HORN.fileSize,
      duration: horn.duration || 90,
      updatedAt: horn.updatedAt || Date.now(),
      mixerSettings: horn.mixerSettings || DEFAULT_SERVER_HORN.mixerSettings,
    });
  }

  // POST: Upload or update goal horn audio and mixer settings
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { audioBase64, mimeType, filename, fileSize, duration, mixerSettings } = body;

      if (!audioBase64 && !mixerSettings) {
        return res.status(400).json({ error: "Missing audioBase64 or mixerSettings" });
      }

      const existing = loadHornFromDisk();

      // If audioBase64 is provided, update custom horn. If not provided, strictly preserve existing horn data!
      const hasNewAudio = Boolean(audioBase64 && typeof audioBase64 === "string" && audioBase64.length > 50);
      const audioData = hasNewAudio ? audioBase64 : (existing.audioBase64 || DEFAULT_SERVER_HORN.audioBase64);

      const updatedRecord: StoredGoalHorn = {
        hasCustomHorn: true,
        audioBase64: audioData,
        mimeType: hasNewAudio ? (mimeType || "audio/mpeg") : (existing.mimeType || "audio/mpeg"),
        filename: hasNewAudio ? (filename || "custom_goal_horn.mp3") : (existing.filename || "pelham_pelicans_goal_horn.mp3"),
        fileSize: hasNewAudio ? (typeof fileSize === "number" ? fileSize : audioBase64.length) : (existing.fileSize || DEFAULT_SERVER_HORN.fileSize),
        duration: typeof duration === "number" ? duration : (existing.duration || 90),
        updatedAt: hasNewAudio ? Date.now() : (existing.updatedAt || Date.now()),
        mixerSettings: mixerSettings
          ? { ...(existing.mixerSettings || DEFAULT_SERVER_HORN.mixerSettings || {}), ...mixerSettings }
          : existing.mixerSettings,
      };

      saveHornToDisk(updatedRecord);

      return res.status(200).json({
        success: true,
        message: hasNewAudio ? "Goal horn saved and synced" : "Mixer settings updated",
        updatedAt: updatedRecord.updatedAt,
        hasCustomHorn: true,
        filename: updatedRecord.filename,
        fileSize: updatedRecord.fileSize,
        duration: updatedRecord.duration,
      });
    } catch (err: any) {
      console.error("Error saving goal horn:", err);
      return res.status(500).json({ error: err?.message || "Failed to save goal horn" });
    }
  }

  // DELETE: Remove uploaded horn and revert to default authentic Pelham MP3 track
  if (req.method === "DELETE") {
    const existing = loadHornFromDisk();
    const updatedRecord: StoredGoalHorn = {
      ...DEFAULT_SERVER_HORN,
      updatedAt: Date.now(),
      mixerSettings: existing.mixerSettings || DEFAULT_SERVER_HORN.mixerSettings,
    };

    saveHornToDisk(updatedRecord);

    return res.status(200).json({
      success: true,
      message: "Reverted to built-in Pelham Pelicans arena goal horn MP3 track.",
      updatedAt: updatedRecord.updatedAt,
      hasCustomHorn: true,
      filename: updatedRecord.filename,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
