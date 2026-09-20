export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const hasElevenLabs = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim().length > 0);
  const hasCartesia = Boolean(process.env.CARTESIA_API_KEY && process.env.CARTESIA_API_KEY.trim().length > 0);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "nhl";
  const cartesiaVoiceId = process.env.CARTESIA_VOICE_ID || "694f9389-aac1-45b6-b726-9d9369183238";

  res.status(200).json({
    configured: hasElevenLabs || hasCartesia,
    elevenLabsConfigured: hasElevenLabs,
    cartesiaConfigured: hasCartesia,
    geminiConfigured: hasGemini,
    voiceId,
    cartesiaVoiceId,
    model: "eleven_turbo_v2_5",
    cartesiaModel: "sonic-3.5",
    team: "Pelham Pelicans"
  });
}
