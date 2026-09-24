// render.js — assets, bitmap font, pixel primitives, and table layout.
import { L, COLORS } from './config.js';
import { SUITS, RANK_NAMES } from './game.js';

// ---------------------------------------------------------------- assets

export const img = {};   // name → HTMLImageElement
export let font = null;  // parsed font.json

function loadImage(key, src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => { img[key] = im; resolve(); };
    im.onerror = () => reject(new Error('missing ' + src));
    im.src = src;
  });
}

export async function loadAssets() {
  const jobs = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) {
    const n = RANK_NAMES[r] + s;
    jobs.push(loadImage(n, `assets/cards/${n}.png`));
  }
  jobs.push(loadImage('back', 'assets/cards/back.png'));
  for (const n of ['card_select', 'slot_empty', 'stock_recycle', 'logo', 'loss_card', 'foundation_S', 'foundation_H', 'foundation_D', 'foundation_C']) {
    jobs.push(loadImage(n, `assets/ui/${n}.png`));
  }
  jobs.push(loadImage('font', 'assets/font/font.png'));
  jobs.push(fetch('assets/font/font.json').then((r) => r.json()).then((j) => { font = j; }));
  await Promise.all(jobs);
}

// ---------------------------------------------------------------- canvas helpers

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

// Pixel rounded rect: fill with the 1px corners knocked out.
export function pixRect(ctx, x, y, w, h, fill, border) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (border) {
    ctx.fillStyle = border;
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  } else {
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
  }
}

// ---------------------------------------------------------------- font

const tintCache = new Map();

function tinted(color) {
  let c = tintCache.get(color);
  if (c) return c;
  const src = img.font;
  c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  tintCache.set(color, c);
  return c;
}

const glyph = (ch) => font.glyphs[ch] || font.glyphs['?'];

export function textWidth(str, scale = 1, spacing = 1) {
  let w = 0;
  for (let i = 0; i < str.length; i++) w += glyph(str[i]).w + (i ? spacing : 0);
  return w * scale;
}

export const textHeight = (scale = 1) => font.height * scale;

// Draw text at native coords. align: 'left' | 'center' | 'right'.
export function drawText(ctx, str, x, y, { color = COLORS.text, scale = 1, spacing = 1, align = 'left', shadow = null } = {}) {
  str = String(str).toUpperCase();
  const w = textWidth(str, scale, spacing);
  if (align === 'center') x -= w / 2;
  else if (align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  if (shadow) drawRun(ctx, str, x, y + scale, shadow, scale, spacing);
  drawRun(ctx, str, x, y, color, scale, spacing);
  return w;
}

function drawRun(ctx, str, x, y, color, scale, spacing) {
  const atlas = tinted(color);
  const h = font.height;
  for (let i = 0; i < str.length; i++) {
    const g = glyph(str[i]);
    ctx.drawImage(atlas, g.x, 0, g.w, h, x, y, g.w * scale, h * scale);
    x += (g.w + spacing) * scale;
  }
}

// Greedy word wrap measured with the real glyph widths.
export function wrapText(str, maxW, scale = 1, spacing = 2) {
  const words = String(str).toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (!line || textWidth(next, scale, spacing) <= maxW) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

// Logo-style text: gold gradient fill, 1px ink outline, 1px drop shadow,
// shine on the top edge. Same recipe as art_src/ui.py stylize().
const fancyCache = new Map();

export function fancyText(str, { scale = 2, spacing = 1, top = [236, 198, 104], bot = [190, 128, 52] } = {}) {
  str = String(str).toUpperCase();
  const key = [str, scale, spacing, top, bot].join('|');
  let c = fancyCache.get(key);
  if (c) return c;
  const w = textWidth(str, scale, spacing);
  const h = font.height * scale;
  const mask = makeCanvas(w, h);
  drawRun(mask.getContext('2d'), str, 0, 0, '#ffffff', scale, spacing);
  const m = mask.getContext('2d').getImageData(0, 0, mask.width, mask.height).data;
  c = makeCanvas(w + 4, h + 4);
  const g = c.getContext('2d');
  const out = g.createImageData(c.width, c.height);
  const o = out.data;
  const W = c.width;
  const solid = (x, y) => x >= 2 && y >= 2 && x - 2 < mask.width && y - 2 < mask.height && m[((y - 2) * mask.width + (x - 2)) * 4 + 3] > 0;
  const ring = (x, y) => {
    if (solid(x, y)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (solid(x + dx, y + dy)) return true;
    return false;
  };
  const set = (x, y, r, gg, b) => { const i = (y * W + x) * 4; o[i] = r; o[i + 1] = gg; o[i + 2] = b; o[i + 3] = 255; };
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) {
        if (ring(x, y - 1)) set(x, y, 250, 232, 170);
        else {
          const t = (y - 2) / Math.max(1, h - 1);
          set(x, y, top[0] + (bot[0] - top[0]) * t, top[1] + (bot[1] - top[1]) * t, top[2] + (bot[2] - top[2]) * t);
        }
      } else if (ring(x, y)) set(x, y, 43, 36, 32);
      else if (x > 0 && y > 0 && (solid(x - 1, y - 1) || ring(x - 1, y - 1))) set(x, y, 24, 34, 28);
    }
  }
  g.putImageData(out, 0, 0);
  fancyCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- layout

export const colX = (i) => L.TABLE_X + i * (L.CARD_W + L.GAP);
export const STOCK = { x: colX(0), y: L.TOP_Y };
export const WASTE = { x: colX(1), y: L.TOP_Y };
export const foundPos = (i) => ({ x: colX(3 + i), y: L.TOP_Y });

// Fan offsets for one column so it fits between TAB_Y and the window bottom.
// Face-down compresses 4 → 2 first, then face-up 14 → 12, then both evenly.
export function fanFor(col, viewH) {
  const avail = viewH - L.TAB_Y - L.BOTTOM_MARGIN - L.CARD_H;
  let D = 0, U = 0;
  for (let k = 0; k < col.length - 1; k++) (col[k].up ? U++ : D++);
  const need = (d, u) => D * d + U * u;
  if (need(L.FAN_DOWN, L.FAN_UP) <= avail) return { down: L.FAN_DOWN, up: L.FAN_UP };
  if (need(L.FAN_DOWN_MIN, L.FAN_UP) <= avail) return { down: L.FAN_DOWN_MIN, up: L.FAN_UP };
  if (U && need(L.FAN_DOWN_MIN, L.FAN_UP_MIN) <= avail) {
    return { down: L.FAN_DOWN_MIN, up: Math.floor((avail - D * L.FAN_DOWN_MIN) / U) };
  }
  const k = Math.max(0, avail) / Math.max(1, need(L.FAN_DOWN_MIN, L.FAN_UP_MIN));
  return { down: L.FAN_DOWN_MIN * k, up: L.FAN_UP_MIN * k };
}

// Where every card sits for a given state. Returns
//   pos: Map id → { x, y, z }, cols: per column [{ id, y }], plus pile anchors.
export function computeLayout(st, viewH) {
  const pos = new Map();
  let z = 0;
  const put = (c, x, y) => pos.set(c.id, { x, y, z: z++ });

  st.stock.forEach((c) => put(c, STOCK.x, STOCK.y));

  const n = st.waste.length;
  st.waste.forEach((c, k) => {
    const behind = n - 1 - k; // 0 = top
    put(c, WASTE.x - Math.min(behind, 2) * L.WASTE_PEEK, WASTE.y);
  });

  st.found.forEach((f, i) => f.forEach((c) => put(c, foundPos(i).x, foundPos(i).y)));

  const cols = [];
  st.tab.forEach((col, i) => {
    const fan = fanFor(col, viewH);
    let y = L.TAB_Y;
    const entries = [];
    col.forEach((c) => {
      const ry = Math.round(y);
      put(c, colX(i), ry);
      entries.push({ id: c.id, y: ry });
      y += c.up ? fan.up : fan.down;
    });
    cols.push(entries);
  });
  return { pos, cols };
}

export const rectsOverlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export const inRect = (px, py, r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
