import dotenv from "dotenv";
dotenv.config({ override: true });
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

const TARGET_EMAIL = "richard.repka@gmail.com";

interface TTSUsageEntry {
  id: string;
  timestamp: string;
  charactersUsed: number;
  text: string;
  provider: string;
  voiceId: string;
  clientIp: string;
  userAgent: string;
  deviceSummary: string;
  deviceId: string;
}

interface TTSUsageStorage {
  totalCharacters: number;
  totalAnnouncements: number;
  lastUpdated: string;
  byDevice: Record<string, { deviceSummary: string; count: number; characters: number; lastSeen: string }>;
  recentLogs: TTSUsageEntry[];
}

const STORAGE_PATH = path.join("/tmp", "pelham_speechify_usage_data.json");

let inMemoryStorage: TTSUsageStorage = {
  totalCharacters: 0,
  totalAnnouncements: 0,
  lastUpdated: new Date().toISOString(),
  byDevice: {},
  recentLogs: [],
};

function loadStorage(): TTSUsageStorage {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const raw = fs.readFileSync(STORAGE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalCharacters === "number") {
        inMemoryStorage = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  return inMemoryStorage;
}

function saveStorage(data: TTSUsageStorage): void {
  inMemoryStorage = data;
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (_) {}
}

function getFriendlyDeviceSummary(ua: string, clientInfo?: any): string {
  let dev = "Web Client";
  if (/iPhone/i.test(ua)) dev = "Apple iPhone (iOS)";
  else if (/iPad/i.test(ua)) dev = "Apple iPad (iPadOS)";
  else if (/Macintosh/i.test(ua) || /Mac/i.test(clientInfo?.platform || "")) dev = "Apple Mac (macOS)";
  else if (/Windows/i.test(ua) || /Win/i.test(clientInfo?.platform || "")) dev = "Windows PC";
  else if (/Android/i.test(ua)) dev = "Android Device";
  else if (/CrOS/i.test(ua)) dev = "ChromeOS Device";
  else if (/Linux/i.test(ua)) dev = "Linux Device";
  else if (clientInfo?.platform && clientInfo.platform !== "Unknown") dev = clientInfo.platform;

  let browser = "";
  if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";

  const parts = [dev];
  if (browser) parts.push(browser);
  if (clientInfo?.timeZone && clientInfo.timeZone !== "UTC") {
    const tzClean = clientInfo.timeZone.split("/").pop()?.replace(/_/g, " ") || clientInfo.timeZone;
    parts.push(tzClean);
  }
  return parts.join(" • ");
}

async function sendUsageEmail(entry: TTSUsageEntry, storage: TTSUsageStorage): Promise<boolean> {
  const subject = `[Pelham Arena PA] ${entry.charactersUsed} chars used for TTS (${entry.deviceSummary})`;
  const textBody = `Pelham Pelicans Arena PA - TTS Usage Report\n\nTarget Recipient: ${TARGET_EMAIL}\nTTS Engine: Speechify (Simba 3.2)\nVoice ID: ${entry.voiceId}\nTimestamp: ${entry.timestamp}\n\n1. WHO IS USING THE APP\n• Device: ${entry.deviceSummary}\n• Device ID: ${entry.deviceId}\n• Client IP: ${entry.clientIp}\n• User Agent: ${entry.userAgent}\n\n2. USAGE\n• Characters: ${entry.charactersUsed}\n• Text: "${entry.text}"\n\n3. TOTALS\n• Total Characters: ${storage.totalCharacters.toLocaleString()}\n• Total Announcements: ${storage.totalAnnouncements.toLocaleString()}\n`;

  let delivered = false;

  // 1. Direct FormSubmit HTTP Relay
  try {
    const formSubmitRes = await fetch(`https://formsubmit.co/ajax/${TARGET_EMAIL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        User_Device: entry.deviceSummary,
        Characters_Used: `${entry.charactersUsed} characters`,
        Spoken_Announcement: entry.text,
        Device_ID: entry.deviceId,
        Client_IP: entry.clientIp,
        Voice_ID: entry.voiceId,
        Timestamp: entry.timestamp,
        Cumulative_Total_Characters: `${storage.totalCharacters.toLocaleString()} characters`,
        Cumulative_Announcements: `${storage.totalAnnouncements.toLocaleString()}`,
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (formSubmitRes.ok) {
      console.log(`[UsageReporter] Delivered usage email via FormSubmit relay to ${TARGET_EMAIL}`);
      delivered = true;
    }
  } catch (e: any) {
    // Non-blocking
  }

  // 2. SMTP if configured
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;

  if (smtpHost || (smtpUser && smtpPass)) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: smtpUser || `"Pelham Arena PA" <noreply@pelhampelicans.com>`,
        to: TARGET_EMAIL,
        subject,
        text: textBody,
      });
      console.log(`[UsageReporter] Delivered usage email via SMTP to ${TARGET_EMAIL}`);
      delivered = true;
    } catch (e: any) {
      // Non-blocking
    }
  }

  return delivered;
}

async function recordAndReportTTSUsage(params: {
  charactersUsed: number;
  text: string;
  provider: string;
  voiceId: string;
  clientIp: string;
  userAgent: string;
  clientInfo?: { deviceId?: string; platform?: string; screenResolution?: string };
}): Promise<void> {
  try {
    const storage = loadStorage();
    const count = Math.max(0, params.charactersUsed || params.text.length);
    const deviceSummary = getFriendlyDeviceSummary(params.userAgent, params.clientInfo);
    const deviceId = params.clientInfo?.deviceId || params.clientIp || "device-unknown";

    storage.totalCharacters += count;
    storage.totalAnnouncements += 1;
    storage.lastUpdated = new Date().toISOString();

    if (!storage.byDevice[deviceId]) {
      storage.byDevice[deviceId] = {
        deviceSummary,
        count: 0,
        characters: 0,
        lastSeen: new Date().toISOString(),
      };
    }

    storage.byDevice[deviceId].count += 1;
    storage.byDevice[deviceId].characters += count;
    storage.byDevice[deviceId].deviceSummary = deviceSummary;
    storage.byDevice[deviceId].lastSeen = new Date().toISOString();

    const entry: TTSUsageEntry = {
      id: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleString("en-US", { timeZoneName: "short" }),
      charactersUsed: count,
      text: params.text,
      provider: params.provider,
      voiceId: params.voiceId,
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      deviceSummary,
      deviceId,
    };

    storage.recentLogs.unshift(entry);
    if (storage.recentLogs.length > 50) {
      storage.recentLogs = storage.recentLogs.slice(0, 50);
    }

    saveStorage(storage);
    sendUsageEmail(entry, storage).catch(() => {});
  } catch (err: any) {
    console.warn("[UsageReporter] Error recording TTS usage:", err?.message);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString("utf8"));
      } catch {
        body = {};
      }
    } else if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        res.status(400).json({ error: "Invalid JSON body", fallback: true });
        return;
      }
    }
    body = body || {};

    const {
      text,
      provider: reqProvider,
      voiceId: reqVoiceId,
      model: reqModel,
      format: reqFormat,
      voiceSettings: customSettings,
      cartesiaSettings,
      speechifySettings,
    } = body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing or invalid 'text' in request body", fallback: true });
      return;
    }

    const provider = (reqProvider || "speechify").toLowerCase();

    // ==========================================
    // PROVIDER 1: CARTESIA SONIC TTS (MULTI-ACCOUNT)
    // ==========================================
    if (provider === "cartesia") {
      const account1ApiKey = (process.env.CARTESIA_API_KEY || process.env.CARTESIA_KEY || process.env.CARTESIA_API_KEY_1)?.trim();
      const rawVoice1 = (process.env.CARTESIA_VOICE_ID || process.env.CARTESIA_VOICE || process.env.CARTESIA_VOICE_ID_1)?.trim();
      const account1VoiceId = rawVoice1 && !rawVoice1.startsWith("sk_") ? rawVoice1 : "";

      const rawVoice2 = (process.env.CARTESIA_VOICE_ID_2 || process.env.CARTESIA_SECOND_VOICE_ID || process.env.CARTESIA_VOICE_2)?.trim();
      const account2ApiKey = (process.env.CARTESIA_API_KEY_2 || process.env.CARTESIA_SECOND_API_KEY || process.env.CARTESIA_KEY_2 || (rawVoice2 && rawVoice2.startsWith("sk_") ? rawVoice2 : ""))?.trim();
      const account2VoiceId = rawVoice2 && !rawVoice2.startsWith("sk_") ? rawVoice2 : "";

      if (!account1ApiKey && !account2ApiKey) {
        res.status(200).json({
          fallback: true,
          provider: "cartesia",
          error: "Cartesia API Key is not configured in environment variables. Add CARTESIA_API_KEY (Account 1) or CARTESIA_API_KEY_2 (Account 2) in your Project Settings > Environment Variables.",
          voiceId: cartesiaSettings?.voiceId || account1VoiceId || account2VoiceId || "a27f2ab7-6793-4893-9f40-e50d5e5605ba",
        });
        return;
      }

      interface CartesiaAccountTarget {
        id: "account1" | "account2";
        label: string;
        apiKey: string;
        defaultVoiceId: string;
      }

      const availableAccounts: CartesiaAccountTarget[] = [];
      if (account1ApiKey) {
        availableAccounts.push({
          id: "account1",
          label: "Account 1 (Primary)",
          apiKey: account1ApiKey,
          defaultVoiceId: account1VoiceId || "a27f2ab7-6793-4893-9f40-e50d5e5605ba",
        });
      }
      if (account2ApiKey) {
        availableAccounts.push({
          id: "account2",
          label: "Account 2 (Secondary)",
          apiKey: account2ApiKey,
          defaultVoiceId: account2VoiceId || account1VoiceId || "a27f2ab7-6793-4893-9f40-e50d5e5605ba",
        });
      }

      const reqAccountMode = cartesiaSettings?.accountMode || "auto";
      let targetAccounts: CartesiaAccountTarget[] = [];

      if (reqAccountMode === "account2") {
        // Preferred Account 2, fall back to Account 1 if available
        targetAccounts = [
          ...availableAccounts.filter((a) => a.id === "account2"),
          ...availableAccounts.filter((a) => a.id === "account1"),
        ];
      } else if (reqAccountMode === "account1") {
        // Preferred Account 1, fall back to Account 2 if available
        targetAccounts = [
          ...availableAccounts.filter((a) => a.id === "account1"),
          ...availableAccounts.filter((a) => a.id === "account2"),
        ];
      } else {
        // 'auto' pool: try Account 1 first, then failover to Account 2
        targetAccounts = [
          ...availableAccounts.filter((a) => a.id === "account1"),
          ...availableAccounts.filter((a) => a.id === "account2"),
        ];
        if (targetAccounts.length === 0 && availableAccounts.length > 0) {
          targetAccounts = availableAccounts;
        }
      }

      const customVoice1 = (cartesiaSettings?.voiceIdAccount1 || "").trim();
      const customVoice2 = (cartesiaSettings?.voiceIdAccount2 || "").trim();
      const userCartesiaVoice = (cartesiaSettings?.voiceId || reqVoiceId || "").trim();
      const preferredModel = cartesiaSettings?.modelId || reqModel || "sonic-3.5";
      const modelsToTry = [preferredModel, "sonic-3.6", "sonic-2", "sonic-english", "sonic"].filter((m, i, arr) => arr.indexOf(m) === i);

      const speed = typeof cartesiaSettings?.speed === "number"
        ? Math.max(0.6, Math.min(1.5, cartesiaSettings.speed))
        : 1.05;
      const emotion = cartesiaSettings?.emotion || "excited";

      let successfulAudioBuffer: ArrayBuffer | null = null;
      let winningAccount: CartesiaAccountTarget = targetAccounts[0] || {
        id: "account1",
        label: "Account 1",
        apiKey: "",
        defaultVoiceId: "694f9389-aac1-45b6-b726-9d9369183238",
      };
      let winningVoiceId = "694f9389-aac1-45b6-b726-9d9369183238";
      let winningMime = "audio/mpeg";
      let lastStatus = 0;
      let lastErrorDetails = "";
      const attemptedAccounts: string[] = [];

      for (const account of targetAccounts) {
        attemptedAccounts.push(account.label);

        // Build Cartesia voice candidates tailored to this specific account
        const cartesiaCandidates: string[] = [];

        const isValidVoiceUuid = (v?: string) => Boolean(v && v.trim() && !v.startsWith("sk_") && v.toLowerCase() !== "nhl");

        if (account.id === "account1") {
          // Account 1 priority: specific Account 1 custom UUID -> user requested voice -> account 1 env voice
          if (isValidVoiceUuid(customVoice1)) cartesiaCandidates.push(customVoice1);
          if (isValidVoiceUuid(userCartesiaVoice) && userCartesiaVoice !== customVoice1) {
            cartesiaCandidates.push(userCartesiaVoice);
          }
          if (isValidVoiceUuid(account.defaultVoiceId)) cartesiaCandidates.push(account.defaultVoiceId);
        } else if (account.id === "account2") {
          // Account 2 priority: specific Account 2 custom UUID -> account 2 env voice -> account 1 custom UUID -> user requested voice
          if (isValidVoiceUuid(customVoice2)) cartesiaCandidates.push(customVoice2);
          if (isValidVoiceUuid(account2VoiceId)) cartesiaCandidates.push(account2VoiceId);
          if (isValidVoiceUuid(account.defaultVoiceId) && account.defaultVoiceId !== account2VoiceId) cartesiaCandidates.push(account.defaultVoiceId);
          if (isValidVoiceUuid(customVoice1) && customVoice1 !== customVoice2) {
            cartesiaCandidates.push(customVoice1);
          }
          if (isValidVoiceUuid(userCartesiaVoice)) {
            cartesiaCandidates.push(userCartesiaVoice);
          }
        }

        // Standard Cartesia Arena presets as bulletproof fallbacks
        cartesiaCandidates.push("694f9389-aac1-45b6-b726-9d9369183238"); // Barbershop Man / Announcer (Male, Deep & Confident)
        cartesiaCandidates.push("47c38ca4-5f35-497b-b1a3-415245fb35e1"); // Daniel (Male, Clear & Natural)
        cartesiaCandidates.push("a167e0f3-df7e-4d52-a9c3-f949145efdab"); // Commercial / Promo Man
        cartesiaCandidates.push("db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"); // Skylar (Female, Expressive)

        const uniqueCartesiaVoices = Array.from(new Set(cartesiaCandidates.filter(Boolean))).filter((v) => !v.startsWith("sk_"));

        for (const voiceCandidate of uniqueCartesiaVoices) {
          for (const modelCandidate of modelsToTry) {
            try {
              // Attempt 1: MP3 container
              const payload: Record<string, any> = {
                model_id: modelCandidate,
                transcript: text,
                voice: {
                  mode: "id",
                  id: voiceCandidate,
                },
                output_format: {
                  container: "mp3",
                  sample_rate: 44100,
                },
                language: "en",
              };

              if (speed && speed !== 1.0) {
                payload.generation_config = { speed };
                if (emotion && emotion !== "neutral") {
                  payload.generation_config.emotion = emotion;
                }
              }

              let response = await fetch("https://api.cartesia.ai/tts/bytes", {
                method: "POST",
                headers: {
                  "X-API-Key": account.apiKey,
                  "Cartesia-Version": "2024-06-10",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });

              // If container mp3 or generation_config caused 400 error, retry with WAV and stripped generation_config
              if (response.status === 400) {
                const retryPayload = {
                  model_id: modelCandidate,
                  transcript: text,
                  voice: {
                    mode: "id",
                    id: voiceCandidate,
                  },
                  output_format: {
                    container: "wav",
                    encoding: "pcm_s16le",
                    sample_rate: 44100,
                  },
                  language: "en",
                };
                response = await fetch("https://api.cartesia.ai/tts/bytes", {
                  method: "POST",
                  headers: {
                    "X-API-Key": account.apiKey,
                    "Cartesia-Version": "2024-06-10",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(retryPayload),
                });
                if (response.ok) {
                  winningMime = "audio/wav";
                }
              }

              if (response.ok) {
                successfulAudioBuffer = await response.arrayBuffer();
                winningAccount = account;
                winningVoiceId = voiceCandidate;
                const respContentType = response.headers.get("content-type") || "";
                if (respContentType.includes("wav")) winningMime = "audio/wav";
                break;
              }

              lastStatus = response.status;
              lastErrorDetails = await response.text();

              // If account-level limit/auth failure (401, 402, 429), stop trying other voices on this account
              if (response.status === 401 || response.status === 402 || response.status === 429) {
                console.warn(`Cartesia ${account.label} error (${response.status}): ${lastErrorDetails}. Failing over if backup account is available...`);
                break;
              }
            } catch (err: any) {
              console.warn(`Cartesia attempt error for ${account.label} (voice ${voiceCandidate} on ${modelCandidate}):`, err?.message);
              lastErrorDetails = err?.message || String(err);
            }
          }
          if (successfulAudioBuffer || lastStatus === 401 || lastStatus === 402 || lastStatus === 429) {
            break;
          }
        }

        if (successfulAudioBuffer) {
          break; // Audio synthesized successfully
        }
      }

      if (!successfulAudioBuffer) {
        let userFriendlyError = "Cartesia Sonic speech synthesis failed";
        if (lastStatus === 401) {
          userFriendlyError = `Cartesia API key unauthorized or invalid (401) on ${attemptedAccounts.join(", ")}. Verify CARTESIA_API_KEY / CARTESIA_API_KEY_2.`;
        } else if (lastStatus === 429 || lastStatus === 402 || lastErrorDetails.toLowerCase().includes("quota") || lastErrorDetails.toLowerCase().includes("credit")) {
          userFriendlyError = `Cartesia credit or quota limit reached on ${attemptedAccounts.join(", ")}. Falling back to local voice.`;
        } else if (lastStatus === 404) {
          userFriendlyError = "Cartesia voice or model could not be found (404). Falling back to local voice.";
        } else if (lastErrorDetails) {
          try {
            const parsed = JSON.parse(lastErrorDetails);
            userFriendlyError = parsed.message || parsed.error || userFriendlyError;
          } catch {
            userFriendlyError = lastErrorDetails.slice(0, 160) || userFriendlyError;
          }
        }

        res.status(200).json({
          fallback: true,
          provider: "cartesia",
          error: userFriendlyError,
          details: lastErrorDetails,
          voiceId: winningVoiceId,
          status: lastStatus,
          attemptedAccounts,
        });
        return;
      }

      const buffer = Buffer.from(successfulAudioBuffer);
      const wantsBase64 = reqFormat === "base64" || req.headers["accept"]?.includes("application/json");

      if (wantsBase64) {
        res.status(200).json({
          success: true,
          provider: "cartesia",
          audioBase64: buffer.toString("base64"),
          mimeType: winningMime,
          voiceId: winningVoiceId,
          cartesiaAccount: winningAccount.id,
          cartesiaAccountLabel: winningAccount.label,
          size: buffer.length,
        });
        return;
      }

      res.writeHead(200, {
        "Content-Type": winningMime,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "X-Cartesia-Voice": winningVoiceId,
        "X-Cartesia-Account": winningAccount.id,
        "X-TTS-Provider": "cartesia",
      });
      res.end(buffer);
      return;
    }

    // ==========================================
    // PROVIDER 2: SPEECHIFY / SPEECHITY TTS
    // ==========================================
    if (provider === "speechify" || provider === "speechity") {
      // 1. Comprehensive API key discovery across Vercel / Cloud environments
      const speechifyKeyCandidates = [
        process.env.SPEECHIFY_API_KEY,
        process.env.SPEECHIFY_KEY,
        process.env.SPEECHIFY_SECRET_KEY,
        process.env.SPEECHIFY_TOKEN,
        process.env.SPEECHITY_API_KEY,
        process.env.SPEECHITY_KEY,
        process.env.SPEECHIFY_ID,
        process.env.SPEECHIFY_APIKEY,
        process.env.VITE_SPEECHIFY_API_KEY,
        process.env.VITE_SPEECHIFY_KEY,
        process.env.VITE_SPEECHITY_API_KEY,
        process.env.NEXT_PUBLIC_SPEECHIFY_API_KEY,
        speechifySettings?.apiKey,
        "sk_myrwfk72sn1zdgmqb3z2s2yfxhrznygvy6hcvzjga7n",
      ];

      const rawKey = speechifyKeyCandidates
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .find((k) => k.length > 5);

      let speechifyApiKey = rawKey
        ? rawKey.replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "").trim()
        : "";

      // 2. Comprehensive Voice ID discovery from environment variables
      const envVoiceCandidates = [
        process.env.SPEECHIFY_VOICE_ID,
        process.env.SPEECHIFY_CUSTOM_VOICE_ID,
        process.env.SPEECHIFY_CLONED_VOICE_ID,
        process.env.SPEECHIFY_PERSONAL_VOICE_ID,
        process.env.SPEECHIFY_VOICE,
        process.env.SPEECHITY_VOICE_ID,
        process.env.CUSTOM_VOICE_ID,
        process.env.VOICE_ID,
        process.env.VITE_SPEECHIFY_VOICE_ID,
        process.env.VITE_CUSTOM_VOICE_ID,
        process.env.VITE_VOICE_ID,
        process.env.NEXT_PUBLIC_SPEECHIFY_VOICE_ID,
      ];

      const rawEnvVoice = envVoiceCandidates
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .find((v) => v.length > 0) || "";
      const envVoice = rawEnvVoice.replace(/^["']|["']$/g, "").trim();

      const userVoice = (speechifySettings?.voiceId || reqVoiceId || "").replace(/^["']|["']$/g, "").trim();
      const defaultVoice = "cf2bbc5b-59fb-427e-95a5-bcd76641852f";

      if (!speechifyApiKey) {
        res.status(200).json({
          fallback: true,
          provider: "speechify",
          error: "Speechify API Key is not configured on Vercel. Add SPEECHIFY_API_KEY in Vercel Project Settings > Environment Variables, then click Redeploy.",
          voiceId: userVoice || envVoice || defaultVoice,
        });
        return;
      }

      let authHeader = `Bearer ${speechifyApiKey}`;

      // 3. Dynamically discover Personal / Cloned voices created in user's Speechify workspace
      let workspacePersonalVoices: Array<{ id: string; name: string; models: string[] }> = [];
      try {
        const vRes = await fetch("https://api.sws.speechify.com/v1/voices", {
          headers: { Authorization: authHeader, Accept: "application/json" },
          signal: AbortSignal.timeout(3500),
        });
        if (vRes.ok) {
          const vData: any = await vRes.json();
          const list: any[] = Array.isArray(vData) ? vData : vData?.voices || [];
          const personalList = list.filter(
            (v: any) =>
              v.type === "personal" ||
              v.can_manage === true ||
              v.type !== "shared" ||
              v.is_cloned ||
              v.cloned ||
              v.category === "cloned" ||
              v.is_custom
          );
          workspacePersonalVoices = personalList.map((v: any) => ({
            id: v.id || v.voice_id,
            name: v.display_name || v.name || v.id,
            models: Array.isArray(v.models) ? v.models.map((m: any) => m.name || m) : ["simba-3.2"],
          }));
          if (workspacePersonalVoices.length > 0) {
            console.log(
              `[Speechify] Discovered ${workspacePersonalVoices.length} workspace personal voice(s):`,
              workspacePersonalVoices.map((p) => `${p.name} (${p.id})`)
            );
          }
        }
      } catch (err: any) {
        console.warn("[Speechify] Workspace voice discovery skipped:", err?.message);
      }

      // 4. Resolve the candidate voices to attempt (ordered by priority)
      const candidateList: Array<{ id: string; model?: string }> = [];

      // Helper to match voice by name or ID against discovered personal voices
      const resolveVoiceOrPersonal = (input: string) => {
        if (!input) return null;
        const matched = workspacePersonalVoices.find(
          (p) =>
            p.id.toLowerCase() === input.toLowerCase() ||
            p.name.toLowerCase() === input.toLowerCase()
        );
        if (matched) {
          return { id: matched.id, model: matched.models.includes("simba-3.2") ? "simba-3.2" : matched.models[0] };
        }
        return { id: input };
      };

      // Priority 1: User explicitly chosen voice
      if (userVoice) {
        const resolved = resolveVoiceOrPersonal(userVoice);
        if (resolved) candidateList.push(resolved);
      }

      // Priority 2: Vercel environment voice setting
      if (envVoice) {
        const resolved = resolveVoiceOrPersonal(envVoice);
        if (resolved) candidateList.push(resolved);
      }

      // Priority 3: First personal voice discovered in workspace
      if (workspacePersonalVoices.length > 0) {
        workspacePersonalVoices.forEach((pv) => {
          candidateList.push({
            id: pv.id,
            model: pv.models.includes("simba-3.2") ? "simba-3.2" : pv.models[0],
          });
        });
      }

      // Priority 4: Default Pelham custom NHL clone
      candidateList.push({ id: defaultVoice, model: "simba-3.2" });

      // Priority 5: Stock high-energy catalog announcer voices as graceful fallbacks
      candidateList.push({ id: "geffen_32", model: "simba-3.2" });
      candidateList.push({ id: "dominic_32", model: "simba-3.2" });
      candidateList.push({ id: "kristy", model: "simba-3.2" });

      // Deduplicate candidate voices
      const seenIds = new Set<string>();
      const uniqueCandidates = candidateList.filter((c) => {
        if (!c.id || seenIds.has(c.id.toLowerCase())) return false;
        seenIds.add(c.id.toLowerCase());
        return true;
      });

      const endpoint = "https://api.sws.speechify.com/v1/audio/speech";
      let successfulAudioBuffer: ArrayBuffer | null = null;
      let winningVoiceId = uniqueCandidates[0]?.id || defaultVoice;
      let winningMime = "audio/mpeg";
      let lastStatus = 0;
      let lastErrorDetails = "";

      // 5. Attempt synthesis sequentially with quick failover (max 3 candidate attempts to guarantee fast response)
      for (const candidate of uniqueCandidates.slice(0, 3)) {
        const modelToTry = candidate.model || speechifySettings?.model || reqModel || "simba-3.2";
        try {
          const payload: Record<string, any> = {
            input: text,
            voice_id: candidate.id,
            audio_format: "mp3",
          };
          if (modelToTry) {
            payload.model = modelToTry;
          }

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
              Accept: "application/json, audio/mpeg",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(6000),
          });

          if (response.ok) {
            const respContentType = response.headers.get("content-type") || "";
            if (respContentType.includes("application/json")) {
              const data: any = await response.json();
              const base64Str = data.audio_data || data.audioContent || data.audio_content || data.audio;
              if (base64Str) {
                const buf = Buffer.from(base64Str, "base64");
                successfulAudioBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
                winningVoiceId = candidate.id;
                winningMime = "audio/mpeg";
                console.log(`[Speechify] Synthesized voice ${candidate.id} (${modelToTry})`);
                break;
              }
            } else {
              successfulAudioBuffer = await response.arrayBuffer();
              winningVoiceId = candidate.id;
              winningMime = respContentType.includes("wav") ? "audio/wav" : "audio/mpeg";
              console.log(`[Speechify] Synthesized binary stream for voice ${candidate.id}`);
              break;
            }
          }

          lastStatus = response.status;
          lastErrorDetails = await response.text();
          console.warn(`[Speechify] Candidate ${candidate.id} status ${lastStatus}: ${lastErrorDetails.slice(0, 140)}`);

          // If unauthorized (401), try failing over to the verified active key if different
          const verifiedBackupKey = "sk_myrwfk72sn1zdgmqb3z2s2yfxhrznygvy6hcvzjga7n";
          if (response.status === 401 && speechifyApiKey !== verifiedBackupKey) {
            console.warn(`[Speechify] Primary key was unauthorized (401). Retrying candidate ${candidate.id} with verified key.`);
            authHeader = `Bearer ${verifiedBackupKey}`;
            speechifyApiKey = verifiedBackupKey;
            try {
              const backupRes = await fetch(endpoint, {
                method: "POST",
                headers: {
                  Authorization: authHeader,
                  "Content-Type": "application/json",
                  Accept: "application/json, audio/mpeg",
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(6000),
              });
              if (backupRes.ok) {
                const bContentType = backupRes.headers.get("content-type") || "";
                if (bContentType.includes("application/json")) {
                  const bData: any = await backupRes.json();
                  const b64 = bData.audio_data || bData.audioContent || bData.audio_content || bData.audio;
                  if (b64) {
                    const buf = Buffer.from(b64, "base64");
                    successfulAudioBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
                    winningVoiceId = candidate.id;
                    winningMime = "audio/mpeg";
                    console.log(`[Speechify] Synthesized voice ${candidate.id} using verified key`);
                    break;
                  }
                } else {
                  successfulAudioBuffer = await backupRes.arrayBuffer();
                  winningVoiceId = candidate.id;
                  winningMime = bContentType.includes("wav") ? "audio/wav" : "audio/mpeg";
                  break;
                }
              } else {
                lastStatus = backupRes.status;
                lastErrorDetails = await backupRes.text();
              }
            } catch (err: any) {
              console.warn("[Speechify] Failover key attempt error:", err?.message);
            }
          }

          // If quota limit (402, 429) or still 401 after failover, stop
          if (lastStatus === 401 || lastStatus === 402 || lastStatus === 429) {
            break;
          }

          // If 400 (model issue), retry once without specifying the model field
          if (response.status === 400 && payload.model) {
            delete payload.model;
            const retryRes = await fetch(endpoint, {
              method: "POST",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(5000),
            });
            if (retryRes.ok) {
              const retryData: any = await retryRes.json();
              const b64 = retryData.audio_data || retryData.audioContent || retryData.audio;
              if (b64) {
                const buf = Buffer.from(b64, "base64");
                successfulAudioBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
                winningVoiceId = candidate.id;
                winningMime = "audio/mpeg";
                break;
              }
            }
          }
        } catch (err: any) {
          lastErrorDetails = err?.message || String(err);
          console.warn(`[Speechify] Candidate ${candidate.id} request error:`, lastErrorDetails);
        }
      }

      if (!successfulAudioBuffer) {
        let userFriendlyError = "Speechify speech synthesis failed";
        if (lastStatus === 401) {
          userFriendlyError = "Speechify API key is invalid or unauthorized (401). Verify SPEECHIFY_API_KEY in Vercel Project Settings > Environment Variables, and Redeploy.";
        } else if (lastStatus === 429 || lastStatus === 402 || lastErrorDetails.toLowerCase().includes("quota") || lastErrorDetails.toLowerCase().includes("credit")) {
          userFriendlyError = "Speechify character quota or credit limit reached (429/402). Falling back to browser audio.";
        } else if (lastStatus === 404) {
          userFriendlyError = `Speechify voice ID '${winningVoiceId}' was not found in your Speechify workspace. Check voice ID or select from discovered personal voices in Settings.`;
        } else if (lastErrorDetails) {
          try {
            const parsed = JSON.parse(lastErrorDetails);
            userFriendlyError = parsed.message || parsed.error?.message || parsed.error || userFriendlyError;
          } catch {
            userFriendlyError = lastErrorDetails.slice(0, 160) || userFriendlyError;
          }
        }

        res.status(200).json({
          fallback: true,
          provider: "speechify",
          error: userFriendlyError,
          details: lastErrorDetails,
          voiceId: winningVoiceId,
          status: lastStatus,
        });
        return;
      }

      const buffer = Buffer.from(successfulAudioBuffer);

      // Asynchronously track character usage and notify richard.repka@gmail.com
      const clientInfo = body.clientInfo || {};
      const clientIp = (req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "Unknown")
        .toString()
        .split(",")[0]
        .trim();
      const userAgent = req.headers["user-agent"] || clientInfo.userAgent || "Unknown";
      recordAndReportTTSUsage({
        charactersUsed: text.length,
        text,
        provider: "speechify",
        voiceId: winningVoiceId,
        clientIp,
        userAgent,
        clientInfo,
      }).catch((e) => console.warn("[TTS] Usage record error:", e));

      const wantsBase64 = reqFormat === "base64" || req.headers["accept"]?.includes("application/json");

      if (wantsBase64) {
        res.status(200).json({
          success: true,
          provider: "speechify",
          audioBase64: buffer.toString("base64"),
          mimeType: winningMime,
          voiceId: winningVoiceId,
          size: buffer.length,
        });
        return;
      }

      res.writeHead(200, {
        "Content-Type": winningMime,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "X-Speechify-Voice": winningVoiceId,
        "X-TTS-Provider": "speechify",
      });
      res.end(buffer);
      return;
    }

    // ==========================================
    // PROVIDER 3: ELEVENLABS TTS (DEFAULT)
    // ==========================================
    const apiKey = (process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY)?.trim();
    const envVoiceId = (process.env.ELEVENLABS_VOICE_ID || process.env.ELEVEN_LABS_VOICE_ID)?.trim();

    if (!apiKey) {
      res.status(200).json({
        fallback: true,
        provider: "elevenlabs",
        error: "ELEVENLABS_API_KEY is not configured in Vercel environment variables. Add ELEVENLABS_API_KEY in Vercel Project Settings > Environment Variables.",
        voiceId: envVoiceId || "nhl"
      });
      return;
    }

    // Parse fine-tuned voice parameters
    const speed = typeof customSettings?.speed === "number" ? Math.max(0.7, Math.min(1.25, customSettings.speed)) : 1.0;
    const stability = typeof customSettings?.stability === "number" ? Math.max(0.0, Math.min(1.0, customSettings.stability)) : 0.45;
    const similarityBoost = typeof customSettings?.similarity_boost === "number" ? Math.max(0.0, Math.min(1.0, customSettings.similarity_boost)) : 0.85;
    const style = typeof customSettings?.style === "number" ? Math.max(0.0, Math.min(1.0, customSettings.style)) : 0.60;
    const useSpeakerBoost = typeof customSettings?.use_speaker_boost === "boolean" ? customSettings.use_speaker_boost : true;

    // Build voice candidates: user requested -> env configured -> custom NHL Pelham -> universal premade voices
    const userVoiceId = reqVoiceId && reqVoiceId.toLowerCase() !== "nhl" ? reqVoiceId.trim() : null;
    const candidates: string[] = [];
    if (userVoiceId) candidates.push(userVoiceId);
    if (envVoiceId) candidates.push(envVoiceId);
    // Custom Pelham NHL voice
    candidates.push("6j98Cb2txyqvHRXeRQYZ");
    // Universal premade ElevenLabs voices available on all free/paid accounts
    candidates.push("pNInz6obpgDQGcFmaJgB"); // Adam (Deep male narrator / sports voice)
    candidates.push("VR6AewLTigWG4xSOukaG"); // Arnold (Crisp male announcer)
    candidates.push("ErXwobaYiN019PkySvjV"); // Antoni (Energetic youth announcer)
    candidates.push("JBFqnCBsd6RMkjVDRZzb"); // George (Classic narrator)

    // Deduplicate
    const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));

    let successfulAudioBuffer: ArrayBuffer | null = null;
    let winningVoiceId = uniqueCandidates[0];
    let lastStatus = 0;
    let lastErrorDetails = "";

    for (const candidate of uniqueCandidates) {
      try {
        const payload: Record<string, any> = {
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost,
            speed
          }
        };

        let response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(candidate)}`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
          },
          body: JSON.stringify(payload)
        });

        // If ElevenLabs model/voice rejects the 'speed' property (400 validation error), retry without speed
        if (response.status === 400 && payload.voice_settings.speed !== undefined) {
          delete payload.voice_settings.speed;
          response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(candidate)}`, {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              "Accept": "audio/mpeg"
            },
            body: JSON.stringify(payload)
          });
        }

        if (response.ok) {
          successfulAudioBuffer = await response.arrayBuffer();
          winningVoiceId = candidate;
          break;
        }

        lastStatus = response.status;
        lastErrorDetails = await response.text();

        // If 404 (voice not found on this account), try next candidate
        if (response.status === 404) {
          console.warn(`ElevenLabs voice '${candidate}' not found (404), trying next voice candidate...`);
          continue;
        }

        // If 401 (invalid key), 429 (quota exceeded), or 402, abort voice loop as it affects the entire account
        if (response.status === 401 || response.status === 429 || response.status === 402) {
          break;
        }
      } catch (err: any) {
        console.warn(`Error trying ElevenLabs voice '${candidate}':`, err?.message);
        lastErrorDetails = err?.message || String(err);
      }
    }

    if (!successfulAudioBuffer) {
      let userFriendlyError = "ElevenLabs speech synthesis failed";
      if (lastStatus === 401) {
        userFriendlyError = "ElevenLabs API key is unauthorized or invalid (401). Verify ELEVENLABS_API_KEY in Vercel.";
      } else if (lastStatus === 429 || lastStatus === 402 || lastErrorDetails.toLowerCase().includes("quota")) {
        userFriendlyError = "ElevenLabs character quota exceeded on your account. Falling back to local voice.";
      } else if (lastStatus === 404) {
        userFriendlyError = "ElevenLabs voice could not be loaded (404). Falling back to local voice.";
      } else if (lastErrorDetails) {
        try {
          const parsed = JSON.parse(lastErrorDetails);
          userFriendlyError = parsed.detail?.message || parsed.message || userFriendlyError;
        } catch {
          userFriendlyError = lastErrorDetails.slice(0, 160) || userFriendlyError;
        }
      }

      res.status(200).json({
        fallback: true,
        provider: "elevenlabs",
        error: userFriendlyError,
        details: lastErrorDetails,
        voiceId: winningVoiceId,
        status: lastStatus
      });
      return;
    }

    const buffer = Buffer.from(successfulAudioBuffer);
    const wantsBase64 = reqFormat === "base64" || req.headers["accept"]?.includes("application/json");

    if (wantsBase64) {
      res.status(200).json({
        success: true,
        provider: "elevenlabs",
        audioBase64: buffer.toString("base64"),
        mimeType: "audio/mpeg",
        voiceId: winningVoiceId,
        size: buffer.length
      });
      return;
    }

    // Binary streaming response with explicit content headers
    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
      "X-ElevenLabs-Voice": winningVoiceId,
      "X-TTS-Provider": "elevenlabs",
    });
    res.end(buffer);
  } catch (err: any) {
    console.error("TTS endpoint error:", err);
    res.status(200).json({
      fallback: true,
      error: err?.message || "Internal server error during speech synthesis"
    });
  }
}

