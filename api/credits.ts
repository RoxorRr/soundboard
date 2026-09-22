import { getCurrentMonthUsage, setCustomRemainingBalance, syncAllActualBalances } from './creditTracker';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  // Support updating manual balance override (for ElevenLabs, Cartesia 1, or Cartesia 2)
  if (req.method === 'POST') {
    if (body.action === 'set_balance') {
      const { account, remainingCredits, limit } = body;
      if (
        (account === 'cartesia1' || account === 'cartesia2' || account === 'elevenlabs') &&
        typeof remainingCredits === 'number'
      ) {
        const updated = setCustomRemainingBalance(account, Math.max(0, Math.round(remainingCredits)), limit);
        res.status(200).json({ success: true, usage: updated });
        return;
      }
    } else if (body.action === 'sync_all_balances') {
      const updated = syncAllActualBalances(body.balances || { elevenlabs: 130000, cartesia1: 120000, cartesia2: 19000 });
      res.status(200).json({ success: true, usage: updated });
      return;
    }
  }

  const query = req.query || {};
  const currentUsage = getCurrentMonthUsage();
  const c1Limit = currentUsage.cartesia1Limit || Number(body.cartesia1_limit || query.cartesia1_limit || 120000);
  const c2Limit = currentUsage.cartesia2Limit || Number(body.cartesia2_limit || query.cartesia2_limit || 20000);

  // 1. ELEVENLABS CREDITS CHECK
  const elevenKey = (process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY)?.trim();
  const defaultElevenRemaining = typeof currentUsage.elevenlabsOverrideRemaining === 'number'
    ? currentUsage.elevenlabsOverrideRemaining
    : 130000;
  const defaultElevenLimit = currentUsage.elevenlabsLimit || Math.max(defaultElevenRemaining, 150000);

  let elevenStatus: {
    configured: boolean;
    characterLimit: number;
    characterCount: number;
    remainingCredits: number;
    resetUnix?: number | null;
    resetDate?: string | null;
    tier?: string;
    status?: string;
    isLowCredits: boolean;
    source: 'api' | 'manual' | 'calibrated' | 'none';
    error?: string;
  } = {
    configured: Boolean(elevenKey || defaultElevenRemaining > 0),
    characterLimit: defaultElevenLimit,
    characterCount: Math.max(0, defaultElevenLimit - defaultElevenRemaining),
    remainingCredits: defaultElevenRemaining,
    isLowCredits: defaultElevenRemaining <= 400,
    source: 'calibrated',
  };

  if (elevenKey) {
    try {
      const elRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        method: 'GET',
        headers: {
          'xi-api-key': elevenKey,
          'Accept': 'application/json',
        },
      });

      if (elRes.ok) {
        const elData = await elRes.json();
        const apiLimit = Number(elData.character_limit ?? 0);
        const apiCount = Number(elData.character_count ?? 0);
        const apiRemaining = Math.max(0, apiLimit - apiCount);
        let resetDate: string | null = null;
        if (elData.next_character_count_reset_unix) {
          try {
            resetDate = new Date(elData.next_character_count_reset_unix * 1000).toISOString();
          } catch (_) {}
        }

        // If user has calibrated a custom credit balance (e.g. 130k), preserve that remaining balance
        const remainingToUse = typeof currentUsage.elevenlabsOverrideRemaining === 'number'
          ? currentUsage.elevenlabsOverrideRemaining
          : Math.max(apiRemaining, 130000);
        const limitToUse = typeof currentUsage.elevenlabsLimit === 'number'
          ? currentUsage.elevenlabsLimit
          : Math.max(apiLimit, remainingToUse);

        elevenStatus = {
          configured: true,
          characterLimit: limitToUse,
          characterCount: Math.max(0, limitToUse - remainingToUse),
          remainingCredits: remainingToUse,
          resetUnix: elData.next_character_count_reset_unix || null,
          resetDate,
          tier: elData.tier || 'standard',
          status: elData.status || 'active',
          isLowCredits: remainingToUse <= 400,
          source: typeof currentUsage.elevenlabsOverrideRemaining === 'number' ? 'calibrated' : 'api',
        };
      } else {
        const errorText = await elRes.text();
        let errMsg = 'Failed to fetch ElevenLabs subscription';
        try {
          const parsed = JSON.parse(errorText);
          errMsg = parsed.detail?.message || parsed.message || errMsg;
        } catch (_) {}

        elevenStatus = {
          configured: true,
          characterLimit: defaultElevenLimit,
          characterCount: Math.max(0, defaultElevenLimit - defaultElevenRemaining),
          remainingCredits: defaultElevenRemaining,
          isLowCredits: defaultElevenRemaining <= 400,
          source: 'calibrated',
          error: errMsg,
        };
      }
    } catch (err: any) {
      elevenStatus = {
        configured: true,
        characterLimit: defaultElevenLimit,
        characterCount: Math.max(0, defaultElevenLimit - defaultElevenRemaining),
        remainingCredits: defaultElevenRemaining,
        isLowCredits: defaultElevenRemaining <= 400,
        source: 'calibrated',
        error: err?.message || 'Network error reaching ElevenLabs API',
      };
    }
  }

  // 2. CARTESIA ACCOUNT 1 CREDITS CHECK
  const cartesia1Key = (process.env.CARTESIA_API_KEY || process.env.CARTESIA_KEY)?.trim();
  let cartesia1Status = await checkCartesiaAccount(
    cartesia1Key,
    c1Limit,
    currentUsage.cartesia1Used,
    currentUsage.cartesia1OverrideRemaining,
    currentUsage.cartesia1QuotaExceeded
  );

  // 3. CARTESIA ACCOUNT 2 CREDITS CHECK
  const cartesia2Key = (process.env.CARTESIA_API_KEY_2 || process.env.CARTESIA_KEY_2)?.trim();
  let cartesia2Status = await checkCartesiaAccount(
    cartesia2Key,
    c2Limit,
    currentUsage.cartesia2Used,
    currentUsage.cartesia2OverrideRemaining,
    currentUsage.cartesia2QuotaExceeded
  );

  // 4. AUTO-SWITCH RECOMMENDATIONS & THRESHOLD
  const threshold = 400;

  res.status(200).json({
    threshold,
    currentMonth: currentUsage.monthKey,
    elevenlabs: elevenStatus,
    cartesiaAccount1: cartesia1Status,
    cartesiaAccount2: cartesia2Status,
    serverUsage: currentUsage,
  });
}

async function checkCartesiaAccount(
  key: string | undefined,
  limit: number,
  trackedUsed: number,
  overrideRemaining?: number | null,
  quotaExceeded?: boolean
) {
  if (!key) {
    return {
      configured: false,
      characterLimit: limit,
      characterCount: 0,
      remainingCredits: 0,
      isLowCredits: true,
      source: 'none' as const,
    };
  }

  // If quota was explicitly exceeded during a synthesis call, remaining is 0
  if (quotaExceeded) {
    return {
      configured: true,
      characterLimit: limit,
      characterCount: limit,
      remainingCredits: 0,
      isLowCredits: true,
      source: 'tracked' as const,
      quotaExceeded: true,
    };
  }

  // If user provided a custom override balance (e.g. from playground dashboard), use that
  if (typeof overrideRemaining === 'number') {
    const remaining = Math.max(0, overrideRemaining);
    return {
      configured: true,
      characterLimit: limit,
      characterCount: Math.max(0, limit - remaining),
      remainingCredits: remaining,
      isLowCredits: remaining <= 400,
      source: 'manual' as const,
    };
  }

  // Try fetching official Cartesia credits endpoint (only works if key is admin key)
  try {
    const res = await fetch('https://api.cartesia.ai/usage/credits?interval=month', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Cartesia-Version': '2026-08-14',
      },
    });

    if (res.ok) {
      const data = await res.json();
      // Bucket response format or total credits
      let totalUsed = 0;
      if (Array.isArray(data)) {
        totalUsed = data.reduce((sum: number, b: any) => sum + (Number(b.credits) || 0), 0);
      } else if (typeof data.credits === 'number') {
        totalUsed = data.credits;
      }
      const remaining = Math.max(0, limit - totalUsed);
      return {
        configured: true,
        characterLimit: limit,
        characterCount: totalUsed,
        remainingCredits: remaining,
        isLowCredits: remaining <= 400,
        source: 'api' as const,
      };
    }
  } catch (_) {
    // Fall back to tracked usage below
  }

  // Standard key: compute using tracked character usage
  const remaining = Math.max(0, limit - trackedUsed);
  return {
    configured: true,
    characterLimit: limit,
    characterCount: trackedUsed,
    remainingCredits: remaining,
    isLowCredits: remaining <= 400,
    source: 'tracked' as const,
  };
}
