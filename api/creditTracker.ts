import fs from 'fs';
import path from 'path';

export interface MonthCreditUsage {
  monthKey: string;
  cartesia1Used: number;
  cartesia2Used: number;
  elevenlabsUsed: number;
  googleUsed?: number;
  elevenlabsLimit?: number;
  cartesia1Limit?: number;
  cartesia2Limit?: number;
  elevenlabsOverrideRemaining?: number | null;
  cartesia1OverrideRemaining?: number | null;
  cartesia2OverrideRemaining?: number | null;
  cartesia1QuotaExceeded?: boolean;
  cartesia2QuotaExceeded?: boolean;
  elevenlabsQuotaExceeded?: boolean;
  lastUpdated: number;
}

let inMemoryUsage: Record<string, MonthCreditUsage> = {};

function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getTmpFilePath(monthKey: string): string {
  return path.join('/tmp', `pelham_credits_${monthKey}.json`);
}

function loadMonthUsage(monthKey: string): MonthCreditUsage {
  if (inMemoryUsage[monthKey]) {
    return inMemoryUsage[monthKey];
  }

  const tmpPath = getTmpFilePath(monthKey);
  try {
    if (fs.existsSync(tmpPath)) {
      const content = fs.readFileSync(tmpPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.cartesia1Used === 'number') {
        // Default to user's real balances if not already calibrated
        if (typeof parsed.elevenlabsOverrideRemaining !== 'number') {
          parsed.elevenlabsOverrideRemaining = 130000;
          parsed.elevenlabsLimit = 150000;
        }
        if (typeof parsed.cartesia1OverrideRemaining !== 'number' || parsed.cartesia1OverrideRemaining === 20000) {
          parsed.cartesia1OverrideRemaining = 120000;
          parsed.cartesia1Limit = 120000;
        }
        if (typeof parsed.cartesia2OverrideRemaining !== 'number' || parsed.cartesia2OverrideRemaining === 20000) {
          parsed.cartesia2OverrideRemaining = 19000;
          parsed.cartesia2Limit = 20000;
        }
        inMemoryUsage[monthKey] = parsed;
        return parsed;
      }
    }
  } catch (_) {
    // Ignore file read issues in read-only environments
  }

  const fresh: MonthCreditUsage = {
    monthKey,
    cartesia1Used: 0,
    cartesia2Used: 0,
    elevenlabsUsed: 0,
    elevenlabsLimit: 150000,
    cartesia1Limit: 120000,
    cartesia2Limit: 20000,
    elevenlabsOverrideRemaining: 130000,
    cartesia1OverrideRemaining: 120000,
    cartesia2OverrideRemaining: 19000,
    lastUpdated: Date.now(),
  };
  inMemoryUsage[monthKey] = fresh;
  saveMonthUsage(fresh);
  return fresh;
}

function saveMonthUsage(data: MonthCreditUsage) {
  inMemoryUsage[data.monthKey] = data;
  const tmpPath = getTmpFilePath(data.monthKey);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf8');
  } catch (_) {
    // Ignore file write issues
  }
}

export function getCurrentMonthUsage(): MonthCreditUsage {
  const key = getMonthKey();
  return loadMonthUsage(key);
}

export function recordCharactersUsed(
  account: 'cartesia1' | 'cartesia2' | 'elevenlabs' | 'google',
  characterCount: number
): MonthCreditUsage {
  const current = getCurrentMonthUsage();
  const count = Math.max(0, characterCount);

  if (account === 'cartesia1') {
    current.cartesia1Used += count;
    if (typeof current.cartesia1OverrideRemaining === 'number') {
      current.cartesia1OverrideRemaining = Math.max(0, current.cartesia1OverrideRemaining - count);
    }
  } else if (account === 'cartesia2') {
    current.cartesia2Used += count;
    if (typeof current.cartesia2OverrideRemaining === 'number') {
      current.cartesia2OverrideRemaining = Math.max(0, current.cartesia2OverrideRemaining - count);
    }
  } else if (account === 'elevenlabs') {
    current.elevenlabsUsed += count;
    if (typeof current.elevenlabsOverrideRemaining === 'number') {
      current.elevenlabsOverrideRemaining = Math.max(0, current.elevenlabsOverrideRemaining - count);
    }
  } else if (account === 'google') {
    current.googleUsed = (current.googleUsed || 0) + count;
  }

  current.lastUpdated = Date.now();
  saveMonthUsage(current);
  return current;
}

export function flagQuotaExceeded(
  account: 'cartesia1' | 'cartesia2' | 'elevenlabs'
): MonthCreditUsage {
  const current = getCurrentMonthUsage();
  if (account === 'cartesia1') {
    current.cartesia1QuotaExceeded = true;
    current.cartesia1OverrideRemaining = 0;
  } else if (account === 'cartesia2') {
    current.cartesia2QuotaExceeded = true;
    current.cartesia2OverrideRemaining = 0;
  } else if (account === 'elevenlabs') {
    current.elevenlabsQuotaExceeded = true;
    current.elevenlabsOverrideRemaining = 0;
  }
  current.lastUpdated = Date.now();
  saveMonthUsage(current);
  return current;
}

export function setCustomRemainingBalance(
  account: 'cartesia1' | 'cartesia2' | 'elevenlabs',
  remainingCredits: number,
  limit?: number
): MonthCreditUsage {
  const current = getCurrentMonthUsage();
  const balance = Math.max(0, remainingCredits);

  if (account === 'cartesia1') {
    current.cartesia1OverrideRemaining = balance;
    current.cartesia1QuotaExceeded = balance <= 0;
    if (typeof limit === 'number' && limit > 0) {
      current.cartesia1Limit = limit;
    } else if (!current.cartesia1Limit || current.cartesia1Limit < balance) {
      current.cartesia1Limit = Math.max(balance, 120000);
    }
  } else if (account === 'cartesia2') {
    current.cartesia2OverrideRemaining = balance;
    current.cartesia2QuotaExceeded = balance <= 0;
    if (typeof limit === 'number' && limit > 0) {
      current.cartesia2Limit = limit;
    } else if (!current.cartesia2Limit || current.cartesia2Limit < balance) {
      current.cartesia2Limit = Math.max(balance, 20000);
    }
  } else if (account === 'elevenlabs') {
    current.elevenlabsOverrideRemaining = balance;
    current.elevenlabsQuotaExceeded = balance <= 0;
    if (typeof limit === 'number' && limit > 0) {
      current.elevenlabsLimit = limit;
    } else if (!current.elevenlabsLimit || current.elevenlabsLimit < balance) {
      current.elevenlabsLimit = Math.max(balance, 150000);
    }
  }
  current.lastUpdated = Date.now();
  saveMonthUsage(current);
  return current;
}

export function syncAllActualBalances(balances: {
  elevenlabs?: number;
  cartesia1?: number;
  cartesia2?: number;
}): MonthCreditUsage {
  const current = getCurrentMonthUsage();
  if (typeof balances.elevenlabs === 'number') {
    const el = Math.max(0, balances.elevenlabs);
    current.elevenlabsOverrideRemaining = el;
    current.elevenlabsQuotaExceeded = el <= 0;
    current.elevenlabsLimit = Math.max(el, 150000);
  }
  if (typeof balances.cartesia1 === 'number') {
    const c1 = Math.max(0, balances.cartesia1);
    current.cartesia1OverrideRemaining = c1;
    current.cartesia1QuotaExceeded = c1 <= 0;
    current.cartesia1Limit = Math.max(c1, 120000);
  }
  if (typeof balances.cartesia2 === 'number') {
    const c2 = Math.max(0, balances.cartesia2);
    current.cartesia2OverrideRemaining = c2;
    current.cartesia2QuotaExceeded = c2 <= 0;
    current.cartesia2Limit = Math.max(c2, 20000);
  }
  current.lastUpdated = Date.now();
  saveMonthUsage(current);
  return current;
}
