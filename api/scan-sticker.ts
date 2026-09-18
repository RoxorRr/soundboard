import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        res.status(400).json({ success: false, error: "Invalid JSON body." });
        return;
      }
    }
    body = body || {};

    let { image, rawText, mimeType, currentRoster } = body;
    if (!image && !rawText) {
      res.status(400).json({
        success: false,
        error: "No image or text received. Please upload or capture a sticker file."
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured in environment variables. If you are on Vercel, please add GEMINI_API_KEY to your Vercel Project Settings > Environment Variables."
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

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
      rosterContext = `\nCurrent Roster context:\n${rosterLines}\nIf you see a number or name that closely matches a player on this roster, cross-reference it to provide the player's full name and exact number.`;
    }

    const promptText = `Analyze this youth hockey sticker file, sticker sheet, Avery label sheet, helmet sticker, jersey badge, roster card, or player list.
TASK:
1. Extract ALL players found. If this is a sheet or file containing multiple player stickers or a full team roster (e.g. 15 stickers/players), extract EVERY SINGLE PLAYER into the 'players' array in order!
2. For each player:
   - 'number': Jersey number as integer (e.g. 12, 17, 7). If none found or not visible, use 0.
   - 'name': Player full name or surname in Title Case (e.g. "Adrian Repka", "Kunka", "Liam Carter").
3. Also populate the top-level 'number' and 'name' fields with the primary/first player found.
CRITICAL RULES:
- Words like "Pelham", "Pelicans", "Hockey", "Coach", "PMHA", "Gold", "Minor", "Trainer", "Division", "Visitor", "Team" are TEAM/LEAGUE terms, NOT player names. Do NOT output team names as player names!
- Set 'confidence' to 'high', 'medium', or 'low'.
- Provide a summary note in 'notes' indicating how many player stickers were detected and any key details.${rosterContext}`;

    const contents: any[] = [];
    if (base64Data) {
      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        }
      });
    }
    if (rawText && typeof rawText === "string") {
      contents.push({
        text: `Here is the raw text from the sticker file / roster:\n\n${rawText}`
      });
    }
    contents.push({
      text: promptText
    });

    const responseSchema = {
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
    };

    let response;
    const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema
          }
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

    const extractedPlayers = Array.isArray(parsed.players)
      ? parsed.players.map((p: any) => ({
          number: typeof p.number === "number" ? p.number : parseInt(p.number, 10) || 0,
          name: typeof p.name === "string" ? p.name.trim() : "",
          confidence: p.confidence || "medium",
        }))
      : [];

    if (extractedPlayers.length === 0 && (parsed.number > 0 || (parsed.name && parsed.name.trim()))) {
      extractedPlayers.push({
        number: typeof parsed.number === "number" ? parsed.number : parseInt(parsed.number, 10) || 0,
        name: typeof parsed.name === "string" ? parsed.name.trim() : "",
        confidence: parsed.confidence || "medium",
      });
    }

    res.status(200).json({
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
}
