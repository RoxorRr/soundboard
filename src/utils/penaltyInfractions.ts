export const DEFAULT_COMMON_PENALTIES: string[] = [
  'hooking',
  'slashing',
  'tripping',
  'body check',
  'body checking',
  'roughing',
  'interference',
  'high-sticking',
  'cross-checking',
  'holding',
  'boarding',
  'charging',
  'elbowing',
  'checking from behind',
  'head contact',
  'kneeing',
  'delay of game',
  'unsportsmanlike conduct',
  'too many men',
  'spearing',
  'butt-ending',
  'fighting',
  'misconduct',
];

export const PENALTY_STORAGE_KEY = 'pelham_custom_penalty_infractions';

export function getSavedCustomPenalties(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENALTY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => Boolean(item));
    }
  } catch (err) {
    console.warn('Failed to load custom penalty infractions from localStorage:', err);
  }
  return [];
}

export function getAllPenaltyInfractions(): string[] {
  const custom = getSavedCustomPenalties();
  const lowerDefaults = DEFAULT_COMMON_PENALTIES.map((p) => p.toLowerCase());
  
  // Filter out custom ones that might duplicate defaults
  const uniqueCustom = custom.filter((c) => !lowerDefaults.includes(c.toLowerCase()));
  
  return [...DEFAULT_COMMON_PENALTIES, ...uniqueCustom];
}

export function saveCustomPenalty(infraction: string): { success: boolean; list: string[]; error?: string } {
  const clean = infraction.trim().toLowerCase();
  if (!clean) {
    return { success: false, list: getAllPenaltyInfractions(), error: 'Penalty name cannot be empty' };
  }

  const currentCustom = getSavedCustomPenalties();
  const lowerDefaults = DEFAULT_COMMON_PENALTIES.map((p) => p.toLowerCase());

  if (lowerDefaults.includes(clean)) {
    return { success: false, list: getAllPenaltyInfractions(), error: `"${infraction}" is already in standard categories` };
  }

  const alreadySaved = currentCustom.some((c) => c.toLowerCase() === clean);
  if (alreadySaved) {
    return { success: false, list: getAllPenaltyInfractions(), error: `"${infraction}" is already in your saved custom penalties` };
  }

  const updatedCustom = [...currentCustom, clean];
  try {
    localStorage.setItem(PENALTY_STORAGE_KEY, JSON.stringify(updatedCustom));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pelham-penalties-changed', { detail: { custom: updatedCustom } }));
    }
    return { success: true, list: getAllPenaltyInfractions() };
  } catch (err) {
    console.warn('Failed to save custom penalty:', err);
    return { success: false, list: getAllPenaltyInfractions(), error: 'Could not save to local storage' };
  }
}

export function removeCustomPenalty(infraction: string): string[] {
  const clean = infraction.trim().toLowerCase();
  const currentCustom = getSavedCustomPenalties();
  const updatedCustom = currentCustom.filter((c) => c.toLowerCase() !== clean);

  try {
    localStorage.setItem(PENALTY_STORAGE_KEY, JSON.stringify(updatedCustom));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pelham-penalties-changed', { detail: { custom: updatedCustom } }));
    }
  } catch (err) {
    console.warn('Failed to remove custom penalty:', err);
  }

  return getAllPenaltyInfractions();
}

export function isCustomSavedPenalty(infraction: string): boolean {
  const clean = infraction.trim().toLowerCase();
  const custom = getSavedCustomPenalties();
  return custom.some((c) => c.toLowerCase() === clean);
}
