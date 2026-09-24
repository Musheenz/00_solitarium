// config.js — the knobs.

export const COLORS = {
  felt: '#2F4234',
  feltDark: '#26372B',
  feltLine: '#4E6854',
  card: '#EEE4CE',
  ink: '#2B2420',
  red: '#9E2B26',
  gold: '#ECC668',
  goldDeep: '#BE8034',
  shine: '#FAE8AA',
  text: '#EEE4CE',
  dim: '#9DB09F',
  shadow: '#18221C',
};

// Layout, in native pixels (1 native px = 1 card pixel).
export const L = {
  W: 452,          // layout width
  MIN_H: 216,      // brief says 240; 216 keeps scale 3 inside a Chromebook app window (see README)
  SIDEBAR_W: 76,
  TABLE_X: 82,
  CARD_W: 46,
  CARD_H: 64,
  GAP: 6,
  TOP_Y: 4,
  TAB_Y: 74,
  BOTTOM_MARGIN: 3,
  FAN_DOWN: 4,
  FAN_DOWN_MIN: 2,
  FAN_UP: 14,
  FAN_UP_MIN: 12,  // ≥ 12 keeps the rank index readable
  WASTE_PEEK: 2,
};

export const TIMING = {
  hover: 80,
  snap: 120,
  flyBack: 150,
  fly: 150,
  flip: 120,
  dealStagger: 25,
  autoFinishStagger: 70,
  doubleClick: 400,
  quipCooldown: 20000, // at most one quip per 20 s...
  quipChance: 1 / 2,    // ...and only on half of the bad drops
  quipLife: 1200,
};

export const STORAGE_KEY = 'johns-solitaire-v1';
