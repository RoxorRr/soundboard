import fs from "fs";
import path from "path";

// In-memory cache for ultra-fast serverless and express responses
interface StoredGoalHorn {
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

function loadHornFromDisk(): StoredGoalHorn | null {
  if (inMemoryHorn) return inMemoryHorn;

  for (const filePath of getStorePaths()) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.updatedAt === "number") {
          inMemoryHorn = parsed;
          return parsed;
        }
      }
    } catch (_) {}
  }
  return null;
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
    if (!horn || !horn.hasCustomHorn || !horn.audioBase64) {
      return res.status(200).json({
        hasCustomHorn: false,
        audioBase64: null,
        mimeType: "audio/mpeg",
        filename: "",
        fileSize: 0,
        updatedAt: horn?.updatedAt || 0,
        mixerSettings: horn?.mixerSettings || null,
      });
    }

    return res.status(200).json({
      hasCustomHorn: true,
      audioBase64: horn.audioBase64,
      mimeType: horn.mimeType || "audio/mpeg",
      filename: horn.filename || "goal_horn.mp3",
      fileSize: horn.fileSize || 0,
      duration: horn.duration || 0,
      updatedAt: horn.updatedAt,
      mixerSettings: horn.mixerSettings || null,
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
      const hasCustom = hasNewAudio ? true : (existing?.hasCustomHorn ?? false);
      const audioData = hasNewAudio ? audioBase64 : (existing?.audioBase64 ?? null);

      const updatedRecord: StoredGoalHorn = {
        hasCustomHorn: hasCustom,
        audioBase64: audioData,
        mimeType: hasNewAudio ? (mimeType || "audio/mpeg") : (existing?.mimeType || "audio/mpeg"),
        filename: hasNewAudio ? (filename || "goal_horn.mp3") : (existing?.filename || "goal_horn.mp3"),
        fileSize: hasNewAudio ? (typeof fileSize === "number" ? fileSize : audioBase64.length) : (existing?.fileSize || 0),
        duration: typeof duration === "number" ? duration : existing?.duration,
        updatedAt: hasNewAudio ? Date.now() : (existing?.updatedAt || Date.now()),
        mixerSettings: mixerSettings
          ? { ...(existing?.mixerSettings || {}), ...mixerSettings }
          : existing?.mixerSettings,
      };

      saveHornToDisk(updatedRecord);

      return res.status(200).json({
        success: true,
        message: hasNewAudio ? "Goal horn saved and synced" : "Mixer settings updated",
        updatedAt: updatedRecord.updatedAt,
        hasCustomHorn: updatedRecord.hasCustomHorn,
        filename: updatedRecord.filename,
        fileSize: updatedRecord.fileSize,
      });
    } catch (err: any) {
      console.error("Error saving goal horn:", err);
      return res.status(500).json({ error: err?.message || "Failed to save goal horn" });
    }
  }

  // DELETE: Remove uploaded horn and revert to default preset
  if (req.method === "DELETE") {
    const existing = loadHornFromDisk();
    const updatedRecord: StoredGoalHorn = {
      hasCustomHorn: false,
      audioBase64: null,
      mimeType: "audio/mpeg",
      filename: "",
      fileSize: 0,
      updatedAt: Date.now(),
      mixerSettings: existing?.mixerSettings,
    };

    saveHornToDisk(updatedRecord);

    return res.status(200).json({
      success: true,
      message: "Custom goal horn removed. Reset to standard arena preset.",
      updatedAt: updatedRecord.updatedAt,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
