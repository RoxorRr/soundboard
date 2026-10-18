import fs from "fs";
import path from "path";

export interface GoalHornRecord {
  id: string;
  name: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  duration?: number;
  audioBase64: string;
  isDefault?: boolean;
  isBuiltin?: boolean;
  createdAt: number;
}

export interface StoredGoalHornStore {
  activeHornId: string;
  horns: GoalHornRecord[];
  mixerSettings?: {
    hornEnabled?: boolean;
    hornVolume?: number;
    voiceVolume?: number;
    masterVolume?: number;
    selectedPreset?: string;
    activeGoalHornId?: string;
    hornDurationLimit?: number;
    voiceTriggerMode?: "after_horn" | "delay";
    voiceDelaySeconds?: number;
    duckHornOnVoice?: boolean;
    autoTriggerOnGoal?: boolean;
  };
  updatedAt: number;
}

export const OFFICIAL_PELHAM_RECORD: GoalHornRecord = {
  id: "official_pelham",
  name: "Official Pelham Pelicans Goal Horn",
  filename: "pelham_pelicans_goal_horn.mp3",
  mimeType: "audio/mpeg",
  fileSize: 2161720,
  duration: 90,
  audioBase64: "/audio/pelham_pelicans_goal_horn.mp3",
  isDefault: true,
  isBuiltin: true,
  createdAt: 1730000000000,
};

export const DEFAULT_SERVER_STORE: StoredGoalHornStore = {
  activeHornId: "official_pelham",
  horns: [OFFICIAL_PELHAM_RECORD],
  mixerSettings: {
    hornEnabled: true,
    hornVolume: 0.95,
    voiceVolume: 1.0,
    masterVolume: 1.0,
    selectedPreset: "custom",
    activeGoalHornId: "official_pelham",
    hornDurationLimit: 0,
    voiceTriggerMode: "delay",
    voiceDelaySeconds: 2.0,
    duckHornOnVoice: false, // Default: unselected
    autoTriggerOnGoal: false,
  },
  updatedAt: 1730000000000,
};

let inMemoryStore: StoredGoalHornStore | null = null;

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

function loadStoreFromDisk(): StoredGoalHornStore {
  if (inMemoryStore && Array.isArray(inMemoryStore.horns) && inMemoryStore.horns.length > 0) {
    return inMemoryStore;
  }

  for (const filePath of getStorePaths()) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed) {
          // If legacy single-horn format, migrate to store format
          let horns: GoalHornRecord[] = Array.isArray(parsed.horns) ? parsed.horns : [];
          if (!horns.some((h) => h.id === "official_pelham")) {
            horns.unshift({ ...OFFICIAL_PELHAM_RECORD });
          }

          // If legacy file had a custom audio uploaded that wasn't official pelham, preserve it
          if (
            parsed.hasCustomHorn &&
            parsed.audioBase64 &&
            parsed.filename !== "pelham_pelicans_goal_horn.mp3" &&
            !horns.some((h) => h.audioBase64 === parsed.audioBase64)
          ) {
            horns.push({
              id: "horn_legacy_" + (parsed.updatedAt || Date.now()),
              name: parsed.filename || "Uploaded Custom Horn",
              filename: parsed.filename || "custom_horn.mp3",
              mimeType: parsed.mimeType || "audio/mpeg",
              fileSize: parsed.fileSize || 0,
              duration: parsed.duration || 0,
              audioBase64: parsed.audioBase64,
              isDefault: false,
              isBuiltin: false,
              createdAt: parsed.updatedAt || Date.now(),
            });
          }

          const activeId = parsed.activeHornId || (horns.length > 1 ? horns[horns.length - 1].id : "official_pelham");
          const mixer = parsed.mixerSettings || DEFAULT_SERVER_STORE.mixerSettings;
          if (mixer) {
            mixer.duckHornOnVoice = false;
            mixer.activeGoalHornId = activeId;
          }

          const store: StoredGoalHornStore = {
            activeHornId: activeId,
            horns,
            mixerSettings: mixer,
            updatedAt: parsed.updatedAt || Date.now(),
          };

          inMemoryStore = store;
          return store;
        }
      }
    } catch (_) {}
  }

  inMemoryStore = { ...DEFAULT_SERVER_STORE, horns: [{ ...OFFICIAL_PELHAM_RECORD }] };
  return inMemoryStore;
}

function saveStoreToDisk(data: StoredGoalHornStore): void {
  // Ensure official pelham is always in the list
  if (!data.horns.some((h) => h.id === "official_pelham")) {
    data.horns.unshift({ ...OFFICIAL_PELHAM_RECORD });
  }
  inMemoryStore = data;
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

  // GET: Fetch stored goal horn audio, full horns library, and mixer preferences
  if (req.method === "GET") {
    const store = loadStoreFromDisk();
    const activeHorn = store.horns.find((h) => h.id === store.activeHornId) || store.horns[0] || OFFICIAL_PELHAM_RECORD;

    return res.status(200).json({
      success: true,
      activeHornId: store.activeHornId,
      activeHorn,
      horns: store.horns,
      hasCustomHorn: true,
      audioBase64: activeHorn.audioBase64 || OFFICIAL_PELHAM_RECORD.audioBase64,
      mimeType: activeHorn.mimeType || "audio/mpeg",
      filename: activeHorn.filename || "pelham_pelicans_goal_horn.mp3",
      fileSize: activeHorn.fileSize || OFFICIAL_PELHAM_RECORD.fileSize,
      duration: activeHorn.duration || 90,
      updatedAt: store.updatedAt || Date.now(),
      mixerSettings: store.mixerSettings || DEFAULT_SERVER_STORE.mixerSettings,
    });
  }

  // POST: Upload new goal horn, select active horn, update settings, or delete horn
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { action, hornId, audioBase64, mimeType, filename, name, fileSize, duration, mixerSettings } = body;

      const store = loadStoreFromDisk();

      // Action: Select active goal horn
      if (action === "select" && hornId) {
        if (store.horns.some((h) => h.id === hornId)) {
          store.activeHornId = hornId;
          if (store.mixerSettings) {
            store.mixerSettings.activeGoalHornId = hornId;
          }
          store.updatedAt = Date.now();
          saveStoreToDisk(store);
          return res.status(200).json({
            success: true,
            message: `Selected goal horn ${hornId}`,
            activeHornId: store.activeHornId,
            horns: store.horns,
          });
        }
        return res.status(404).json({ error: "Goal horn not found" });
      }

      // Action: Delete custom goal horn
      if (action === "delete" && hornId) {
        if (hornId === "official_pelham") {
          return res.status(400).json({ error: "Cannot delete official Pelham goal horn" });
        }
        store.horns = store.horns.filter((h) => h.id !== hornId);
        if (store.activeHornId === hornId) {
          store.activeHornId = "official_pelham";
          if (store.mixerSettings) {
            store.mixerSettings.activeGoalHornId = "official_pelham";
          }
        }
        store.updatedAt = Date.now();
        saveStoreToDisk(store);
        return res.status(200).json({
          success: true,
          message: "Goal horn deleted",
          activeHornId: store.activeHornId,
          horns: store.horns,
        });
      }

      // Action: Upload new goal horn to library
      const hasNewAudio = Boolean(audioBase64 && typeof audioBase64 === "string" && audioBase64.length > 50);
      let newlyCreated: GoalHornRecord | null = null;

      if (hasNewAudio) {
        const id = body.id || `horn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        newlyCreated = {
          id,
          name: name || filename || "Custom Goal Horn",
          filename: filename || "custom_goal_horn.mp3",
          mimeType: mimeType || "audio/mpeg",
          fileSize: typeof fileSize === "number" ? fileSize : audioBase64.length,
          duration: typeof duration === "number" ? duration : 0,
          audioBase64,
          isDefault: false,
          isBuiltin: false,
          createdAt: Date.now(),
        };

        // Remove existing with same ID if any, and append new one
        store.horns = store.horns.filter((h) => h.id !== id);
        store.horns.push(newlyCreated);
        store.activeHornId = id;
        if (store.mixerSettings) {
          store.mixerSettings.activeGoalHornId = id;
        }
      }

      // Update mixer settings if provided
      if (mixerSettings) {
        store.mixerSettings = {
          ...(store.mixerSettings || DEFAULT_SERVER_STORE.mixerSettings || {}),
          ...mixerSettings,
          activeGoalHornId: store.activeHornId,
        };
      }

      store.updatedAt = Date.now();
      saveStoreToDisk(store);

      const activeHorn = store.horns.find((h) => h.id === store.activeHornId) || store.horns[0];

      return res.status(200).json({
        success: true,
        message: hasNewAudio ? "Goal horn uploaded and added to library" : "Settings updated",
        activeHornId: store.activeHornId,
        activeHorn,
        horns: store.horns,
        newHorn: newlyCreated,
        updatedAt: store.updatedAt,
      });
    } catch (err: any) {
      console.error("Error updating goal horns:", err);
      return res.status(500).json({ error: err?.message || "Failed to process goal horn request" });
    }
  }

  // DELETE: Revert to official Pelham goal horn
  if (req.method === "DELETE") {
    const store = loadStoreFromDisk();
    store.activeHornId = "official_pelham";
    if (store.mixerSettings) {
      store.mixerSettings.activeGoalHornId = "official_pelham";
    }
    store.updatedAt = Date.now();
    saveStoreToDisk(store);

    return res.status(200).json({
      success: true,
      message: "Reverted to official Pelham Pelicans arena goal horn.",
      activeHornId: "official_pelham",
      horns: store.horns,
      updatedAt: store.updatedAt,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
