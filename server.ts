import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Initialize server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support image payloads up to 20MB for camera captures
  app.use(express.json({ limit: '20mb' }));

  // Status endpoint to check ElevenLabs and Gemini configuration
  app.get("/api/status", (_req, res) => {
    const hasElevenLabs = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim().length > 0);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "nhl";
    res.json({
      configured: hasElevenLabs,
      geminiConfigured: hasGemini,
      voiceId,
      model: "eleven_turbo_v2_5",
      team: "Pelham Pelicans"
    });
  });

  // AI Sticker Scanner endpoint using Gemini multimodal vision (single sticker or full sticker sheet/file)
  app.post("/api/scan-sticker", async (req, res) => {
    try {
      let { image, rawText, mimeType, currentRoster } = req.body;
      if (!image && !rawText) {
        res.status(400).json({ success: false, error: "No image or text received. Please upload or capture a sticker file." });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          success: false,
          error: "Gemini API key is not configured in environment variables."
        });
        return;
      }

      let base64Data = "";
      if (image && typeof image === "string") {
        base64Data = image;
        if (base64Data.includes(",")) {
          const parts = base64Data.split(",");
          const match = parts[0].match(/:(.*?);/);
          if (match) {
            mimeType = match[1];
          }
          base64Data = parts[1];
        }
        if (!mimeType) {
          mimeType = "image/jpeg";
        }
      }

      // Build roster context prompt if provided
      let rosterContext = "";
      if (Array.isArray(currentRoster) && currentRoster.length > 0) {
        const rosterLines = currentRoster
          .map((p: any) => `#${p.number} ${p.name}`)
          .join(", ");
        rosterContext = `\nCurrent Pelham Pelicans Roster context:\n${rosterLines}\nIf you see a number or name that closely matches a player on this roster, cross-reference it to provide the player's full name and exact number.`;
      }

      const promptText = `Analyze this youth hockey sticker file, sticker sheet, Avery label sheet, helmet sticker, jersey badge, roster card, or player list.
TASK:
1. Extract ALL players found. If this is a sheet or file containing multiple player stickers or a full team roster (e.g. 15 stickers/players), extract EVERY SINGLE PLAYER into the 'players' array in order!
2. For each player:
   - 'number': Jersey number as integer (e.g. 12, 17, 7). If none found or not visible, use 0.
   - 'name': Player full name or surname in Title Case (e.g. "Adrian Repka", "Kunka", "Liam Carter").
3. Also populate the top-level 'number' and 'name' fields with the primary/first player found.
CRITICAL RULES:
- The team name is "Pelham Pelicans" (or "Pelham Minor Hockey" / "PMHA"). Words like "Pelham", "Pelicans", "Hockey", "Coach", "PMHA", "Gold", "Minor", "Trainer", "Division" are TEAM/LEAGUE terms, NOT player names. Do NOT output "Pelham" or "Pelicans" as a player name!
- Set 'confidence' to 'high', 'medium', or 'low'.
- Provide a summary note in 'notes' indicating how many player stickers were detected and any key details.${rosterContext}`;

      const contentsParts: any[] = [];
      if (base64Data) {
        contentsParts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          }
        });
      }
      if (rawText && typeof rawText === "string") {
        contentsParts.push({
          text: `Here is the raw text from the sticker file / roster:\n\n${rawText}`
        });
      }
      contentsParts.push({
        text: promptText
      });

      const generateOptions = {
        contents: {
          parts: contentsParts
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              number: {
                type: Type.INTEGER,
                description: "The primary or first player jersey number"
              },
              name: {
                type: Type.STRING,
                description: "The primary or first player name"
              },
              players: {
                type: Type.ARRAY,
                description: "All players extracted from the sticker file or sheet, in order",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    number: { type: Type.INTEGER },
                    name: { type: Type.STRING },
                    confidence: { type: Type.STRING }
                  },
                  required: ["number", "name"]
                }
              },
              confidence: {
                type: Type.STRING,
                description: "Overall confidence: high, medium, or low"
              },
              notes: {
                type: Type.STRING,
                description: "Summary of detected stickers and slots"
              }
            },
            required: ["number", "name", "players"]
          }
        }
      };

      // Try gemini-3.5-flash-lite first (fastest and responsive), fallback to gemini-3.6-flash if needed
      let response;
      const candidateModels = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash"];
      let lastError = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            ...generateOptions,
          });
          if (response?.text) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Model ${modelName} failed, trying next candidate:`, err?.message?.slice(0, 120));
        }
      }

      if (!response?.text) {
        throw lastError || new Error("Failed to extract sticker details from file.");
      }

      const responseText = response.text.trim();
      const parsed = JSON.parse(responseText);

      // Sanitize extracted players list
      const extractedPlayers = Array.isArray(parsed.players)
        ? parsed.players.map((p: any) => ({
            number: typeof p.number === "number" ? p.number : parseInt(p.number, 10) || 0,
            name: typeof p.name === "string" ? p.name.trim() : "",
            confidence: p.confidence || "medium",
          }))
        : [];

      // Fallback: If players array is empty but single player was found, put in array
      if (extractedPlayers.length === 0 && (parsed.number > 0 || (parsed.name && parsed.name.trim()))) {
        extractedPlayers.push({
          number: typeof parsed.number === "number" ? parsed.number : parseInt(parsed.number, 10) || 0,
          name: typeof parsed.name === "string" ? parsed.name.trim() : "",
          confidence: parsed.confidence || "medium",
        });
      }

      res.json({
        success: true,
        data: {
          number: typeof parsed.number === "number" ? parsed.number : parseInt(parsed.number, 10) || 0,
          name: typeof parsed.name === "string" ? parsed.name.trim() : "",
          players: extractedPlayers,
          confidence: parsed.confidence || "medium",
          notes: parsed.notes || ""
        }
      });
    } catch (err: any) {
      console.error("Sticker scanner error:", err);
      // Clean up error message if it's a JSON string
      let errorMsg = err?.message || "Failed to scan sticker with Gemini";
      try {
        if (errorMsg.startsWith("{") && errorMsg.includes('"message"')) {
          const parsedErr = JSON.parse(errorMsg);
          errorMsg = parsedErr.error?.message || errorMsg;
        }
      } catch {
        // ignore parse error
      }

      res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  });

  // Text-To-Speech endpoint proxying ElevenLabs with fallback signal
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceId: reqVoiceId } = req.body;
      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Missing or invalid 'text' in request body", fallback: true });
        return;
      }

      const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
      const envVoiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
      
      // If voice ID is 'nhl' or not specified, use the user's configured voice ID (e.g. 6j98Cb2txyqvHRXeRQYZ)
      let voiceId = reqVoiceId?.trim();
      if (!voiceId || voiceId.toLowerCase() === "nhl") {
        voiceId = envVoiceId || "6j98Cb2txyqvHRXeRQYZ";
      }

      if (!apiKey) {
        // Return fallback signal so client seamlessly speaks via Web Speech API
        res.status(200).json({
          fallback: true,
          message: "ELEVENLABS_API_KEY not set in environment. Falling back to local synthesizer.",
          voiceId
        });
        return;
      }

      // Call ElevenLabs API
      let response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.85,
            style: 0.60,
            use_speaker_boost: true
          }
        })
      });

      // If requested voice ID failed with 404, fallback to env voice ID or standard fallback
      if (!response.ok && response.status === 404 && envVoiceId && voiceId !== envVoiceId) {
        console.warn(`Voice ${voiceId} failed with 404, falling back to ENV voice ${envVoiceId}`);
        voiceId = envVoiceId;
        response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.85,
              style: 0.60,
              use_speaker_boost: true
            }
          })
        });
      }

      if (!response.ok) {
        const errorDetails = await response.text();
        console.warn(`ElevenLabs API returned status ${response.status}:`, errorDetails);
        res.status(200).json({
          fallback: true,
          error: `ElevenLabs request failed (${response.status})`,
          details: errorDetails,
          voiceId
        });
        return;
      }

      const audioBuffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache");
      res.send(Buffer.from(audioBuffer));
    } catch (err: any) {
      console.error("TTS endpoint error:", err);
      res.status(200).json({
        fallback: true,
        error: err?.message || "Internal server error during speech synthesis"
      });
    }
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pelham Pelicans Hockey Tracker running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
