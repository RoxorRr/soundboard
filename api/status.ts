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

  const rawSpeechifyKey = (
    process.env.SPEECHIFY_API_KEY ||
    process.env.SPEECHITY_API_KEY ||
    process.env.SPEECHIFY_KEY ||
    process.env.SPEECHIFY_SECRET_KEY ||
    process.env.SPEECHIFY_TOKEN
  )?.trim();
  const hasSpeechify = Boolean(rawSpeechifyKey);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  const envVoiceId = (
    process.env.SPEECHIFY_VOICE_ID ||
    process.env.SPEECHITY_VOICE_ID ||
    process.env.SPEECHIFY_CUSTOM_VOICE_ID ||
    process.env.SPEECHIFY_CLONED_VOICE_ID ||
    process.env.SPEECHIFY_VOICE ||
    process.env.CUSTOM_VOICE_ID ||
    process.env.VOICE_ID ||
    ""
  )?.trim();

  let workspaceClonedVoiceId = "";
  if (hasSpeechify && rawSpeechifyKey) {
    try {
      const auth = rawSpeechifyKey.startsWith("Bearer ") ? rawSpeechifyKey : `Bearer ${rawSpeechifyKey}`;
      const vRes = await fetch("https://api.sws.speechify.com/v1/voices", {
        headers: { Authorization: auth, Accept: "application/json" },
        signal: AbortSignal.timeout(2500),
      });
      if (vRes.ok) {
        const vData: any = await vRes.json();
        const list: any[] = Array.isArray(vData) ? vData : vData?.voices || [];
        const cloned = list.find(
          (v: any) => v.is_cloned || v.cloned || v.category === "cloned" || v.type === "cloned" || v.is_custom
        );
        if (cloned) {
          workspaceClonedVoiceId = cloned.id || cloned.voice_id || "";
        }
      }
    } catch (_) {}
  }

  const effectiveSpeechifyVoice = envVoiceId || workspaceClonedVoiceId || "cf2bbc5b-59fb-427e-95a5-bcd76641852f";
  const speechifyModel = (process.env.SPEECHIFY_MODEL || "simba-3.2").trim();

  res.status(200).json({
    configured: hasSpeechify,
    speechifyConfigured: hasSpeechify,
    activeProvider: "speechify",
    geminiConfigured: hasGemini,
    speechifyVoiceId: effectiveSpeechifyVoice,
    speechifyModel,
    hasCustomVoiceEnv: Boolean(envVoiceId || workspaceClonedVoiceId),
    team: "Pelham Pelicans"
  });
}
