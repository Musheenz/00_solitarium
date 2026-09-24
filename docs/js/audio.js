// audio.js — sound hooks. Drop files into docs/audio/ as NAME.ogg, .mp3 or .wav.
// Anything missing just stays silent.
//
// The basic kit is three files:
//   main_theme   background music, loops
//   card_slot    a card lands (tableau, foundation, undo)
//   mistake      an illegal drop bounces back
// Each game event tries its own file first, then falls back to the basic kit,
// so more specific sounds can be added later without touching code.

const EVENTS = {
  place: ['place', 'card_slot'],
  foundation: ['foundation', 'card_slot'],
  invalid: ['invalid', 'mistake'],
  flip: ['flip'],
  pick: ['pick'],
  deal: ['deal'],
  shuffle: ['shuffle'],
  recycle: ['recycle'],
  win_fanfare: ['win_fanfare'],
  loss_sting: ['loss_sting'],
  quip_blip: ['quip_blip'],
  ui_click: ['ui_click'],
};
const MUSIC = ['main_theme', 'music_loop'];
const FORMATS = ['ogg', 'mp3', 'wav'];

let ctx = null;
let sfxGain = null;
let musicGain = null;
let musicNode = null;
const buffers = new Map(); // file name → AudioBuffer
let enabled = true;
let musicOn = true;
let sfxVol = 1;
let musicVol = 0.5;
let onMusicReady = null;

// audio/audio.json (written by tools/release.mjs) lists the files that exist,
// so a deployed build never probes for missing ones. Without it, probe.
async function listing() {
  try {
    const res = await fetch('audio/audio.json');
    if (res.ok) return new Set(await res.json());
  } catch { /* probe instead */ }
  return null;
}

async function fetchBuffer(name, have) {
  for (const ext of FORMATS) {
    const file = `${name}.${ext}`;
    if (have && !have.has(file)) continue;
    try {
      const res = await fetch(`audio/${file}`);
      if (!res.ok) continue;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch { /* try the next format */ }
  }
  return null;
}

// Call from the first user gesture (the splash click).
export async function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  } catch { ctx = null; return; }
  sfxGain = ctx.createGain();
  musicGain = ctx.createGain();
  sfxGain.connect(ctx.destination);
  musicGain.connect(ctx.destination);
  applyVolumes();
  const have = await listing();
  const names = new Set(Object.values(EVENTS).flat());
  for (const name of names) fetchBuffer(name, have).then((b) => b && buffers.set(name, b));
  for (const name of MUSIC) {
    const b = await fetchBuffer(name, have);
    if (b) {
      buffers.set('music', b);
      startMusic();
      onMusicReady?.();
      break;
    }
  }
}

function applyVolumes() {
  if (!ctx) return;
  sfxGain.gain.value = enabled ? sfxVol : 0;
  musicGain.gain.setTargetAtTime(enabled && musicOn ? musicVol : 0, ctx.currentTime, 0.15);
}

function startMusic() {
  const b = buffers.get('music');
  if (!ctx || !b || musicNode) return;
  musicNode = ctx.createBufferSource();
  musicNode.buffer = b;
  musicNode.loop = true;
  musicNode.connect(musicGain);
  musicNode.start();
}

export const hasMusic = () => buffers.has('music');
export function whenMusicReady(fn) { onMusicReady = fn; }

export function play(event, { rate = 1, volume = 1 } = {}) {
  if (!ctx || !enabled) return;
  const chain = EVENTS[event] || [event];
  const b = chain.map((n) => buffers.get(n)).find(Boolean);
  if (!b) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = rate;
    let out = sfxGain;
    if (volume !== 1) {
      out = ctx.createGain();
      out.gain.value = volume;
      out.connect(sfxGain);
    }
    src.connect(out);
    src.start();
  } catch { /* never let sound break the game */ }
}

export function setAudio({ on = enabled, music = musicOn, sfx = sfxVol, musicVolume = musicVol } = {}) {
  enabled = on;
  musicOn = music;
  sfxVol = sfx;
  musicVol = musicVolume;
  applyVolumes();
}

export function suspendAudio(hidden) {
  if (!ctx) return;
  if (hidden) ctx.suspend?.(); else ctx.resume?.();
}
