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

  const hasElevenLabs = Boolean((process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY)?.trim());
  const hasCartesia1 = Boolean((process.env.CARTESIA_API_KEY || process.env.CARTESIA_KEY)?.trim());
  const hasCartesia2 = Boolean((process.env.CARTESIA_API_KEY_2 || process.env.CARTESIA_KEY_2)?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || process.env.ELEVEN_LABS_VOICE_ID || "nhl";
  const cartesiaVoiceId = process.env.CARTESIA_VOICE_ID || process.env.CARTESIA_VOICE || "694f9389-aac1-45b6-b726-9d9369183238";

  res.status(200).json({
    configured: hasElevenLabs || hasCartesia1 || hasCartesia2,
    elevenLabsConfigured: hasElevenLabs,
    cartesiaConfigured: hasCartesia1 || hasCartesia2,
    cartesiaAccount1Configured: hasCartesia1,
    cartesiaAccount2Configured: hasCartesia2,
    geminiConfigured: hasGemini,
    voiceId,
    cartesiaVoiceId,
    model: "eleven_turbo_v2_5",
    cartesiaModel: "sonic-3.5",
    team: "Pelham Pelicans"
  });
}
