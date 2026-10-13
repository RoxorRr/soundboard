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
  const hasSpeechify = Boolean((process.env.SPEECHIFY_API_KEY || process.env.SPEECHITY_API_KEY || process.env.SPEECHIFY_KEY)?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || process.env.ELEVEN_LABS_VOICE_ID || "6j98Cb2txyqvHRXeRQYZ";
  const rawVoice1 = (process.env.CARTESIA_VOICE_ID || process.env.CARTESIA_VOICE || process.env.CARTESIA_VOICE_ID_1 || "a27f2ab7-6793-4893-9f40-e50d5e5605ba").trim();
  const rawVoice2 = (process.env.CARTESIA_VOICE_ID_2 || process.env.CARTESIA_SECOND_VOICE_ID || process.env.CARTESIA_VOICE_2 || "").trim();
  const cartesiaVoiceId = !rawVoice1.startsWith("sk_") ? rawVoice1 : "a27f2ab7-6793-4893-9f40-e50d5e5605ba";
  const cartesiaVoiceId2 = !rawVoice2.startsWith("sk_") ? rawVoice2 : "";
  const speechifyVoiceId = (process.env.SPEECHIFY_VOICE_ID || process.env.SPEECHITY_VOICE_ID || "cf2bbc5b-59fb-427e-95a5-bcd76641852f").trim();
  const speechifyModel = (process.env.SPEECHIFY_MODEL || "simba-3.2").trim();

  res.status(200).json({
    configured: hasSpeechify,
    speechifyConfigured: hasSpeechify,
    activeProvider: "speechify",
    geminiConfigured: hasGemini,
    speechifyVoiceId,
    speechifyModel,
    team: "Pelham Pelicans"
  });
}
