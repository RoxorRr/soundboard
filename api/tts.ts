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
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        res.status(400).json({ error: "Invalid JSON body", fallback: true });
        return;
      }
    }
    body = body || {};

    const { text, voiceId: reqVoiceId, format: reqFormat, voiceSettings: customSettings } = body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing or invalid 'text' in request body", fallback: true });
      return;
    }

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    const envVoiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

    if (!apiKey) {
      res.status(200).json({
        fallback: true,
        error: "ELEVENLABS_API_KEY is not configured in environment variables",
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
      "X-ElevenLabs-Voice": winningVoiceId
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

