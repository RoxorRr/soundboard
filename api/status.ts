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

  // 1. Comprehensive Speechify API Key discovery across Vercel / Cloud environments
  const speechifyKeyCandidates = [
    { name: "SPEECHIFY_API_KEY", val: process.env.SPEECHIFY_API_KEY },
    { name: "SPEECHIFY_KEY", val: process.env.SPEECHIFY_KEY },
    { name: "SPEECHIFY_SECRET_KEY", val: process.env.SPEECHIFY_SECRET_KEY },
    { name: "SPEECHIFY_TOKEN", val: process.env.SPEECHIFY_TOKEN },
    { name: "SPEECHITY_API_KEY", val: process.env.SPEECHITY_API_KEY },
    { name: "SPEECHITY_KEY", val: process.env.SPEECHITY_KEY },
    { name: "SPEECHIFY_ID", val: process.env.SPEECHIFY_ID },
    { name: "SPEECHIFY_APIKEY", val: process.env.SPEECHIFY_APIKEY },
    { name: "VITE_SPEECHIFY_API_KEY", val: process.env.VITE_SPEECHIFY_API_KEY },
    { name: "VITE_SPEECHIFY_KEY", val: process.env.VITE_SPEECHIFY_KEY },
    { name: "VITE_SPEECHITY_API_KEY", val: process.env.VITE_SPEECHITY_API_KEY },
    { name: "NEXT_PUBLIC_SPEECHIFY_API_KEY", val: process.env.NEXT_PUBLIC_SPEECHIFY_API_KEY },
  ];

  let detectedKey = "";
  let detectedKeySource = "";
  for (const cand of speechifyKeyCandidates) {
    const trimmed = (cand.val || "").trim();
    if (trimmed.length > 5) {
      detectedKey = trimmed;
      detectedKeySource = cand.name;
      break;
    }
  }

  const hasSpeechify = Boolean(detectedKey);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  // 2. Comprehensive Voice ID discovery from environment variables
  const envVoiceCandidates = [
    { name: "SPEECHIFY_VOICE_ID", val: process.env.SPEECHIFY_VOICE_ID },
    { name: "SPEECHIFY_CUSTOM_VOICE_ID", val: process.env.SPEECHIFY_CUSTOM_VOICE_ID },
    { name: "SPEECHIFY_CLONED_VOICE_ID", val: process.env.SPEECHIFY_CLONED_VOICE_ID },
    { name: "SPEECHIFY_PERSONAL_VOICE_ID", val: process.env.SPEECHIFY_PERSONAL_VOICE_ID },
    { name: "SPEECHIFY_VOICE", val: process.env.SPEECHIFY_VOICE },
    { name: "SPEECHITY_VOICE_ID", val: process.env.SPEECHITY_VOICE_ID },
    { name: "CUSTOM_VOICE_ID", val: process.env.CUSTOM_VOICE_ID },
    { name: "VOICE_ID", val: process.env.VOICE_ID },
    { name: "VITE_SPEECHIFY_VOICE_ID", val: process.env.VITE_SPEECHIFY_VOICE_ID },
    { name: "VITE_CUSTOM_VOICE_ID", val: process.env.VITE_CUSTOM_VOICE_ID },
    { name: "VITE_VOICE_ID", val: process.env.VITE_VOICE_ID },
    { name: "NEXT_PUBLIC_SPEECHIFY_VOICE_ID", val: process.env.NEXT_PUBLIC_SPEECHIFY_VOICE_ID },
  ];

  let envVoiceId = "";
  let envVoiceSource = "";
  for (const v of envVoiceCandidates) {
    const trimmed = (v.val || "").trim();
    if (trimmed.length > 0) {
      envVoiceId = trimmed;
      envVoiceSource = v.name;
      break;
    }
  }

  // 3. Query Speechify API to discover Personal / Cloned voices created in user workspace
  let personalVoices: Array<{ id: string; name: string; models: string[]; gender?: string; locale?: string }> = [];
  let workspaceClonedVoiceId = "";
  let workspaceClonedVoiceName = "";

  if (hasSpeechify) {
    try {
      const auth = detectedKey.startsWith("Bearer ") ? detectedKey : `Bearer ${detectedKey}`;
      const vRes = await fetch("https://api.sws.speechify.com/v1/voices", {
        headers: { Authorization: auth, Accept: "application/json" },
        signal: AbortSignal.timeout(3500),
      });

      if (vRes.ok) {
        const vData: any = await vRes.json();
        const list: any[] = Array.isArray(vData) ? vData : vData?.voices || [];
        // Speechify marks user-created custom/cloned voices with type === "personal" or can_manage === true
        const personalList = list.filter(
          (v: any) =>
            v.type === "personal" ||
            v.can_manage === true ||
            v.type !== "shared" ||
            v.is_cloned ||
            v.cloned ||
            v.category === "cloned" ||
            v.is_custom
        );

        personalVoices = personalList.map((v: any) => ({
          id: v.id || v.voice_id,
          name: v.display_name || v.name || v.id,
          models: Array.isArray(v.models) ? v.models.map((m: any) => m.name || m) : ["simba-3.2"],
          gender: v.gender,
          locale: v.locale,
        }));

        if (personalVoices.length > 0) {
          // If envVoiceId matches a personal voice by name or ID, prioritize it
          const matchedByEnv = envVoiceId
            ? personalVoices.find(
                (p) =>
                  p.id.toLowerCase() === envVoiceId.toLowerCase() ||
                  p.name.toLowerCase() === envVoiceId.toLowerCase()
              )
            : null;

          const chosen = matchedByEnv || personalVoices[0];
          workspaceClonedVoiceId = chosen.id;
          workspaceClonedVoiceName = chosen.name;
        }
      }
    } catch (err: any) {
      console.warn("[Status] Personal voice discovery skipped:", err?.message);
    }
  }

  // 4. Determine effective voice ID and display name
  let effectiveSpeechifyVoice = "cf2bbc5b-59fb-427e-95a5-bcd76641852f";
  let effectiveVoiceName = "NHL Pelham Announcer";

  if (envVoiceId && envVoiceId.toLowerCase() !== "nhl") {
    effectiveSpeechifyVoice = envVoiceId;
    effectiveVoiceName = workspaceClonedVoiceName || "Custom Cloned Voice";
  } else if (workspaceClonedVoiceId) {
    effectiveSpeechifyVoice = workspaceClonedVoiceId;
    effectiveVoiceName = workspaceClonedVoiceName || "Personal Workspace Voice";
  }

  const speechifyModel = (process.env.SPEECHIFY_MODEL || "simba-3.2").trim();

  res.status(200).json({
    configured: hasSpeechify,
    speechifyConfigured: hasSpeechify,
    apiKeyConfigured: hasSpeechify,
    apiKeySource: detectedKeySource,
    activeProvider: "speechify",
    geminiConfigured: hasGemini,
    speechifyVoiceId: effectiveSpeechifyVoice,
    speechifyVoiceName: effectiveVoiceName,
    speechifyModel,
    hasCustomVoiceEnv: Boolean(envVoiceId),
    envVoiceSource: envVoiceSource || undefined,
    hasPersonalVoice: personalVoices.length > 0,
    personalVoices,
    team: "Pelham Pelicans",
  });
}
