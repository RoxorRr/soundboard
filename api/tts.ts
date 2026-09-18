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

    const { text, voiceId: reqVoiceId } = body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing or invalid 'text' in request body", fallback: true });
      return;
    }

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    const envVoiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

    let voiceId = reqVoiceId?.trim();
    if (!voiceId || voiceId.toLowerCase() === "nhl") {
      voiceId = envVoiceId || "6j98Cb2txyqvHRXeRQYZ";
    }

    if (!apiKey) {
      res.status(200).json({
        fallback: true,
        message: "ELEVENLABS_API_KEY not set in environment. Falling back to local synthesizer.",
        voiceId
      });
      return;
    }

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
}
