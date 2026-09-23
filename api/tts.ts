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
          voiceId: cartesiaSettings?.voiceId || account1VoiceId || account2VoiceId || "694f9389-aac1-45b6-b726-9d9369183238",
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
          defaultVoiceId: account1VoiceId || "694f9389-aac1-45b6-b726-9d9369183238",
        });
      }
      if (account2ApiKey) {
        availableAccounts.push({
          id: "account2",
          label: "Account 2 (Secondary)",
          apiKey: account2ApiKey,
          defaultVoiceId: account2VoiceId || account1VoiceId || "694f9389-aac1-45b6-b726-9d9369183238",
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
    // PROVIDER 2: ELEVENLABS TTS (DEFAULT)
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

