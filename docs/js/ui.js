// ui.js — sidebar, buttons, dialogs, splash, win sequence, quips, particles.
// Everything draws in native pixels on the shared canvas. Buttons are rebuilt
// every frame into app.buttons so hit-testing always matches what's drawn.
import { L, COLORS, TIMING } from './config.js';
import { img, drawText, textWidth, wrapText, fancyText, pixRect, foundPos, makeCanvas } from './render.js';
import { tween, ease, setBusy, requestFrame, clamp } from './anim.js';
import { backupCode } from './save.js';
import * as LINES from './lines.js';

const CX = L.W / 2; // dialogs center on the layout

export const fmtNum = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}

// ---------------------------------------------------------------- buttons

export function button(app, id, x, y, w, h, label, action, { primary = false, big = false, off = false } = {}) {
  const b = { id, x, y, w, h, label, action };
  app.buttons.push(b);
  const hover = app.ui.hover === id;
  const press = app.ui.press === id && hover;
  const oy = press ? 1 : 0;
  let fill = hover ? '#4A6450' : '#3A5040';
  let border = COLORS.shadow;
  let textCol = COLORS.text;
  if (primary) { fill = hover ? COLORS.shine : COLORS.gold; textCol = COLORS.ink; border = COLORS.ink; }
  if (off) fill = hover ? '#B3362F' : COLORS.red; // a toggle that's switched off
  if (press) fill = primary ? COLORS.goldDeep : off ? '#7C211D' : '#2C3D31';
  if (!press) pixRect(app.ctx, x, y + 1, w, h, COLORS.shadow); // drop edge
  pixRect(app.ctx, x, y + oy, w, h, fill, border);
  if (!press && !primary) { app.ctx.fillStyle = 'rgba(255,255,255,0.08)'; app.ctx.fillRect(x + 2, y + 1, w - 4, 1); }
  const scale = big ? 2 : 1;
  drawText(app.ctx, label, x + w / 2, y + oy + Math.round((h - 10 * scale) / 2), { color: textCol, align: 'center', scale, spacing: 1 });
  return b;
}

// ---------------------------------------------------------------- sidebar

export function drawSidebar(app) {
  const ctx = app.ctx;
  const st = app.st;
  const stats = app.data.stats;
  const x0 = 2, w = L.SIDEBAR_W - 4;

  const logo = fancyText("JOHN'S", { scale: 1 });
  ctx.drawImage(logo, Math.round(L.SIDEBAR_W / 2 - logo.width / 2), 3);

  drawText(ctx, 'WINS', L.SIDEBAR_W / 2, 21, { color: COLORS.dim, align: 'center' });
  const winsShown = app.winsDisplay ?? stats.won;
  const ws = fmtNum(winsShown);
  const scale = textWidth(ws, 2, 1) <= w ? 2 : 1;
  ctx.save();
  const pop = app.winsPop || 0;
  if (pop) {
    ctx.translate(L.SIDEBAR_W / 2, 43);
    ctx.scale(1 + pop * 0.3, 1 + pop * 0.3);
    ctx.translate(-L.SIDEBAR_W / 2, -43);
  }
  drawText(ctx, ws, L.SIDEBAR_W / 2, 33, { color: COLORS.gold, scale, align: 'center', shadow: COLORS.shadow });
  ctx.restore();

  const row = (label, value, y) => {
    drawText(ctx, label, x0 + 1, y, { color: COLORS.dim });
    drawText(ctx, value, x0 + w - 1, y, { color: COLORS.text, align: 'right' });
  };
  ctx.fillStyle = COLORS.feltLine;
  ctx.fillRect(x0 + 2, 58, w - 4, 1);
  row('SCORE', fmtNum(st.score), 62);
  row('TIME', fmtTime(app.elapsed()), 75);
  row('GAMES', fmtNum(stats.played), 88);
  row('WIN %', stats.played ? Math.round((stats.won / stats.played) * 100) + '%' : '-', 101);
  ctx.fillRect(x0 + 2, 115, w - 4, 1);

  // five buttons must fit above L.MIN_H (216): 119 + 5 × 19 − 2 = 212
  const bh = 17, gap = 2;
  let y = 119;
  const blocked = !!app.modal;
  const B = (id, label, action, opts) => {
    const b = button(app, id, x0, y, w, bh, label, action, opts);
    b.sidebar = true;
    b.disabled = blocked;
    y += bh + gap;
  };
  B('new', 'NEW GAME', () => app.onNewGameButton());
  B('undo', 'UNDO', () => app.onUndo());
  B('stats', 'STATS', () => app.openStats());
  const music = app.data.music, sfx = app.data.sound;
  B('music', music ? 'MUSIC: ON' : 'MUSIC: OFF', () => app.toggleMusic(), { off: !music });
  B('sound', sfx ? 'SOUNDS: ON' : 'SOUNDS: OFF', () => app.toggleSound(), { off: !sfx });
}

// ---------------------------------------------------------------- panels

function panel(ctx, x, y, w, h) {
  pixRect(ctx, x + 2, y + 3, w, h, 'rgba(12,18,14,0.55)');
  pixRect(ctx, x, y, w, h, COLORS.feltDark, COLORS.ink);
  ctx.fillStyle = COLORS.feltLine;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
}

function dim(app, a = 0.45) {
  const ctx = app.ctx;
  ctx.fillStyle = `rgba(10,16,12,${a})`;
  ctx.fillRect(app.view.left, 0, app.view.w, app.view.h);
}

// ---------------------------------------------------------------- modals

// Each modal: { type, born, ...state }. drawModal dispatches by type.
export function drawModal(app, time) {
  const m = app.modal;
  if (!m) return;
  const f = MODALS[m.type];
  if (f) f(app, m, time);
}

const MODALS = {
  splash(app, m, time) {
    const ctx = app.ctx;
    ctx.fillStyle = COLORS.felt;
    ctx.fillRect(app.view.left, 0, app.view.w, app.view.h);
    const logo = img.logo;
    const k = clamp(Math.floor(Math.min((app.view.w - 24) / logo.width, (app.view.h - 70) / logo.height)), 1, 4);
    const t = clamp((time - m.born) / 450, 0, 1);
    const drop = (1 - ease.outBack(t)) * -20;
    const lx = Math.round(CX - (logo.width * k) / 2);
    const ly = Math.round(app.view.h / 2 - (logo.height * k) / 2 - 22 + drop);
    ctx.drawImage(logo, lx, ly, logo.width * k, logo.height * k);
    const by = ly + logo.height * k + 10;
    drawText(ctx, 'WINS: ' + fmtNum(app.data.stats.won), CX, by, { color: COLORS.gold, scale: 2, align: 'center', shadow: COLORS.shadow });
    drawText(ctx, m.line, CX, by + 26, { color: COLORS.text, align: 'center', spacing: 2 });
    // Waits for a click (which also unlocks sound). Static text, so no frames burn while waiting.
    if (time - m.born > 900) {
      drawText(ctx, 'CLICK TO PLAY', CX, app.view.h - 14, { color: COLORS.dim, align: 'center', spacing: 2 });
    }
  },

  confirm(app, m) {
    dim(app);
    const ctx = app.ctx;
    const w = 180, h = 64, x = Math.round(CX - w / 2), y = Math.round(app.view.h / 2 - h / 2);
    panel(ctx, x, y, w, h);
    drawText(ctx, m.text, CX, y + 12, { color: COLORS.gold, align: 'center', spacing: 2 });
    button(app, 'yes', x + 14, y + 36, 70, 18, 'YES', m.yes, { primary: true });
    button(app, 'no', x + w - 84, y + 36, 70, 18, 'NO', m.no);
  },

  loss(app, m, time) {
    dim(app, 0.5);
    const ctx = app.ctx;
    const cardW = img.loss_card.width * 3, cardH = img.loss_card.height * 3;
    const textW = 170;
    const total = cardW + 14 + textW;
    const x0 = Math.round(CX - total / 2);
    const cy = Math.round(app.view.h / 2);

    // card drops in, tilted, wobbling to rest
    const age = (time - m.born) / 1000;
    const dropT = clamp(age / 0.45, 0, 1);
    const yOff = (1 - ease.outBounce(dropT)) * -(cardH + 40);
    const wob = Math.exp(-age / 0.5) * Math.sin(age * 14) * 0.12;
    const ang = -0.07 + wob;
    ctx.save();
    ctx.translate(x0 + cardW / 2, cy + yOff);
    ctx.rotate(ang);
    pixRect(ctx, -cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 'rgba(10,16,12,0.5)');
    ctx.drawImage(img.loss_card, -cardW / 2, -cardH / 2, cardW, cardH);
    ctx.restore();
    if (age > 2.5) setBusy('loss', false);

    const tx = x0 + cardW + 14;
    const lines = wrapText(m.line, textW, 1, 2);
    const btnH = 18;
    const blockH = lines.length * 13 + 12 + btnH * (m.stuck ? 2 : 1) + (m.stuck ? 4 : 0);
    let y = Math.round(cy - blockH / 2);
    const tA = clamp((age - 0.25) / 0.25, 0, 1);
    ctx.globalAlpha = tA;
    for (const ln of lines) {
      drawText(ctx, ln, tx, y, { color: COLORS.text, spacing: 2, shadow: COLORS.shadow });
      y += 13;
    }
    ctx.globalAlpha = 1;
    y += 12;
    button(app, 'deal', tx, y, 110, btnH, 'DEAL AGAIN', () => app.dealAgain(), { primary: true });
    if (m.stuck) button(app, 'undo2', tx, y + btnH + 4, 110, btnH, 'UNDO', () => app.undoFromLoss());
  },

  stats(app) {
    dim(app);
    const ctx = app.ctx;
    const s = app.data.stats;
    const w = 300, h = 196;
    const x = Math.round(CX - w / 2), y = Math.max(4, Math.round(app.view.h / 2 - h / 2));
    panel(ctx, x, y, w, h);
    drawText(ctx, 'SERVICE RECORD', CX, y + 7, { color: COLORS.gold, align: 'center', spacing: 2, shadow: COLORS.shadow });
    const pct = s.played ? Math.round((s.won / s.played) * 100) + '%' : '-';
    const items = [
      ['WON', fmtNum(s.won)], ['PLAYED', fmtNum(s.played)], ['LOST', fmtNum(s.lost)],
      ['WIN %', pct], ['STREAK', fmtNum(s.streak)], ['BEST STREAK', fmtNum(s.bestStreak)],
      ['BEST TIME', s.bestTime ? fmtTime(s.bestTime) : '-'], ['BEST SCORE', s.bestScore ? fmtNum(s.bestScore) : '-'],
      ['TIME PLAYED', fmtTime(s.totalTime + (app.data.counted && !app.st.won ? app.elapsed() : 0))],
    ];
    const cw = (w - 16) / 3;
    items.forEach(([label, value], i) => {
      const cx = x + 8 + cw * (i % 3) + cw / 2;
      const ry = y + 24 + Math.floor(i / 3) * 40;
      drawText(ctx, label, cx, ry, { color: COLORS.dim, align: 'center' });
      const sc = textWidth(value, 2, 1) <= cw - 4 ? 2 : 1;
      drawText(ctx, value, cx, ry + 12 + (sc === 1 ? 5 : 0), { color: i === 0 ? COLORS.gold : COLORS.text, scale: sc, align: 'center', shadow: COLORS.shadow });
    });
    drawText(ctx, 'BACKUP: ' + backupCode(s), CX, y + h - 44, { color: COLORS.dim, align: 'center', spacing: 2 });
    button(app, 'close', Math.round(CX - 40), y + h - 27, 80, 18, 'CLOSE', () => app.closeModal());
  },

  win(app, m, time) {
    const ctx = app.ctx;
    if (m.phase === 'cascade') return; // drawn by the cascade itself
    // frozen cascade trails behind everything
    if (m.trail) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(m.trail, 0, 0);
      ctx.restore();
    }
    dim(app, 0.35);
    // the live sidebar, so the WINS count pops there too
    ctx.fillStyle = COLORS.feltDark;
    ctx.fillRect(app.view.left, 0, L.SIDEBAR_W + 2 - app.view.left, app.view.h);
    ctx.fillStyle = COLORS.feltLine;
    ctx.fillRect(L.SIDEBAR_W + 2, 0, 1, app.view.h);
    drawSidebar(app);
    const age = time - m.bannerBorn;
    const banner = fancyText('JOHN WINS AGAIN!', { scale: 3 });
    const t = clamp(age / 700, 0, 1);
    const bx = Math.round(CX + L.SIDEBAR_W / 2 - banner.width / 2);
    const by = Math.round(14 + (1 - ease.outBounce(t)) * -(banner.height + 30));
    const y0 = 14 + banner.height + 8;
    const cx = bx + banner.width / 2;
    // backing panel so the text reads over the trails
    const pw = Math.max(banner.width - 30, 260), ph = 118;
    ctx.globalAlpha = clamp(age / 300, 0, 1);
    panel(ctx, Math.round(cx - pw / 2), y0 - 8, pw, ph);
    ctx.globalAlpha = 1;
    ctx.drawImage(banner, bx, by);

    // WINS ticks from old to new once the banner lands
    const tickT = clamp((age - 750) / 500, 0, 1);
    const shown = Math.round(m.oldWins + (m.newWins - m.oldWins) * tickT);
    if (tickT >= 1 && !m.popped) {
      m.popped = true;
      app.winsDisplay = null;
      m.pop = 1;
      tween(m, { pop: 0 }, { dur: 350 });
      app.winsPop = 1;
      tween(app, { winsPop: 0 }, { dur: 350 });
      sparkle(app, cx, y0 + 14, 18);
      sparkle(app, L.SIDEBAR_W / 2, 43, 10);
      app.sound('ui_click');
    }
    const ws = 'WINS: ' + fmtNum(shown);
    ctx.save();
    const pop = m.pop || 0;
    ctx.translate(cx, y0 + 10);
    ctx.scale(1 + pop * 0.35, 1 + pop * 0.35);
    drawText(ctx, ws, 0, -10, { color: COLORS.gold, scale: 2, align: 'center', shadow: COLORS.shadow });
    ctx.restore();

    if (age < 1300) return;
    const a = clamp((age - 1300) / 250, 0, 1);
    ctx.globalAlpha = a;
    let y = y0 + 30;
    for (const ln of wrapText(m.line, pw - 16, 1, 2)) {
      drawText(ctx, ln, cx, y, { color: COLORS.text, align: 'center', spacing: 2, shadow: COLORS.shadow });
      y += 13;
    }
    y += 4;
    drawText(ctx, `SCORE ${fmtNum(m.score)}   TIME ${fmtTime(m.time)}`, cx, y, { color: COLORS.dim, align: 'center', spacing: 2 });
    ctx.globalAlpha = 1;
    if (a >= 1) {
      button(app, 'newwin', Math.round(cx - 50), y0 + ph - 32, 100, 18, 'NEW GAME', () => app.dealAgain(), { primary: true });
    } else requestFrame();
  },
};

// ---------------------------------------------------------------- win cascade
//
// Classic MS bouncing cards. Drawn straight onto the canvas without clearing,
// so every card leaves a trail. Positions are whole native pixels so the
// trails stay crisp.

export function startCascade(app, m) {
  const piles = app.st.found.map((f) => f.slice());
  m.cascade = { piles, active: [], next: 0, lastLaunch: 0, order: 0 };
  setBusy('cascade', true);
}

export function stepCascade(app, time, dt) {
  const m = app.modal;
  const cz = m.cascade;
  const ctx = app.ctx;
  const g = 520; // native px/s²
  const floor = app.view.h - L.CARD_H;
  // launch the next card: round robin over foundations, top cards first
  if (time - cz.lastLaunch > 160 && cz.piles.some((p) => p.length)) {
    let tries = 0;
    while (!cz.piles[cz.order % 4].length && tries++ < 4) cz.order++;
    const fi = cz.order % 4;
    cz.order++;
    const card = cz.piles[fi].pop();
    const p = foundPos(fi);
    let vx = (60 + Math.random() * 130) * (Math.random() < 0.5 ? -1 : 1);
    if (fi === 3 && vx > 0 && Math.random() < 0.7) vx = -vx; // rightmost pile mostly goes left
    cz.active.push({ card, x: p.x, y: p.y, vx, vy: -Math.random() * 140 });
    cz.lastLaunch = time;
    // the pile underneath shows the next card
    const under = cz.piles[fi][cz.piles[fi].length - 1];
    ctx.drawImage(img['foundation_' + ['S', 'H', 'D', 'C'][fi]], p.x, p.y);
    if (under) ctx.drawImage(img[app.cardName(under)], p.x, p.y);
    app.sound('flip', { volume: 0.4, rate: 0.9 + Math.random() * 0.3 });
  }
  const s = dt / 1000;
  for (const c of cz.active) {
    c.vy += g * s;
    c.x += c.vx * s;
    c.y += c.vy * s;
    if (c.y > floor) { c.y = floor; c.vy = -c.vy * 0.7; if (Math.abs(c.vy) < 40) c.vy = -140; }
    ctx.drawImage(img[app.cardName(c.card)], Math.round(c.x), Math.round(c.y));
  }
  cz.active = cz.active.filter((c) => c.x < app.view.left + app.view.w + 2 && c.x + L.CARD_W > app.view.left - 2);
  if (!cz.active.length && !cz.piles.some((p) => p.length)) endCascade(app);
}

export function endCascade(app) {
  const m = app.modal;
  if (!m || m.phase !== 'cascade') return;
  setBusy('cascade', false);
  // freeze the trails as the banner's background
  const src = app.ctx.canvas;
  const trail = makeCanvas(src.width, src.height);
  trail.getContext('2d').drawImage(src, 0, 0);
  m.trail = trail;
  m.phase = 'banner';
  m.bannerBorn = performance.now();
  app.sound('win_fanfare');
  setBusy('banner', true);
  setTimeout(() => setBusy('banner', false), 2200);
  requestFrame();
}

// ---------------------------------------------------------------- quips

let lastQuip = -Infinity;

// Show a quip near (x, y). force skips the rate limit (debug and undo).
export function quip(app, text, x, y, { force = false } = {}) {
  const t = performance.now();
  if (!force && t - lastQuip < TIMING.quipCooldown) return false;
  lastQuip = t;
  const lines = wrapText(text, 150, 1, 1);
  const w = Math.max(...lines.map((l) => textWidth(l, 1, 1))) + 8;
  const h = lines.length * 11 + 5;
  const qx = clamp(x - w / 2, L.TABLE_X, L.W - w - 2);
  const qy = clamp(y - h - 4, 2, app.view.h - h - 2);
  app.quips.push({ lines, x: qx, y: qy, w, h, born: t });
  setBusy('quips', true);
  app.sound('quip_blip');
  return true;
}

export function drawQuips(app, time) {
  const ctx = app.ctx;
  app.quips = app.quips.filter((q) => time - q.born < TIMING.quipLife);
  if (!app.quips.length) { setBusy('quips', false); return; }
  for (const q of app.quips) {
    const age = time - q.born;
    const a = age < 100 ? age / 100 : clamp((TIMING.quipLife - age) / 350, 0, 1);
    const rise = Math.round((age / TIMING.quipLife) * -4);
    ctx.globalAlpha = a;
    pixRect(ctx, q.x, q.y + rise, q.w, q.h, COLORS.ink, COLORS.gold);
    q.lines.forEach((ln, i) => drawText(ctx, ln, q.x + 4, q.y + rise + 3 + i * 11, { color: COLORS.card, spacing: 1 }));
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- particles

export function dust(app, x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 60;
    app.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 350 + Math.random() * 200, age: 0, color, g: 180 });
  }
  setBusy('particles', true);
}

export function sparkle(app, x, y, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 20 + Math.random() * 70;
    app.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 500 + Math.random() * 400, age: 0, color: Math.random() < 0.5 ? COLORS.gold : COLORS.shine, g: 40 });
  }
  setBusy('particles', true);
}

export function drawParticles(app, dt) {
  const ctx = app.ctx;
  const s = dt / 1000;
  app.particles = app.particles.filter((p) => (p.age += dt) < p.life);
  if (!app.particles.length) { setBusy('particles', false); return; }
  for (const p of app.particles) {
    p.vy += p.g * s;
    p.x += p.vx * s;
    p.y += p.vy * s;
    ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
  ctx.globalAlpha = 1;
}

export { LINES };
