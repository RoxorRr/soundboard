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

    const {
      text,
      provider: reqProvider,
      account: reqAccount, // 'account1' | 'account2' for Cartesia
      voiceId: reqVoiceId,
      model: reqModel,
      format: reqFormat,
      voiceSettings: customSettings,
      cartesiaSettings,
    } = body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing or invalid 'text' in request body", fallback: true });
      return;
    }

    const provider = (reqProvider || "elevenlabs").toLowerCase();

    // ==========================================
    // PROVIDER 1: CARTESIA SONIC TTS
    // ==========================================
    if (provider === "cartesia") {
      const isAccount2 = reqAccount === "account2";
      const cartesiaApiKey = isAccount2
        ? (process.env.CARTESIA_API_KEY_2 || process.env.CARTESIA_KEY_2)?.trim()
        : (process.env.CARTESIA_API_KEY || process.env.CARTESIA_KEY)?.trim();
      const envCartesiaVoiceId = (process.env.CARTESIA_VOICE_ID || process.env.CARTESIA_VOICE)?.trim();

      if (!cartesiaApiKey) {
        const errorMsg = isAccount2
          ? "CARTESIA_API_KEY_2 (Account 2) is not configured in Environment Variables. Add CARTESIA_API_KEY_2 or switch to Account 1."
          : "CARTESIA_API_KEY (Account 1) is not configured in Environment Variables. Add CARTESIA_API_KEY.";
        res.status(200).json({
          fallback: true,
          provider: "cartesia",
          account: isAccount2 ? "account2" : "account1",
          error: errorMsg,
          voiceId: cartesiaSettings?.voiceId || envCartesiaVoiceId || "694f9389-aac1-45b6-b726-9d9369183238",
        });
        return;
      }

      // Build Cartesia voice candidates: user requested -> env configured -> top arena presets
      const userCartesiaVoice = (cartesiaSettings?.voiceId || reqVoiceId || "").trim();
      const cartesiaCandidates: string[] = [];
      if (userCartesiaVoice && userCartesiaVoice.toLowerCase() !== "nhl") cartesiaCandidates.push(userCartesiaVoice);
      if (envCartesiaVoiceId) cartesiaCandidates.push(envCartesiaVoiceId);
      cartesiaCandidates.push("694f9389-aac1-45b6-b726-9d9369183238"); // Barbershop Man / Announcer (Male, Deep & Confident)
      cartesiaCandidates.push("47c38ca4-5f35-497b-b1a3-415245fb35e1"); // Daniel (Male, Clear & Natural)
      cartesiaCandidates.push("a167e0f3-df7e-4d52-a9c3-f949145efdab"); // Commercial / Promo Man
      cartesiaCandidates.push("db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"); // Skylar (Female, Expressive)

      const uniqueCartesiaVoices = Array.from(new Set(cartesiaCandidates.filter(Boolean)));
      const preferredModel = cartesiaSettings?.modelId || reqModel || "sonic-3.5";
      const modelsToTry = [preferredModel, "sonic-3.6", "sonic-2", "sonic-english", "sonic"].filter((m, i, arr) => arr.indexOf(m) === i);

      const speed = typeof cartesiaSettings?.speed === "number"
        ? Math.max(0.6, Math.min(1.5, cartesiaSettings.speed))
        : 1.05;
      const emotion = cartesiaSettings?.emotion || "excited";

      let successfulAudioBuffer: ArrayBuffer | null = null;
      let winningVoiceId = uniqueCartesiaVoices[0];
      let winningMime = "audio/mpeg";
      let lastStatus = 0;
      let lastErrorDetails = "";

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
                "X-API-Key": cartesiaApiKey,
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
                  "X-API-Key": cartesiaApiKey,
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
              winningVoiceId = voiceCandidate;
              const respContentType = response.headers.get("content-type") || "";
              if (respContentType.includes("wav")) winningMime = "audio/wav";
              break;
            }

            lastStatus = response.status;
            lastErrorDetails = await response.text();

            if (response.status === 401 || response.status === 402 || response.status === 429) {
              break;
            }
          } catch (err: any) {
            console.warn(`Cartesia attempt error for voice ${voiceCandidate} on ${modelCandidate}:`, err?.message);
            lastErrorDetails = err?.message || String(err);
          }
        }
        if (successfulAudioBuffer || lastStatus === 401 || lastStatus === 402 || lastStatus === 429) {
          break;
        }
      }

      if (!successfulAudioBuffer) {
        const accountLabel = isAccount2 ? "Cartesia Account 2" : "Cartesia Account 1";
        let userFriendlyError = `${accountLabel} Sonic speech synthesis failed`;
        if (lastStatus === 401) {
          userFriendlyError = `${accountLabel} API key is unauthorized or invalid (401). Verify ${isAccount2 ? 'CARTESIA_API_KEY_2' : 'CARTESIA_API_KEY'} in environment.`;
        } else if (lastStatus === 429 || lastStatus === 402 || lastErrorDetails.toLowerCase().includes("quota") || lastErrorDetails.toLowerCase().includes("credit")) {
          userFriendlyError = `${accountLabel} credits or quota limit reached on your account. Switch to your other Cartesia account or local voice.`;
        } else if (lastStatus === 404) {
          userFriendlyError = `${accountLabel} voice or model could not be found (404). Falling back to local voice.`;
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
          account: isAccount2 ? "account2" : "account1",
          error: userFriendlyError,
          details: lastErrorDetails,
          voiceId: winningVoiceId,
          status: lastStatus,
        });
        return;
      }

      const buffer = Buffer.from(successfulAudioBuffer);
      const wantsBase64 = reqFormat === "base64" || req.headers["accept"]?.includes("application/json");

      if (wantsBase64) {
        res.status(200).json({
          success: true,
          provider: "cartesia",
          account: isAccount2 ? "account2" : "account1",
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
        "X-Cartesia-Voice": winningVoiceId,
        "X-Cartesia-Account": isAccount2 ? "account2" : "account1",
        "X-TTS-Provider": "cartesia",
      });
      res.end(buffer);
      return;
    }

    // ==========================================
    // PROVIDER 2: ELEVENLABS TTS (DEFAULT)
    // ==========================================
    const apiKey = (process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY)?.trim();
    const envVoiceId = (process.env.ELEVENLABS_VOICE_ID || process.env.ELEVEN_LABS_VOICE_ID)?.trim();

    if (!apiKey) {
      res.status(200).json({
        fallback: true,
        provider: "elevenlabs",
        error: "ELEVENLABS_API_KEY is not configured in Environment Variables. Add ELEVENLABS_API_KEY.",
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
        userFriendlyError = "ElevenLabs API key is unauthorized or invalid (401). Verify ELEVENLABS_API_KEY in environment.";
      } else if (lastStatus === 429 || lastStatus === 402 || lastErrorDetails.toLowerCase().includes("quota")) {
        userFriendlyError = "ElevenLabs character quota exceeded on your account. Switch to Cartesia or local voice.";
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


