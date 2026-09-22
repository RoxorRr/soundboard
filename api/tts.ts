import { GoogleGenAI } from "@google/genai";
import { recordCharactersUsed, flagQuotaExceeded } from "./creditTracker";

function getElevenLabsApiKey(): string {
  return (
    process.env.ELEVENLABS_API_KEY ||
    process.env.ELEVEN_LABS_API_KEY ||
    process.env.VITE_ELEVENLABS_API_KEY ||
    process.env.VITE_ELEVEN_LABS_API_KEY ||
    process.env.ELEVENLABS_KEY ||
    process.env.ELEVEN_API_KEY ||
    process.env.XI_API_KEY ||
    process.env.VITE_XI_API_KEY ||
    process.env.ELEVEN_LABS_KEY ||
    ""
  ).trim();
}

function getCartesiaApiKey(isAccount2 = false): string {
  if (isAccount2) {
    return (
      process.env.CARTESIA_API_KEY_2 ||
      process.env.CARTESIA_KEY_2 ||
      process.env.VITE_CARTESIA_API_KEY_2 ||
      process.env.CARTESIA_APIKEY_2 ||
      ""
    ).trim();
  }
  return (
    process.env.CARTESIA_API_KEY ||
    process.env.CARTESIA_KEY ||
    process.env.VITE_CARTESIA_API_KEY ||
    process.env.CARTESIA_API_KEY_1 ||
    process.env.CARTESIA_KEY_1 ||
    process.env.CARTESIA_APIKEY ||
    process.env.CARTESIA_APIKEY_1 ||
    ""
  ).trim();
}

async function parseRequestBody(req: any): Promise<any> {
  // 1. Direct object or Buffer (Express json middleware or Vercel pre-parsed body)
  if (req.body) {
    if (Buffer.isBuffer(req.body)) {
      try {
        const str = req.body.toString("utf8");
        return JSON.parse(str);
      } catch {
        return {};
      }
    }
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    if (typeof req.body === "object" && req.body !== null) {
      return req.body;
    }
  }

  // 2. Unparsed streaming request on Vercel Serverless (with strict 800ms safety timeout so it NEVER hangs)
  if (typeof req.on === "function" && !req.readableEnded && !req.complete) {
    try {
      const raw = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = [];
        const timer = setTimeout(() => resolve(""), 800);

        req.on("data", (chunk: any) => {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        req.on("end", () => {
          clearTimeout(timer);
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
        req.on("error", () => {
          clearTimeout(timer);
          resolve("");
        });
      });

      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          return {};
        }
      }
    } catch (_) {}
  }

  return {};
}

function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const wavBuffer = Buffer.alloc(totalSize);

  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(totalSize - 8, 4);
  wavBuffer.write("WAVE", 8);

  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20); // PCM
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
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
    const body = await parseRequestBody(req);

    const {
      text,
      provider: reqProvider,
      account: reqAccount, // 'account1' | 'account2' for Cartesia
      voiceId: reqVoiceId,
      model: reqModel,
      format: reqFormat,
      voiceSettings: customSettings,
      cartesiaSettings,
      googleSettings,
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
      const cartesiaApiKey = getCartesiaApiKey(isAccount2);
      const envCartesiaVoiceId = (process.env.CARTESIA_VOICE_ID || process.env.CARTESIA_VOICE)?.trim();

      if (!cartesiaApiKey) {
        const errorMsg = isAccount2
          ? "CARTESIA_API_KEY_2 (Account 2) is not configured in Environment Variables. In Vercel, go to Project Settings -> Environment Variables and add CARTESIA_API_KEY_2."
          : "CARTESIA_API_KEY (Account 1) is not configured in Environment Variables. In Vercel, go to Project Settings -> Environment Variables and add CARTESIA_API_KEY.";
        res.status(200).json({
          fallback: true,
          provider: "cartesia",
          account: isAccount2 ? "account2" : "account1",
          error: errorMsg,
          voiceId: cartesiaSettings?.voiceId || envCartesiaVoiceId || "694f9389-aac1-45b6-b726-9d9369183238",
        });
        return;
      }

      // Build Cartesia voice candidates: user requested -> env configured -> custom Pelham -> universal announcer
      const userCartesiaVoice = (cartesiaSettings?.voiceId || reqVoiceId || "").trim();
      const cartesiaCandidates: string[] = [];
      if (userCartesiaVoice && userCartesiaVoice.toLowerCase() !== "nhl") cartesiaCandidates.push(userCartesiaVoice);
      if (envCartesiaVoiceId && envCartesiaVoiceId.toLowerCase() !== "nhl") cartesiaCandidates.push(envCartesiaVoiceId);
      // Pelham custom voice
      cartesiaCandidates.push("a27f2ab7-6793-4893-9f40-e50d5e5605ba");
      // Universal premade announcers available across Cartesia accounts
      cartesiaCandidates.push("694f9389-aac1-45b6-b726-9d9369183238"); // Barbershop Man / Announcer (Male, Deep & Confident)
      cartesiaCandidates.push("47c38ca4-5f35-497b-b1a3-415245fb35e1"); // Daniel (Male, Clear & Natural)

      const uniqueCartesiaVoices = Array.from(new Set(cartesiaCandidates.filter(Boolean))).slice(0, 2);
      const preferredModel = cartesiaSettings?.modelId || reqModel || "sonic-3.5";
      const modelsToTry = [preferredModel, "sonic"].filter((m, i, arr) => arr.indexOf(m) === i);

      const speed = typeof cartesiaSettings?.speed === "number"
        ? Math.max(0.6, Math.min(1.5, cartesiaSettings.speed))
        : 1.05;
      const emotion = cartesiaSettings?.emotion || "excited";

      let successfulAudioBuffer: ArrayBuffer | null = null;
      let winningVoiceId = uniqueCartesiaVoices[0];
      let winningMime = "audio/mpeg";
      let lastStatus = 0;
      let lastErrorDetails = "";
      const cartesiaStartTime = Date.now();

      for (const voiceCandidate of uniqueCartesiaVoices) {
        // Enforce maximum execution window to prevent Vercel 504 Gateway Timeouts
        if (Date.now() - cartesiaStartTime > 9000) break;

        for (const modelCandidate of modelsToTry) {
          if (Date.now() - cartesiaStartTime > 9000) break;

          try {
            // Attempt 1: Standard MP3 container
            const payload: Record<string, any> = {
              model_id: modelCandidate,
              transcript: text,
              voice: {
                mode: "id",
                id: voiceCandidate,
              },
              output_format: {
                container: "mp3",
                bit_rate: 128000,
                sample_rate: 44100,
              },
              language: "en",
            };

            if (speed && speed !== 1.0) {
              payload.generation_config = { speed };
              if (emotion && emotion !== "neutral") {
                payload.generation_config.emotion = emotion;
              }
            } else if (emotion && emotion !== "neutral") {
              payload.generation_config = { emotion };
            }

            let response = await fetch("https://api.cartesia.ai/tts/bytes", {
              method: "POST",
              headers: {
                "X-API-Key": cartesiaApiKey,
                "Cartesia-Version": "2024-06-10",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(6000),
            });

            // If container mp3 or generation_config caused 400 error, retry with clean WAV
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
                signal: AbortSignal.timeout(6000),
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

            // If 404 (voice not found), skip remaining models for this voice immediately
            if (response.status === 404) {
              break;
            }

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
        const isQuotaErr = lastStatus === 429 || lastStatus === 402 || lastErrorDetails.toLowerCase().includes("quota") || lastErrorDetails.toLowerCase().includes("credit");
        if (isQuotaErr) {
          flagQuotaExceeded(isAccount2 ? 'cartesia2' : 'cartesia1');
        }

        const accountLabel = isAccount2 ? "Cartesia Account 2" : "Cartesia Account 1";
        let userFriendlyError = `${accountLabel} Sonic speech synthesis failed`;
        if (lastStatus === 401) {
          userFriendlyError = `${accountLabel} API key is unauthorized or invalid (401). Verify ${isAccount2 ? 'CARTESIA_API_KEY_2' : 'CARTESIA_API_KEY'} in Vercel Environment Variables.`;
        } else if (isQuotaErr) {
          userFriendlyError = `${accountLabel} credits limit reached. Check balance or switch to other voice account.`;
        } else if (lastStatus === 404) {
          userFriendlyError = `${accountLabel} voice or model could not be found (404).`;
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
          quotaExceeded: isQuotaErr
        });
        return;
      }

      // Record successful Cartesia character credit usage
      recordCharactersUsed(isAccount2 ? 'cartesia2' : 'cartesia1', text.length);

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
    // PROVIDER 2: GOOGLE NATURAL SPORT COMMENTATOR TTS
    // ==========================================
    if (provider === "google") {
      const googleVoiceSettings = googleSettings || {};
      const requestedVoice = (googleVoiceSettings.voiceId || reqVoiceId || process.env.GOOGLE_TTS_VOICE_ID || "Puck").trim();
      const speed = typeof googleVoiceSettings.speed === "number"
        ? Math.max(0.6, Math.min(1.5, googleVoiceSettings.speed))
        : 1.05;

      const googleCloudApiKey = (process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_API_KEY)?.trim();
      const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

      if (!geminiApiKey && !googleCloudApiKey) {
        res.status(200).json({
          fallback: true,
          provider: "google",
          error: "Neither GEMINI_API_KEY nor GOOGLE_TTS_API_KEY is configured in Environment Variables.",
          voiceId: requestedVoice,
        });
        return;
      }

      let audioBuffer: Buffer | null = null;
      let winningVoice = requestedVoice;
      let mimeType = "audio/wav";

      // Branch A: If Google Cloud TTS key is present and a Journey/Studio/Neural2 cloud voice was requested, try Google Cloud TTS
      const isCloudVoice = requestedVoice.startsWith("en-US-") || requestedVoice.includes("Journey") || requestedVoice.includes("Studio") || requestedVoice.includes("Neural2");

      if (googleCloudApiKey && isCloudVoice) {
        try {
          const cloudResp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleCloudApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { text },
              voice: {
                languageCode: "en-US",
                name: requestedVoice
              },
              audioConfig: {
                audioEncoding: "MP3",
                speakingRate: speed
              }
            })
          });

          if (cloudResp.ok) {
            const data: any = await cloudResp.json();
            if (data?.audioContent) {
              audioBuffer = Buffer.from(data.audioContent, "base64");
              mimeType = "audio/mpeg";
              winningVoice = requestedVoice;
            }
          }
        } catch (cloudErr) {
          console.warn("Google Cloud TTS REST error, falling back to Gemini TTS:", cloudErr);
        }
      }

      // Branch B: Gemini Natural AI Commentator (gemini-3.1-flash-tts-preview)
      if (!audioBuffer && geminiApiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          // Map voice to supported Gemini TTS voices: Puck (default - lively sports commentator), Charon (analyst), Fenrir, Aoede, Kore
          const geminiVoiceMap: Record<string, string> = {
            puck: "Puck",
            charon: "Charon",
            fenrir: "Fenrir",
            aoede: "Aoede",
            kore: "Kore",
          };
          const normalizedVoice = requestedVoice.toLowerCase();
          const targetVoice = geminiVoiceMap[normalizedVoice] || "Puck";

          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: text,
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: targetVoice
                  }
                }
              }
            }
          });

          const candidate = response.candidates?.[0];
          const part = candidate?.content?.parts?.[0];
          const base64Pcm = part?.inlineData?.data;

          if (base64Pcm) {
            const rawPcm = Buffer.from(base64Pcm, "base64");
            audioBuffer = pcmToWav(rawPcm, 24000, 1, 16);
            mimeType = "audio/wav";
            winningVoice = targetVoice;
          } else {
            throw new Error("No inline audio data in Gemini TTS response");
          }
        } catch (geminiErr: any) {
          console.error("Gemini TTS synthesis error:", geminiErr);
          res.status(200).json({
            fallback: true,
            provider: "google",
            error: geminiErr?.message || "Google Gemini Natural Voice synthesis failed",
            voiceId: winningVoice,
            quotaExceeded: geminiErr?.message?.includes("429") || geminiErr?.message?.includes("RESOURCE_EXHAUSTED") || geminiErr?.message?.includes("Quota exceeded")
          });
          return;
        }
      }

      if (!audioBuffer) {
        res.status(200).json({
          fallback: true,
          provider: "google",
          error: "Failed to generate Google TTS audio",
          voiceId: winningVoice,
        });
        return;
      }

      // Record Google characters used
      recordCharactersUsed("google", text.length);

      const wantsBase64 = reqFormat === "base64" || req.headers["accept"]?.includes("application/json");
      if (wantsBase64) {
        res.status(200).json({
          success: true,
          provider: "google",
          audioBase64: audioBuffer.toString("base64"),
          mimeType,
          voiceId: winningVoice,
          size: audioBuffer.length
        });
        return;
      }

      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "X-Google-Voice": winningVoice,
        "X-TTS-Provider": "google"
      });
      res.end(audioBuffer);
      return;
    }

    // ==========================================
    // PROVIDER 3: ELEVENLABS TTS (DEFAULT)
    // ==========================================
    const apiKey = getElevenLabsApiKey();
    const envVoiceId = (process.env.ELEVENLABS_VOICE_ID || process.env.ELEVEN_LABS_VOICE_ID)?.trim();

    if (!apiKey) {
      res.status(200).json({
        fallback: true,
        provider: "elevenlabs",
        error: "ELEVENLABS_API_KEY is not configured in Environment Variables. In Vercel, go to Project Settings -> Environment Variables and add ELEVENLABS_API_KEY.",
        voiceId: envVoiceId || "pNInz6obpgDQGcFmaJgB"
      });
      return;
    }

    // Parse fine-tuned voice parameters
    const speed = typeof customSettings?.speed === "number" ? Math.max(0.7, Math.min(1.25, customSettings.speed)) : 1.0;
    const stability = typeof customSettings?.stability === "number" ? Math.max(0.0, Math.min(1.0, customSettings.stability)) : 0.45;
    const similarityBoost = typeof customSettings?.similarity_boost === "number" ? Math.max(0.0, Math.min(1.0, customSettings.similarity_boost)) : 0.85;
    const style = typeof customSettings?.style === "number" ? Math.max(0.0, Math.min(1.0, customSettings.style)) : 0.60;
    const useSpeakerBoost = typeof customSettings?.use_speaker_boost === "boolean" ? customSettings.use_speaker_boost : true;

    // Build voice candidates: user requested -> env configured -> custom Pelham NHL voice -> universal premade Adam/Arnold
    const userVoiceId = reqVoiceId && reqVoiceId.toLowerCase() !== "nhl" ? reqVoiceId.trim() : null;
    const candidates: string[] = [];
    if (userVoiceId) candidates.push(userVoiceId);
    if (envVoiceId && envVoiceId.toLowerCase() !== "nhl") candidates.push(envVoiceId);
    // Custom Pelham NHL voice
    candidates.push("6j98Cb2txyqvHRXeRQYZ");
    // Universal premade ElevenLabs voices available on all free/paid accounts
    candidates.push("pNInz6obpgDQGcFmaJgB"); // Adam (Deep male narrator / sports voice)
    candidates.push("VR6AewLTigWG4xSOukaG"); // Arnold (Crisp male announcer)

    // Deduplicate and cap to top 2 to avoid Vercel timeouts
    const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean))).slice(0, 2);

    let successfulAudioBuffer: ArrayBuffer | null = null;
    let winningVoiceId = uniqueCandidates[0];
    let lastStatus = 0;
    let lastErrorDetails = "";
    const elStartTime = Date.now();

    for (const candidate of uniqueCandidates) {
      if (Date.now() - elStartTime > 9500) break;

      try {
        const voiceSettingsPayload: Record<string, any> = {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
        };
        // Only attach speed if explicitly different from default 1.0 to avoid 400 parameter rejection
        if (speed && speed !== 1.0) {
          voiceSettingsPayload.speed = speed;
        }

        const payload: Record<string, any> = {
          text,
          model_id: reqModel || "eleven_turbo_v2_5",
          voice_settings: voiceSettingsPayload
        };

        let response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(candidate)}`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000)
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
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(6000)
          });
        }

        // If turbo model rejected, try multilingual v2
        if ((response.status === 400 || response.status === 422) && payload.model_id !== "eleven_multilingual_v2") {
          payload.model_id = "eleven_multilingual_v2";
          response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(candidate)}`, {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              "Accept": "audio/mpeg"
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(6000)
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
      const isQuotaErr = lastStatus === 429 || lastStatus === 402 || lastErrorDetails.toLowerCase().includes("quota");
      if (isQuotaErr) {
        flagQuotaExceeded('elevenlabs');
      }

      let userFriendlyError = "ElevenLabs speech synthesis failed";
      if (lastStatus === 401) {
        userFriendlyError = "ElevenLabs API key is unauthorized or invalid (401). Verify ELEVENLABS_API_KEY in Vercel Environment Variables.";
      } else if (isQuotaErr) {
        userFriendlyError = "ElevenLabs character quota or spend limit reached. If using pay-per-request, check your usage limit in ElevenLabs.";
      } else if (lastStatus === 404) {
        userFriendlyError = "ElevenLabs voice could not be loaded (404). Falling back to browser voice.";
      } else if (lastErrorDetails) {
        try {
          const parsed = JSON.parse(lastErrorDetails);
          userFriendlyError = parsed.detail?.message || parsed.message || parsed.error || userFriendlyError;
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
        status: lastStatus,
        quotaExceeded: isQuotaErr
      });
      return;
    }

    // Record successful ElevenLabs character credit usage
    recordCharactersUsed('elevenlabs', text.length);

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


