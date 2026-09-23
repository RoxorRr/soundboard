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
  const hasCartesia1 = Boolean((process.env.CARTESIA_API_KEY || process.env.CARTESIA_KEY || process.env.CARTESIA_API_KEY_1)?.trim());
  const hasCartesia2 = Boolean((process.env.CARTESIA_API_KEY_2 || process.env.CARTESIA_SECOND_API_KEY || process.env.CARTESIA_KEY_2)?.trim());
  const hasCartesia = hasCartesia1 || hasCartesia2;
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || process.env.ELEVEN_LABS_VOICE_ID || "nhl";
  const rawVoice1 = (process.env.CARTESIA_VOICE_ID || process.env.CARTESIA_VOICE || process.env.CARTESIA_VOICE_ID_1 || "694f9389-aac1-45b6-b726-9d9369183238").trim();
  const rawVoice2 = (process.env.CARTESIA_VOICE_ID_2 || process.env.CARTESIA_SECOND_VOICE_ID || process.env.CARTESIA_VOICE_2 || "").trim();
  const cartesiaVoiceId = !rawVoice1.startsWith("sk_") ? rawVoice1 : "694f9389-aac1-45b6-b726-9d9369183238";
  const cartesiaVoiceId2 = !rawVoice2.startsWith("sk_") ? rawVoice2 : "";

  res.status(200).json({
    configured: hasElevenLabs || hasCartesia,
    elevenLabsConfigured: hasElevenLabs,
    cartesiaConfigured: hasCartesia,
    cartesiaAccount1Configured: hasCartesia1,
    cartesiaAccount2Configured: hasCartesia2,
    cartesiaAccountsCount: (hasCartesia1 ? 1 : 0) + (hasCartesia2 ? 1 : 0),
    geminiConfigured: hasGemini,
    voiceId,
    cartesiaVoiceId,
    cartesiaVoiceId2,
    model: "eleven_turbo_v2_5",
    cartesiaModel: "sonic-3.5",
    team: "Pelham Pelicans"
  });
}
