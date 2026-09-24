// main.js — boots the game and wires rules, sprites, input, UI, and saving.
import * as G from './game.js';
import { L, COLORS, TIMING } from './config.js';
import { loadAssets, img, font, computeLayout, colX, STOCK, WASTE, foundPos, rectsOverlap, inRect, pixRect, wrapText, textWidth } from './render.js';
import { tween, ease, setRenderer, setBusy, requestFrame, finishAll, cancelTweens, clamp } from './anim.js';
import * as UI from './ui.js';
import { attachInput } from './input.js';
import * as Save from './save.js';
import * as Audio from './audio.js';
import { LOSS, BLUNDER, WIN_SUB, MILESTONE, SPLASH, pick } from './lines.js';

const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d', { alpha: false });

const view = { S: 1, ox: 0, w: L.W, h: L.MIN_H, left: 0 };
const NAMES = Array.from({ length: 52 }, (_, id) => G.cardName(G.makeCard(id)));
const CARD_W = L.CARD_W, CARD_H = L.CARD_H;

const app = {
  ctx, view,
  data: null,      // save record
  st: null,        // game state
  layout: null,
  modal: null,
  buttons: [],
  ui: { hover: null, press: null },
  quips: [],
  particles: [],
  winsDisplay: null,
  winsPop: 0,
  press: null,     // pointer is down on a card, not dragging yet
  drag: null,
  auto: false,     // auto-finish running
  lastClick: null,
  undoStreak: 0,
  undoQuipDone: false,
  pendingDeal: false,
  cardName: (c) => NAMES[c.id],
  sound: (name, opts) => Audio.play(name, opts),
};

// ---------------------------------------------------------------- sprites
// One sprite per card: where it is drawn right now. Layout says where it
// should be; tweens move it there.

const sprites = Array.from({ length: 52 }, (_, id) => ({
  id, x: STOCK.x, y: STOCK.y, z: 0, fly: 0,
  rot: 0, sc: 1, sq: 1, lift: 0, bright: 0, shx: 0,
  face: false, flipT: 1,
}));
const isSprite = (o) => o && o.id !== undefined && sprites[o.id] === o;
let flySeq = 0;

const STYLES = {
  fly: { dur: TIMING.fly, easing: ease.outCubic },
  snap: { dur: TIMING.snap, easing: ease.outBack },
  back: { dur: TIMING.flyBack, easing: ease.outCubic },
  draw: { dur: 110, easing: ease.outCubic },
  deal: { dur: 170, easing: ease.outCubic },
  auto: { dur: 140, easing: ease.outCubic },
  recycle: { dur: 120, easing: ease.inOutCubic },
};

function allCards(st) {
  return [...st.stock, ...st.waste, ...st.found.flat(), ...st.tab.flat()];
}

function relayout({ instant = false, style = 'fly', delays = null } = {}) {
  app.layout = computeLayout(app.st, view.h);
  const sty = STYLES[style] || STYLES.fly;
  for (const c of allCards(app.st)) {
    const sp = sprites[c.id];
    const p = app.layout.pos.get(c.id);
    sp.z = p.z;
    if (instant) {
      cancelTweens(sp);
      Object.assign(sp, { x: p.x, y: p.y, face: c.up, flipT: 1, rot: 0, sc: 1, sq: 1, shx: 0, fly: 0, lift: 0, bright: 0 });
      continue;
    }
    const delay = delays?.get(c.id) ?? 0;
    const moved = Math.abs(sp.x - p.x) > 0.01 || Math.abs(sp.y - p.y) > 0.01;
    if (moved) {
      const seq = ++flySeq;
      sp.fly = seq;
      tween(sp, { x: p.x, y: p.y, rot: 0, sc: 1 }, {
        dur: sty.dur, easing: sty.easing, delay,
        onDone: () => { if (sp.fly === seq) sp.fly = 0; },
      });
    }
    if (sp.face !== c.up) {
      const flipDelay = delay + (moved ? (style === 'deal' ? sty.dur : sty.dur * 0.3) : 0);
      sp.face = c.up;
      sp.flipT = 0;
      tween(sp, { flipT: 1 }, { dur: TIMING.flip, delay: flipDelay, easing: ease.linear });
    }
  }
  requestFrame();
}

function shake(ids, delay) {
  const seq = [2, -2, 1.5, -1, 0];
  const step = (k) => {
    if (k >= seq.length) return;
    ids.forEach((id, n) => tween(sprites[id], { shx: seq[k] }, {
      dur: 30, delay: k === 0 ? delay : 0, easing: ease.linear,
      onDone: n === 0 ? () => step(k + 1) : undefined,
    }));
  };
  step(0);
}

// ---------------------------------------------------------------- clock
// Starts on the first move, pauses while the page is hidden.

const clock = { running: false, base: 0, t0: 0, iv: null, ticks: 0 };

app.elapsed = () => (clock.running ? clock.base + performance.now() - clock.t0 : app.st?.elapsed ?? 0);

function syncClock() {
  if (clock.running) app.st = G.tick(app.st, app.elapsed());
}

function startClock() {
  if (clock.running || !app.st || app.st.won || app.st.moves === 0 || document.hidden || app.modal?.type === 'splash') return;
  clock.base = app.st.elapsed;
  clock.t0 = performance.now();
  clock.running = true;
  clock.iv = setInterval(() => {
    syncClock();
    requestFrame();
    if (++clock.ticks % 5 === 0) persist();
  }, 1000);
}

function stopClock() {
  if (!clock.running) return;
  syncClock();
  clock.running = false;
  clearInterval(clock.iv);
}

// ---------------------------------------------------------------- saving

function persist() {
  syncClock();
  app.data.game = app.st && !app.st.won ? app.st : null;
  Save.write(app.data);
}

function validState(st) {
  try {
    const ids = allCards(st).map((c) => c.id);
    return ids.length === 52 && new Set(ids).size === 52 && st.tab.length === 7 && st.found.length === 4 && Array.isArray(st.history);
  } catch { return false; }
}

// ---------------------------------------------------------------- actions

function commit(res, opts = {}) {
  if (!res) return false;
  app.st = res.state;
  relayout(opts);
  handleEvents(res.events, opts);
  afterAction();
  return true;
}

function handleEvents(events, opts) {
  const dur = (STYLES[opts.style] || STYLES.fly).dur;
  for (const e of events) {
    if (e.t === 'draw') app.sound('flip');
    else if (e.t === 'recycle') app.sound('recycle');
    else if (e.t === 'flip') app.sound('flip', { volume: 0.8 });
    else if (e.t === 'undo') app.sound('place', { rate: 0.85 });
    else if (e.t === 'move') {
      if (e.dest.pile === 'found') {
        app.sound('foundation');
        const sp = sprites[e.ids[0]];
        const fp = foundPos(e.dest.i);
        const card = G.makeCard(e.ids[0]);
        setTimeout(() => {
          sp.sc = 1.12;
          tween(sp, { sc: 1 }, { dur: 140, easing: ease.outCubic });
          UI.dust(app, fp.x + CARD_W / 2, fp.y + CARD_H / 2, G.isRed(card) ? COLORS.red : COLORS.card, 8);
        }, opts.style === 'snap' ? dur * 0.7 : dur);
      } else app.sound('place');
    }
  }
}

function afterAction() {
  const st = app.st;
  if (!app.data.counted && st.moves > 0) {
    app.data.stats.played++;
    app.data.counted = true;
  }
  startClock();
  if (st.won) { onWin(); return; }
  persist();
  if (G.canAutoFinish(st)) { runAutoFinish(); return; }
  scheduleStuckCheck();
}

function act(res, opts) {
  syncClock();
  if (res && res.events[0]?.t !== 'undo') app.undoStreak = 0;
  return commit(res, opts);
}

function drawFromStock() {
  syncClock();
  const res = G.draw(app.st);
  if (!res) return;
  act(res, { style: res.events[0].t === 'recycle' ? 'recycle' : 'draw' });
}

function tryFoundation(src) {
  syncClock();
  const fi = G.foundationTargetFor(app.st, src);
  if (fi < 0) return false;
  return act(G.move(app.st, src, { pile: 'found', i: fi }), { style: 'fly' });
}

app.onUndo = () => {
  if (app.modal || app.auto) return;
  syncClock();
  const res = G.undo(app.st);
  if (!res) return;
  app.undoStreak++;
  commit(res, { style: 'fly' });
  if (app.undoStreak === 3 && !app.undoQuipDone) {
    app.undoQuipDone = true;
    UI.quip(app, pick(BLUNDER.undo), L.TABLE_X + 185, L.TAB_Y + 20, { force: true });
  }
};

function runAutoFinish() {
  app.auto = true;
  setHover(null);
  const step = () => {
    syncClock();
    const res = G.autoFinishStep(app.st);
    if (!res) { app.auto = false; persist(); return; }
    app.st = res.state;
    relayout({ style: 'auto' });
    handleEvents(res.events, { style: 'auto' });
    if (app.st.won) { app.auto = false; afterAction(); return; }
    setTimeout(step, TIMING.autoFinishStagger);
  };
  setTimeout(step, 160);
}

let stuckTimer = null;
function scheduleStuckCheck() {
  clearTimeout(stuckTimer);
  const moves = app.st.moves;
  stuckTimer = setTimeout(() => {
    if (app.modal || app.drag || app.auto || app.st.won || app.st.moves !== moves) return;
    if (G.isStuck(app.st)) showLoss(true);
  }, 350);
}

// ---------------------------------------------------------------- games

function randomSeed() {
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch { return Math.floor(Math.random() * 2 ** 32); }
}

function dealNew() {
  stopClock();
  const s = app.data.stats;
  if (app.data.counted && !app.st.won) {
    s.lost++;
    s.streak = 0;
    s.totalTime += app.st.elapsed;
  }
  app.data.counted = false;
  app.modal = null;
  app.winsDisplay = null;
  app.quips = [];
  setBusy('loss', false);
  app.st = G.newGame(randomSeed());
  app.undoStreak = 0;
  app.undoQuipDone = false;
  app.lastClick = null;
  persist();
  animateDeal();
}
app.dealAgain = dealNew;

function animateDeal() {
  for (const sp of sprites) {
    cancelTweens(sp);
    Object.assign(sp, { x: STOCK.x, y: STOCK.y, face: false, flipT: 1, rot: 0, sc: 1, sq: 1, lift: 0, bright: 0, shx: 0, fly: 0 });
  }
  const delays = new Map();
  let k = 0;
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) delays.set(app.st.tab[col][row].id, (k++) * TIMING.dealStagger);
  }
  app.sound('shuffle');
  setTimeout(() => app.sound('deal'), 60);
  relayout({ style: 'deal', delays });
  scheduleStuckCheck();
}

app.onNewGameButton = () => {
  if (app.auto) return;
  if (app.st.moves > 0 && !app.st.won && app.data.counted) {
    app.modal = {
      type: 'confirm', text: 'GIVE UP THIS ONE?',
      yes: () => showLoss(false),
      no: () => app.closeModal(),
    };
    requestFrame();
  } else dealNew();
};

function showLoss(stuck) {
  app.drag = null;
  app.press = null;
  setBusy('drag', false);
  app.modal = { type: 'loss', stuck, line: pick(LOSS), born: performance.now() };
  setBusy('loss', true);
  app.sound('loss_sting');
}

app.undoFromLoss = () => {
  app.modal = null;
  setBusy('loss', false);
  app.onUndo();
};

app.openStats = () => { app.modal = { type: 'stats' }; requestFrame(); };
app.closeModal = () => { app.modal = null; setBusy('loss', false); requestFrame(); };

// SOUND button: ALL (music + effects) → FX (effects only) → OFF.
// Without a music file it's just ON ↔ OFF.
app.soundLabel = () => {
  if (!app.data.sound) return 'SOUND: OFF';
  if (!Audio.hasMusic()) return 'SOUND: ON';
  return app.data.music ? 'SOUND: ALL' : 'SOUND: FX';
};
app.toggleSound = () => {
  const d = app.data;
  if (!d.sound) { d.sound = true; d.music = true; }
  else if (Audio.hasMusic() && d.music) d.music = false;
  else d.sound = false;
  Audio.setAudio({ on: d.sound, music: d.music });
  persist();
};

// ---------------------------------------------------------------- winning

function onWin() {
  stopClock();
  const s = app.data.stats;
  const st = app.st;
  const oldWins = s.won;
  s.won++;
  s.streak++;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.bestTime = s.bestTime ? Math.min(s.bestTime, st.elapsed) : st.elapsed;
  s.bestScore = Math.max(s.bestScore, st.score);
  s.totalTime += st.elapsed;
  app.data.counted = false;
  persist();
  celebrate(oldWins, s.won, st.score, st.elapsed);
}

function celebrate(oldWins, newWins, score, time) {
  app.winsDisplay = oldWins;
  setHover(null);
  setTimeout(() => {
    finishAll(isSprite);
    app.modal = null;
    setBusy('loss', false);
    app.quips = [];
    relayout({ instant: true });
    drawScene(performance.now(), 16); // clean table under the trails
    app.modal = {
      type: 'win', phase: 'cascade', oldWins, newWins, score, time, pop: 0,
      line: newWins % 100 === 0 ? pick(MILESTONE) : pick(WIN_SUB),
    };
    UI.startCascade(app, app.modal);
  }, 280);
}

// ---------------------------------------------------------------- drawing

function drawSprite(sp) {
  const flipping = sp.flipT < 1;
  const showFace = flipping ? (sp.flipT < 0.5 ? !sp.face : sp.face) : sp.face;
  const im = showFace ? img[NAMES[sp.id]] : img.back;
  const fx = flipping ? Math.abs(1 - 2 * sp.flipT) : 1;
  const x = sp.x + sp.shx;
  const y = sp.y - sp.lift;
  const sx = sp.sc * fx, sy = sp.sc * sp.sq;
  const plain = sx === 1 && sy === 1 && !sp.rot;
  if (plain) {
    const rx = Math.round(x), ry = Math.round(y);
    ctx.drawImage(im, rx, ry);
    if (sp.bright > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.09 * sp.bright;
      ctx.drawImage(im, rx, ry);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    return;
  }
  ctx.save();
  ctx.translate(x + CARD_W / 2, y + CARD_H); // squash sits on the bottom edge
  if (sp.rot) ctx.rotate(sp.rot);
  ctx.scale(sx, sy);
  ctx.drawImage(im, -CARD_W / 2, -CARD_H);
  ctx.restore();
}

function drawDragGroup() {
  const d = app.drag;
  if (!d) return;
  const lead = sprites[d.ids[0]];
  const last = sprites[d.ids[d.ids.length - 1]];
  const px = lead.x + d.gx, py = lead.y + d.gy; // pivot at the grab point
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(d.rot);
  ctx.scale(d.sc, d.sc);
  pixRect(ctx, lead.x - px + 3, lead.y - py + 4, CARD_W, last.y - lead.y + CARD_H, 'rgba(10,16,12,0.38)');
  for (const id of d.ids) {
    const sp = sprites[id];
    ctx.drawImage(sp.face ? img[NAMES[id]] : img.back, sp.x - px, sp.y - py);
  }
  ctx.restore();
}

function drawTable() {
  const st = app.st;
  // empty-pile markers
  if (!st.stock.length) ctx.drawImage(st.waste.length ? img.stock_recycle : img.slot_empty, STOCK.x, STOCK.y);
  G.SUITS.forEach((s, i) => { const p = foundPos(i); ctx.drawImage(img['foundation_' + s], p.x, p.y); });
  for (let i = 0; i < 7; i++) if (!st.tab[i].length) ctx.drawImage(img.slot_empty, colX(i), L.TAB_Y);

  const dragging = app.drag ? new Set(app.drag.ids) : null;
  const order = sprites.filter((sp) => !dragging?.has(sp.id));
  order.sort((a, b) => (a.fly ? 1e4 + a.fly : a.z) - (b.fly ? 1e4 + b.fly : b.z));
  for (const sp of order) drawSprite(sp);

  const t = app.drag?.target;
  if (t) ctx.drawImage(img.card_select, t.rect.x - 2, t.rect.y - 2);
  drawDragGroup();
}

function drawScene(time, dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.felt;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.S, 0, 0, view.S, view.ox, 0);
  ctx.imageSmoothingEnabled = false;
  app.buttons = [];
  const m = app.modal;
  if (m?.type === 'splash' || (m?.type === 'win' && m.phase === 'banner')) {
    UI.drawModal(app, time);
    UI.drawParticles(app, dt);
    return;
  }
  // sidebar divider
  ctx.fillStyle = COLORS.feltDark;
  ctx.fillRect(view.left, 0, L.SIDEBAR_W + 2 - view.left, view.h);
  ctx.fillStyle = COLORS.feltLine;
  ctx.fillRect(L.SIDEBAR_W + 2, 0, 1, view.h);
  UI.drawSidebar(app);
  if (app.drag) updateDrag(dt);
  drawTable();
  UI.drawParticles(app, dt);
  UI.drawQuips(app, time);
  if (m) UI.drawModal(app, time);
}

function render(time, dt) {
  const m = app.modal;
  if (m?.type === 'win' && m.phase === 'cascade') {
    ctx.setTransform(view.S, 0, 0, view.S, view.ox, 0);
    ctx.imageSmoothingEnabled = false;
    UI.stepCascade(app, time, dt);
    return;
  }
  drawScene(time, dt);
}

// ---------------------------------------------------------------- hit testing

function hitTable(px, py) {
  const st = app.st;
  const lay = app.layout;
  for (let i = 0; i < 7; i++) {
    const col = lay.cols[i];
    for (let k = col.length - 1; k >= 0; k--) {
      if (inRect(px, py, { x: colX(i), y: col[k].y, w: CARD_W, h: CARD_H })) return { pile: 'tab', i, idx: k, card: st.tab[i][k] };
    }
  }
  if (inRect(px, py, { x: STOCK.x, y: STOCK.y, w: CARD_W, h: CARD_H })) return { pile: 'stock' };
  if (st.waste.length && inRect(px, py, { x: WASTE.x - 2 * L.WASTE_PEEK, y: WASTE.y, w: CARD_W + 2 * L.WASTE_PEEK, h: CARD_H })) {
    return { pile: 'waste', card: st.waste[st.waste.length - 1] };
  }
  for (let i = 0; i < 4; i++) {
    const p = foundPos(i);
    const f = st.found[i];
    if (f.length && inRect(px, py, { x: p.x, y: p.y, w: CARD_W, h: CARD_H })) return { pile: 'found', i, card: f[f.length - 1] };
  }
  return null;
}

function srcOf(hit) {
  if (!hit) return null;
  if (hit.pile === 'tab' && hit.card.up) return { pile: 'tab', i: hit.i, idx: hit.idx };
  if (hit.pile === 'waste') return { pile: 'waste' };
  if (hit.pile === 'found') return { pile: 'found', i: hit.i };
  return null;
}

function hitButton(p) {
  for (let k = app.buttons.length - 1; k >= 0; k--) {
    const b = app.buttons[k];
    if (!b.disabled && inRect(p.x, p.y, b)) return b;
  }
  return null;
}

// ---------------------------------------------------------------- hover

let hoverKey = '';
let hoverIds = [];
function setHover(ids) {
  const key = ids ? ids.join(',') : '';
  if (key === hoverKey) return;
  const next = new Set(ids || []);
  for (const id of hoverIds) if (!next.has(id)) tween(sprites[id], { lift: 0, bright: 0 }, { dur: TIMING.hover });
  for (const id of next) tween(sprites[id], { lift: 2, bright: 1 }, { dur: TIMING.hover });
  hoverIds = [...next];
  hoverKey = key;
}

// ---------------------------------------------------------------- drag

function startDrag() {
  const pr = app.press;
  app.drag = {
    ids: pr.ids, src: pr.src, gx: pr.gx, gy: pr.gy,
    px: pr.x0, py: pr.y0, vx: 0, vy: 0, rot: 0, sc: 1,
    target: null, bad: null,
  };
  setHover(null);
  for (const id of pr.ids) {
    const sp = sprites[id];
    cancelTweens(sp);
    const p = app.layout.pos.get(id);
    Object.assign(sp, { x: p.x, y: p.y, lift: 0, bright: 0, shx: 0, fly: 0, sc: 1, rot: 0, sq: 1, flipT: 1 });
  }
  tween(app.drag, { sc: 1.04 }, { dur: 80 });
  setBusy('drag', true);
  app.sound('pick');
}

function updateDrag(dt) {
  const d = app.drag;
  const lead = sprites[d.ids[0]];
  const s = dt / 1000;
  const w = 55; // critically damped spring, settles in ~60 ms
  const e = Math.exp(-w * s);
  const tx = d.px - d.gx, ty = d.py - d.gy;
  const x0 = lead.x - tx, y0 = lead.y - ty;
  const nx = (x0 + (d.vx + w * x0) * s) * e;
  const nvx = (d.vx - w * (d.vx + w * x0) * s) * e;
  const ny = (y0 + (d.vy + w * y0) * s) * e;
  const nvy = (d.vy - w * (d.vy + w * y0) * s) * e;
  d.vx = nvx; d.vy = nvy;
  const offs = d.ids.map((id) => sprites[id].y - lead.y);
  lead.x = tx + nx; lead.y = ty + ny;
  d.ids.forEach((id, k) => { sprites[id].x = lead.x; sprites[id].y = lead.y + offs[k]; });
  // tilt with horizontal speed, ±5°
  const maxRot = (5 * Math.PI) / 180;
  const targetRot = clamp(d.vx * 0.00022, -maxRot, maxRot);
  d.rot += (targetRot - d.rot) * (1 - Math.exp(-dt / 45));
  findTarget();
}

function findTarget() {
  const d = app.drag;
  const st = app.st;
  // Measure where the pointer puts the card, not where the spring has got it
  // to yet, so a quick flick-and-release still lands.
  const r = { x: d.px - d.gx, y: d.py - d.gy, w: CARD_W, h: CARD_H };
  let best = null, bestA = 0, bad = null, badA = 0;
  const consider = (dest, rect) => {
    const a = rectsOverlap(r, rect);
    if (a <= 0) return;
    const why = G.moveReject(st, d.src, dest);
    if (!why) { if (a > bestA) { bestA = a; best = { dest, rect }; } }
    else if (why !== 'same' && a > badA) { badA = a; bad = { why, dest }; }
  };
  for (let i = 0; i < 7; i++) {
    if (d.src.pile === 'tab' && d.src.i === i) continue;
    const col = app.layout.cols[i];
    consider({ pile: 'tab', i }, { x: colX(i), y: col.length ? col[col.length - 1].y : L.TAB_Y, w: CARD_W, h: CARD_H });
  }
  if (d.ids.length === 1) {
    for (let i = 0; i < 4; i++) {
      if (d.src.pile === 'found' && d.src.i === i) continue;
      const p = foundPos(i);
      consider({ pile: 'found', i }, { x: p.x, y: p.y, w: CARD_W, h: CARD_H });
    }
  }
  d.target = best;
  d.bad = bad;
}

function drop() {
  const d = app.drag;
  if (!d) return;
  findTarget();
  app.drag = null;
  setBusy('drag', false);
  for (const id of d.ids) { sprites[id].rot = d.rot; sprites[id].sc = d.sc; }
  if (d.target) {
    syncClock();
    const res = G.move(app.st, d.src, d.target.dest);
    for (const id of d.ids) {
      sprites[id].sq = 0.92;
      tween(sprites[id], { sq: 1 }, { dur: 160, delay: TIMING.snap * 0.6, easing: ease.outBack });
    }
    act(res, { style: 'snap' });
  } else {
    relayout({ style: 'back' });
    shake(d.ids, TIMING.flyBack);
    if (d.bad) {
      app.sound('invalid');
      if (Math.random() < TIMING.quipChance) {
        const kind = d.bad.why === 'color' ? 'color' : d.bad.why === 'king' ? 'king' : 'rank';
        const lead = sprites[d.ids[0]];
        UI.quip(app, pick(BLUNDER[kind]), lead.x + CARD_W / 2, lead.y);
      }
    }
  }
}

// ---------------------------------------------------------------- input

function closeSplash() {
  if (app.modal?.type !== 'splash') return;
  setBusy('splash', false);
  app.modal = null;
  if (app.pendingDeal) { app.pendingDeal = false; animateDeal(); }
  else {
    relayout({ instant: true });
    startClock();
    if (G.canAutoFinish(app.st)) runAutoFinish();
    else scheduleStuckCheck();
  }
  requestFrame();
}

const handlers = {
  isHolding: () => !!(app.drag || app.press || app.ui.press),

  down(p) {
    Audio.initAudio();
    if (app.drag) drop(); // a stale drag from a lost release
    const m = app.modal;
    if (m?.type === 'splash') { closeSplash(); return; }
    if (m?.type === 'win' && m.phase === 'cascade') { UI.endCascade(app); return; }
    drawScene(performance.now(), 0); // buttons must match the current screen, not the last frame
    const b = hitButton(p);
    if (b) { app.ui.press = b.id; app.ui.hover = b.id; requestFrame(); return; }
    if (m) {
      if (m.type === 'win') m.bannerBorn = Math.min(m.bannerBorn, performance.now() - 5000);
      if (m.type === 'stats') app.closeModal();
      requestFrame();
      return;
    }
    if (app.auto || app.drag) return;
    finishAll(isSprite); // any animation yields to the next click
    const hit = hitTable(p.x, p.y);
    if (!hit) return;
    if (hit.pile === 'stock') { drawFromStock(); return; }
    if (hit.pile === 'tab' && !hit.card.up) {
      if (hit.idx === app.st.tab[hit.i].length - 1) act(G.flip(app.st, hit.i), { style: 'fly' });
      return;
    }
    const src = srcOf(hit);
    if (!src) return;
    const ids = G.cardsAt(app.st, src).map((c) => c.id);
    if (!ids.length) return;
    const lead = app.layout.pos.get(ids[0]);
    app.press = { src, ids, x0: p.x, y0: p.y, gx: p.x - lead.x, gy: p.y - lead.y };
  },

  move(p) {
    if (app.press && !app.drag && Math.hypot(p.x - app.press.x0, p.y - app.press.y0) > 2.5) startDrag();
    if (app.drag) {
      app.drag.px = p.x;
      app.drag.py = p.y;
      requestFrame();
      return;
    }
    const b = hitButton(p);
    const hb = b ? b.id : null;
    if (hb !== app.ui.hover) { app.ui.hover = hb; requestFrame(); }
    canvas.style.cursor = b ? 'pointer' : 'default';
    if (app.modal || app.auto || app.press) { if (!app.press) setHover(null); return; }
    const src = srcOf(hitTable(p.x, p.y));
    setHover(src ? G.cardsAt(app.st, src).map((c) => c.id) : null);
  },

  up(p) {
    if (app.ui.press) {
      const id = app.ui.press;
      app.ui.press = null;
      const b = hitButton(p);
      if (b && b.id === id) { app.sound('ui_click'); b.action(); }
      requestFrame();
      return;
    }
    if (app.drag) { drop(); return; }
    const pr = app.press;
    app.press = null;
    if (!pr) return;
    // double-click sends a lone card (waste top, end of a column) to its foundation
    if (pr.ids.length !== 1 || pr.src.pile === 'found') { app.lastClick = null; return; }
    const id = pr.ids[0];
    if (app.lastClick && app.lastClick.id === id && p.t - app.lastClick.t < TIMING.doubleClick) {
      app.lastClick = null;
      tryFoundation(pr.src);
    } else app.lastClick = { id, t: p.t };
  },

  // The pointer went away mid-gesture: put cards back, never guess a drop.
  cancel() {
    if (app.drag) {
      app.drag.target = null;
      app.drag.bad = null;
      const d = app.drag;
      app.drag = null;
      setBusy('drag', false);
      for (const id of d.ids) { sprites[id].rot = d.rot; sprites[id].sc = d.sc; }
      relayout({ style: 'back' });
    }
    app.press = null;
    if (app.ui.press) { app.ui.press = null; requestFrame(); }
  },

  leave() {
    if (!app.drag) setHover(null);
    if (app.ui.hover) { app.ui.hover = null; requestFrame(); }
  },

  key(e) {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === 'z') { e.preventDefault(); if (!app.drag && !app.press) app.onUndo(); return; }
    if (e.ctrlKey && (e.shiftKey || e.altKey) && e.code === 'KeyJ') { e.preventDefault(); admin(); return; }
    if (e.key === 'Escape' && (app.modal?.type === 'stats' || app.modal?.type === 'confirm')) { app.closeModal(); return; }
    if (DEBUG && !e.ctrlKey && !e.metaKey && !e.altKey) debugKey(k);
  },
};

// ---------------------------------------------------------------- admin (Billy only)

function admin() {
  const s = app.data.stats;
  const input = window.prompt(`WINS,PLAYED   (now ${s.won},${s.played})\nor paste a backup code\nor type RESET to wipe all stats:`, '');
  if (!input) return;
  if (input.trim().toUpperCase() === 'RESET') {
    if (!window.confirm('Wipe every stat and the game in progress?')) return;
    const fresh = Save.freshSave();
    fresh.sound = app.data.sound;
    fresh.music = app.data.music;
    app.data = fresh;
    app.st = G.newGame(randomSeed()); // nothing counted, so dealNew won't log a loss
    dealNew();
    return;
  }
  const m = input.match(/^\s*(\d+)\s*[,/ ]\s*(\d+)\s*$/);
  const r = m ? { won: +m[1], played: Math.max(+m[1], +m[2]) } : Save.parseBackupCode(input);
  if (!r) { window.alert('Not recognised.'); return; }
  s.won = r.won;
  s.played = r.played;
  s.lost = Math.max(0, r.played - r.won);
  if (r.bestStreak != null) s.bestStreak = Math.max(s.bestStreak, r.bestStreak);
  persist();
  requestFrame();
}

// ---------------------------------------------------------------- debug (?debug=1 only)

function debugKey(k) {
  if (k === 'w') {
    const st = G.emptyState();
    G.SUITS.forEach((s, i) => { for (let r = 0; r < 13; r++) st.found[i].push(G.makeCard(i * 13 + r, true)); });
    st.won = true;
    app.st = st;
    stopClock();
    const n = app.data.stats.won;
    celebrate(n, n + 1, 4321, 187000);
  } else if (k === 'f') {
    // a real game one double-click from the finish: it counts in the stats
    const st = G.emptyState();
    const up = (n) => G.cardFromName(n, true);
    G.SUITS.forEach((s) => { for (let r = 1; r <= (s === 'C' ? 10 : 11); r++) st.found[G.SUITS.indexOf(s)].push(up(G.RANK_NAMES[r] + s)); });
    st.tab[0] = [up('KS'), up('QH')];
    st.tab[1] = [up('KH'), up('QS')];
    st.tab[2] = [up('KC'), up('QD')];
    st.tab[3] = [up('KD')];
    st.tab[4] = [up('QC')];
    st.waste = [up('JC')];
    st.moves = 1;
    st.elapsed = 60000;
    stopClock();
    app.st = st;
    app.modal = null;
    relayout({ instant: true });
    afterAction();
  } else if (k === 'l') showLoss(true);
  else if (k === 't') {
    // worst case: a full King-to-Ace run on top of six face-down cards
    const st = G.emptyState();
    const runNames = ['KS', 'QH', 'JC', '10D', '9S', '8H', '7C', '6D', '5S', '4H', '3C', '2D', 'AS'];
    const used = new Set(runNames.map((n) => G.cardFromName(n).id));
    const rest = [];
    for (let id = 0; id < 52; id++) if (!used.has(id)) rest.push(id);
    for (let c = 0; c < 6; c++) {
      for (let k = 0; k <= c; k++) st.tab[c].push(G.makeCard(rest.pop(), k === c));
    }
    for (let k = 0; k < 6; k++) st.tab[6].push(G.makeCard(rest.pop(), false));
    for (const n of runNames) st.tab[6].push(G.cardFromName(n, true));
    while (rest.length) st.stock.push(G.makeCard(rest.pop(), false));
    app.st = st;
    app.modal = null;
    relayout({ instant: true });
  } else if (k === 'b') {
    const kinds = ['color', 'rank', 'king'];
    UI.quip(app, pick(BLUNDER[pick(kinds)]), 260, 140, { force: true });
  }
  requestFrame();
}

// ---------------------------------------------------------------- sizing
// Integer scale only. The backing store is sized in device pixels so Windows
// 125%/150% scaling stays crisp.

function applySize(devW, devH) {
  if (!devW || !devH) return;
  let S = 1;
  while (Math.floor(devW / (S + 1)) >= L.W && Math.floor(devH / (S + 1)) >= L.MIN_H) S++;
  canvas.width = devW;
  canvas.height = devH;
  view.S = S;
  view.ox = Math.floor((devW - L.W * S) / 2);
  view.h = Math.floor(devH / S);
  view.w = devW / S;
  view.left = -view.ox / S;
  ctx.imageSmoothingEnabled = false;
  if (app.modal?.type === 'win') app.modal.trail = null;
  if (app.st && !app.drag) relayout({ instant: true });
  requestFrame();
}

function watchSize() {
  const fallback = () => {
    const dpr = window.devicePixelRatio || 1;
    applySize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
  };
  try {
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      const box = e.devicePixelContentBoxSize?.[0];
      if (box) applySize(box.inlineSize, box.blockSize);
      else fallback();
    });
    ro.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    window.addEventListener('resize', fallback);
  }
  fallback();
}

// ---------------------------------------------------------------- boot

async function boot() {
  watchSize();
  await loadAssets();
  app.data = Save.load();
  Audio.setAudio({ on: app.data.sound, music: app.data.music, sfx: app.data.sfxVol, musicVolume: app.data.musicVol });
  Audio.whenMusicReady(requestFrame);

  const saved = app.data.game;
  if (saved && !saved.won && validState(saved)) {
    app.st = saved;
    relayout({ instant: true });
  } else {
    app.st = G.newGame(randomSeed());
    app.data.counted = false;
    app.pendingDeal = true;
    app.layout = computeLayout(app.st, view.h);
    persist();
  }

  attachInput(canvas, view, handlers);
  setRenderer(render);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopClock(); persist(); Audio.suspendAudio(true); }
    else { startClock(); Audio.suspendAudio(false); requestFrame(); }
  });
  window.addEventListener('pagehide', persist);

  app.modal = { type: 'splash', born: performance.now(), line: pick(SPLASH) };
  setBusy('splash', true);
  setTimeout(() => { setBusy('splash', false); requestFrame(); }, 1000); // intro done; now wait for a click
  requestFrame();

  if (DEBUG) {
    window.app = app;
    window.G = G;
    window.debugLoad = (st) => { app.st = st; app.modal = null; relayout({ instant: true }); scheduleStuckCheck(); };
    checkLines();
  }
}

// Debug: every line must use real glyphs and fit its box.
function checkLines() {
  const problems = [];
  const glyphsOk = (s) => [...s.toUpperCase()].every((ch) => ch in font.glyphs);
  const check = (list, maxW, spacing, maxLines, where) => list.forEach((s) => {
    if (!glyphsOk(s)) problems.push([where, s, 'unsupported glyph']);
    const n = wrapText(s, maxW, 1, spacing).length;
    if (n > maxLines) problems.push([where, s, `${n} lines > ${maxLines}`]);
    if (wrapText(s, maxW, 1, spacing).some((ln) => textWidth(ln, 1, spacing) > maxW)) problems.push([where, s, 'word too wide']);
  });
  check(LOSS, 170, 2, 6, 'loss');
  check(Object.values(BLUNDER).flat(), 150, 1, 3, 'quip');
  check([...WIN_SUB, ...MILESTONE], 300, 2, 2, 'win');
  check(SPLASH, 400, 2, 1, 'splash');
  if (problems.length) console.warn('lines.js problems', problems);
  else console.log('lines.js: all lines fit');
}

// Nothing in normal play may surface an error screen.
window.addEventListener('error', (e) => { if (DEBUG) console.error(e.error || e.message); e.preventDefault?.(); });
window.addEventListener('unhandledrejection', (e) => { if (DEBUG) console.error(e.reason); e.preventDefault(); });

boot();
