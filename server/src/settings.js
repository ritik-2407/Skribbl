// Room settings: defaults + SERVER-SIDE validation.
// Never trust the client: a modified client could send maxPlayers=9999 or drawTime=-5.


export const LIMITS = {
  maxPlayers: { min: 2, max: 20 },
  rounds: { min: 2, max: 10 },
  drawTime: { min: 15, max: 240 },
  wordCount: { min: 1, max: 5 },
  hints: { min: 0, max: 5 },
};

export const WORD_MODES = ['normal', 'hidden', 'combination'];

export const DEFAULT_SETTINGS = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'normal',
  isPrivate: true,
};

function toIntInRange(value, { min, max }, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n)); // clamp into range
}

// Takes whatever the client sent and returns a safe, complete settings object.
export function sanitizeSettings(input = {}) {
  const d = DEFAULT_SETTINGS;
  return {
    maxPlayers: toIntInRange(input.maxPlayers, LIMITS.maxPlayers, d.maxPlayers),
    rounds: toIntInRange(input.rounds, LIMITS.rounds, d.rounds),
    drawTime: toIntInRange(input.drawTime, LIMITS.drawTime, d.drawTime),
    wordCount: toIntInRange(input.wordCount, LIMITS.wordCount, d.wordCount),
    hints: toIntInRange(input.hints, LIMITS.hints, d.hints),
    wordMode: WORD_MODES.includes(input.wordMode) ? input.wordMode : d.wordMode,
    isPrivate: typeof input.isPrivate === 'boolean' ? input.isPrivate : d.isPrivate,
  };
}

export function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 20);
  return clean.length > 0 ? clean : null;
}
