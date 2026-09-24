// save.js — one localStorage record: stats, settings, and the game in progress.
import { STORAGE_KEY } from './config.js';

export const SAVE_VERSION = 1;

export function freshStats() {
  return {
    played: 0, won: 0, lost: 0,
    streak: 0, bestStreak: 0,
    bestTime: 0,   // ms, 0 = none yet
    bestScore: 0,
    totalTime: 0,  // ms of finished games
  };
}

// Every install starts from zero: John puts his own miles on it.
export function freshSave() {
  return {
    version: SAVE_VERSION,
    stats: freshStats(),
    game: null,        // game.js state of the game in progress
    counted: false,    // has the game in progress been counted as played?
    sound: true,       // effects
    music: false,      // off until John asks for it, so it never startles him
    sfxVol: 1,
    musicVol: 0.5,
  };
}

export function load() {
  let data = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch { data = null; }
  if (!data || typeof data !== 'object' || !data.stats) {
    data = freshSave();
    try { navigator.storage?.persist?.(); } catch { /* optional */ }
    write(data);
    return data;
  }
  // Fill in anything a newer version added.
  const base = freshSave();
  data.stats = { ...freshStats(), ...data.stats };
  for (const k of Object.keys(base)) if (!(k in data)) data[k] = base[k];
  data.version = SAVE_VERSION;
  return data;
}

export function write(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    // Storage full: drop the undo history rather than lose the stats.
    try {
      if (data.game) data.game = { ...data.game, history: data.game.history.slice(-50) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch { return false; }
  }
}

// ---------------------------------------------------------------- backup code
// "WON-PLAYED-STREAK-CHECK" in base36, e.g. "36F-5K2-1B-X9".

// FNV-1a over the digits, folded to two base36 chars. Catches single-character typos.
function checksum(won, played, best) {
  let h = 0x811c9dc5;
  for (const ch of `${won}/${played}/${best}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return (h % 1296).toString(36).toUpperCase().padStart(2, '0');
}

export function backupCode(stats) {
  const b = (n) => Math.max(0, Math.floor(n)).toString(36).toUpperCase();
  return `${b(stats.won)}-${b(stats.played)}-${b(stats.bestStreak)}-${checksum(stats.won, stats.played, stats.bestStreak)}`;
}

// Returns { won, played, bestStreak } or null if the code is mistyped.
export function parseBackupCode(code) {
  const parts = String(code).trim().toUpperCase().replace(/\s+/g, '').split('-');
  if (parts.length !== 4 || parts.some((p) => !/^[0-9A-Z]+$/.test(p))) return null;
  const [won, played, bestStreak] = parts.slice(0, 3).map((p) => parseInt(p, 36));
  if (checksum(won, played, bestStreak) !== parts[3].padStart(2, '0')) return null;
  if (won > played) return null;
  return { won, played, bestStreak };
}
