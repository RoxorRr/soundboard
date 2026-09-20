/**
 * Utility functions for hockey penalty durations, spoken vocal representations,
 * custom penalty time parsing, and persistence of default penalty times across games.
 */

const NUMBER_WORDS: Record<number, string> = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
  13: 'thirteen',
  14: 'fourteen',
  15: 'fifteen',
  16: 'sixteen',
  17: 'seventeen',
  18: 'eighteen',
  19: 'nineteen',
  20: 'twenty',
  25: 'twenty-five',
  30: 'thirty',
  35: 'thirty-five',
  40: 'forty',
  45: 'forty-five',
  50: 'fifty',
  55: 'fifty-five',
};

export function numberToWord(n: number): string {
  if (NUMBER_WORDS[n]) return NUMBER_WORDS[n];
  if (n < 0) return 'zero';
  if (n < 20) return `${n}`;

  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;
  const tensWord = NUMBER_WORDS[tens] || `${tens}`;
  const onesWord = NUMBER_WORDS[ones] || `${ones}`;

  return ones === 0 ? tensWord : `${tensWord}-${onesWord}`;
}

export function formatMinutesAndSecondsToSpoken(minutes: number, seconds: number): string {
  const m = Math.max(0, Math.floor(minutes || 0));
  const s = Math.max(0, Math.min(59, Math.floor(seconds || 0)));

  if (m === 0 && s === 0) return '';

  if (m > 0 && s === 0) {
    return m === 1 ? 'one minute' : `${numberToWord(m)} minutes`;
  }

  if (m === 0 && s > 0) {
    return s === 1 ? 'one second' : `${numberToWord(s)} seconds`;
  }

  const minPart = m === 1 ? 'one minute' : `${numberToWord(m)} minutes`;
  const secPart = `${numberToWord(s)} seconds`;
  return `${minPart} and ${secPart}`;
}

export function formatDurationDisplay(minutes: number, seconds: number): string {
  const m = Math.max(0, Math.floor(minutes || 0));
  const s = Math.max(0, Math.min(59, Math.floor(seconds || 0)));
  if (m === 0 && s === 0) return 'Without Time';
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export interface PenaltyDurationOption {
  id: string;
  label: string;
  sublabel: string;
  value: string; // Spoken text for audio prompt
  minutes: number;
  seconds: number;
  isSpecial?: boolean;
}

export const STANDARD_PENALTY_DURATIONS: PenaltyDurationOption[] = [
  {
    id: 'none',
    label: 'Without Time',
    sublabel: 'No duration in announcement',
    value: '',
    minutes: 0,
    seconds: 0,
    isSpecial: true,
  },
  {
    id: '1-00',
    label: '1:00 Min',
    sublabel: '1:00 (Short period)',
    value: 'one minute',
    minutes: 1,
    seconds: 0,
  },
  {
    id: '1-15',
    label: '1:15 Min',
    sublabel: '1:15 (Youth mini)',
    value: 'one minute and fifteen seconds',
    minutes: 1,
    seconds: 15,
  },
  {
    id: '1-30',
    label: '1:30 Min',
    sublabel: '1:30 (USA/Youth minor)',
    value: 'one minute and thirty seconds',
    minutes: 1,
    seconds: 30,
  },
  {
    id: '2-00',
    label: '2:00 Min',
    sublabel: '2:00 (Standard Minor)',
    value: 'two minutes',
    minutes: 2,
    seconds: 0,
  },
  {
    id: '2-30',
    label: '2:30 Min',
    sublabel: '2:30 (Running/Extended)',
    value: 'two minutes and thirty seconds',
    minutes: 2,
    seconds: 30,
  },
  {
    id: '3-00',
    label: '3:00 Min',
    sublabel: '3:00 (Running Clock)',
    value: 'three minutes',
    minutes: 3,
    seconds: 0,
  },
  {
    id: '4-00',
    label: '4:00 Min',
    sublabel: '4:00 (Double Minor)',
    value: 'four minutes',
    minutes: 4,
    seconds: 0,
  },
  {
    id: '5-00',
    label: '5:00 Min',
    sublabel: '5:00 (Major)',
    value: 'five minutes',
    minutes: 5,
    seconds: 0,
  },
  {
    id: '10-00',
    label: '10:00 Min',
    sublabel: '10:00 (Misconduct)',
    value: 'ten minutes',
    minutes: 10,
    seconds: 0,
  },
];

const DEFAULT_DURATION_KEY = 'pelham_game_penalty_duration_v1';
const DEFAULT_LABEL_KEY = 'pelham_game_penalty_label_v1';

/**
 * Retrieve saved default penalty duration for current game session.
 * Falls back to 'two minutes'.
 */
export function getSavedGamePenaltyDuration(): { value: string; label: string } {
  if (typeof window === 'undefined') {
    return { value: 'two minutes', label: '2:00 Min' };
  }
  try {
    const val = localStorage.getItem(DEFAULT_DURATION_KEY);
    const lbl = localStorage.getItem(DEFAULT_LABEL_KEY);
    if (val !== null) {
      return { value: val, label: lbl || val || '2:00 Min' };
    }
  } catch (_) {}
  return { value: 'two minutes', label: '2:00 Min' };
}

/**
 * Persist chosen penalty duration as game default so future penalties in this game start with it.
 */
export function saveGamePenaltyDuration(value: string, label: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEFAULT_DURATION_KEY, value);
    localStorage.setItem(DEFAULT_LABEL_KEY, label);
  } catch (_) {}
}
