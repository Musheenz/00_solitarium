// game.js — pure Klondike rules: Draw One, Standard (Windows classic) scoring.
// No DOM, no globals, no Date. Every action takes a state and returns
// { state, events } for a legal action or null for an illegal one. The input
// state is never mutated. Runs in the browser and under node for tests.

export const SUITS = ['S', 'H', 'D', 'C']; // foundation slot order matches the art
export const RANK_NAMES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SCORE = {
  WASTE_TO_TAB: 5,
  WASTE_TO_FOUND: 10,
  TAB_TO_FOUND: 10,
  FLIP: 5,
  FOUND_TO_TAB: -15,
  RECYCLE: -100,
  TIME_PENALTY: -2,
  TIME_INTERVAL_MS: 10000,
  BONUS_NUMERATOR: 700000,
  BONUS_MIN_SECONDS: 30,
};

// ---------------------------------------------------------------- cards

// id 0..51 = suitIndex * 13 + (rank - 1)
export function makeCard(id, up = false) {
  return { id, r: (id % 13) + 1, s: SUITS[Math.floor(id / 13)], up };
}

export function cardName(c) { return RANK_NAMES[c.r] + c.s; } // matches assets/cards/{name}.png

export function cardFromName(name, up = true) {
  const s = name.slice(-1);
  const r = RANK_NAMES.indexOf(name.slice(0, -1));
  if (r < 1 || !SUITS.includes(s)) throw new Error('bad card ' + name);
  return makeCard(SUITS.indexOf(s) * 13 + r - 1, up);
}

export const isRed = (c) => c.s === 'H' || c.s === 'D';

// ---------------------------------------------------------------- deal

// mulberry32: small, fast, seedable
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emptyState() {
  return {
    v: 1,
    seed: 0,
    stock: [],   // last element is the top (next card drawn)
    waste: [],   // last element is the top (the playable card)
    found: [[], [], [], []], // index = SUITS index
    tab: [[], [], [], [], [], [], []], // last element is the bottom (exposed) card
    score: 0,
    moves: 0,
    elapsed: 0,     // ms of play time, driven by tick()
    timeSteps: 0,   // how many 10 s time penalties have been charged
    won: false,
    history: [],    // encoded snapshots for unlimited undo
  };
}

export function newGame(seed) {
  const next = rng(seed);
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const s = emptyState();
  s.seed = seed >>> 0;
  let k = 0;
  // Dealt row by row like a real table: row n puts one card on columns n..6.
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) {
      s.tab[col].push(makeCard(deck[k++], col === row));
    }
  }
  while (k < 52) s.stock.push(makeCard(deck[k++], false));
  return s;
}

// ---------------------------------------------------------------- state helpers

function cloneState(st) {
  const cp = (pile) => pile.map((c) => ({ ...c }));
  return {
    ...st,
    stock: cp(st.stock),
    waste: cp(st.waste),
    found: st.found.map(cp),
    tab: st.tab.map(cp),
    history: st.history.slice(),
  };
}

// Snapshot = "score;pile,pile,...". Each card is one char so hundreds of undo
// steps fit easily in localStorage.
const PILE_ORDER = (st) => [st.stock, st.waste, ...st.found, ...st.tab];

function encodeCard(c) { return String.fromCharCode(48 + c.id * 2 + (c.up ? 1 : 0)); }
function decodeCard(ch) {
  const n = ch.charCodeAt(0) - 48;
  return makeCard(n >> 1, (n & 1) === 1);
}

export function encodeSnapshot(st) {
  return st.score + ';' + PILE_ORDER(st).map((p) => p.map(encodeCard).join('')).join(',');
}

function applySnapshot(st, snap) {
  const [score, body] = [snap.slice(0, snap.indexOf(';')), snap.slice(snap.indexOf(';') + 1)];
  const piles = body.split(',').map((p) => Array.from(p, decodeCard));
  st.score = Number(score);
  st.stock = piles[0];
  st.waste = piles[1];
  st.found = piles.slice(2, 6);
  st.tab = piles.slice(6, 13);
}

function begin(st) {
  const s = cloneState(st);
  s.history.push(encodeSnapshot(st));
  s.moves++;
  return s;
}

function addScore(s, d, events) {
  const before = s.score;
  s.score = Math.max(0, s.score + d);
  if (s.score !== before) events.push({ t: 'score', d: s.score - before });
}

// Auto-flip (like modern MS): after any move, an exposed face-down card turns up.
function autoFlip(s, col, events) {
  const pile = s.tab[col];
  const top = pile[pile.length - 1];
  if (top && !top.up) {
    top.up = true;
    events.push({ t: 'flip', col, id: top.id });
    addScore(s, SCORE.FLIP, events);
  }
}

export function foundationCount(st) { return st.found.reduce((n, f) => n + f.length, 0); }

function checkWin(s, events) {
  if (foundationCount(s) !== 52) return;
  s.won = true;
  const secs = Math.floor(s.elapsed / 1000);
  let bonus = 0;
  if (secs >= SCORE.BONUS_MIN_SECONDS) bonus = Math.floor(SCORE.BONUS_NUMERATOR / secs);
  if (bonus) s.score += bonus;
  events.push({ t: 'win', bonus });
}

// ---------------------------------------------------------------- legality

// Why a card can't go somewhere. null = legal. Reasons feed the blunder quips.
export function tableauReject(target, card) {
  if (!target) return card.r === 13 ? null : 'king';
  if (!target.up) return 'rank';
  if (isRed(target) === isRed(card)) return 'color';
  if (target.r !== card.r + 1) return 'rank';
  return null;
}

export function foundationReject(st, fi, card) {
  if (SUITS[fi] !== card.s) return 'suit';
  if (st.found[fi].length !== card.r - 1) return 'rank';
  return null;
}

export const foundationIndexFor = (card) => SUITS.indexOf(card.s);

// Cards that would be lifted from a source. src:
//   { pile: 'waste' } | { pile: 'found', i } | { pile: 'tab', i, idx }
export function cardsAt(st, src) {
  if (src.pile === 'waste') return st.waste.length ? [st.waste[st.waste.length - 1]] : [];
  if (src.pile === 'found') {
    const f = st.found[src.i];
    return f.length ? [f[f.length - 1]] : [];
  }
  if (src.pile === 'tab') {
    const col = st.tab[src.i];
    if (src.idx < 0 || src.idx >= col.length) return [];
    const run = col.slice(src.idx);
    if (!run.every((c) => c.up)) return [];
    // Any face-up run is a valid alternating sequence by construction, but check anyway.
    for (let k = 1; k < run.length; k++) if (tableauReject(run[k - 1], run[k])) return [];
    return run;
  }
  return [];
}

// dest: { pile: 'tab', i } | { pile: 'found', i }
// Returns null if legal, otherwise a reason string.
export function moveReject(st, src, dest) {
  const cards = cardsAt(st, src);
  if (!cards.length) return 'empty';
  if (dest.pile === src.pile && dest.i === src.i) return 'same';
  if (dest.pile === 'found') {
    if (cards.length !== 1) return 'rank';
    return foundationReject(st, dest.i, cards[0]);
  }
  if (dest.pile === 'tab') {
    const col = st.tab[dest.i];
    return tableauReject(col[col.length - 1], cards[0]);
  }
  return 'bad';
}

// ---------------------------------------------------------------- actions

export function move(st, src, dest) {
  if (st.won || moveReject(st, src, dest)) return null;
  const s = begin(st);
  const events = [];
  let cards;
  if (src.pile === 'waste') cards = [s.waste.pop()];
  else if (src.pile === 'found') cards = [s.found[src.i].pop()];
  else cards = s.tab[src.i].splice(src.idx);

  if (dest.pile === 'found') s.found[dest.i].push(cards[0]);
  else s.tab[dest.i].push(...cards);
  events.push({ t: 'move', ids: cards.map((c) => c.id), src, dest });

  const key = src.pile + '>' + dest.pile;
  if (key === 'waste>tab') addScore(s, SCORE.WASTE_TO_TAB, events);
  else if (key === 'waste>found') addScore(s, SCORE.WASTE_TO_FOUND, events);
  else if (key === 'tab>found') addScore(s, SCORE.TAB_TO_FOUND, events);
  else if (key === 'found>tab') addScore(s, SCORE.FOUND_TO_TAB, events);

  if (src.pile === 'tab') autoFlip(s, src.i, events);
  checkWin(s, events);
  return { state: s, events };
}

// Click on the stock: draw one, or recycle the waste when the stock is empty.
export function draw(st) {
  if (st.won) return null;
  if (st.stock.length) {
    const s = begin(st);
    const c = s.stock.pop();
    c.up = true;
    s.waste.push(c);
    return { state: s, events: [{ t: 'draw', id: c.id }] };
  }
  if (!st.waste.length) return null;
  const s = begin(st);
  const events = [{ t: 'recycle' }];
  // Waste goes back face-down so it deals out again in the same order.
  s.stock = s.waste.reverse().map((c) => ({ ...c, up: false }));
  s.waste = [];
  addScore(s, SCORE.RECYCLE, events);
  return { state: s, events };
}

// Manual flip of a face-down bottom card. Auto-flip makes this rare, but saves
// and odd states can still reach it, so clicks on one flip it like MS.
export function flip(st, col) {
  const pile = st.tab[col];
  const top = pile[pile.length - 1];
  if (st.won || !top || top.up) return null;
  const s = begin(st);
  const events = [];
  autoFlip(s, col, events);
  return { state: s, events };
}

export function canUndo(st) { return !st.won && st.history.length > 0; }

// Undo restores every card and the score. Play time keeps running, so the
// clock fields are left alone.
export function undo(st) {
  if (!canUndo(st)) return null;
  const s = cloneState(st);
  const snap = s.history.pop();
  applySnapshot(s, snap);
  s.moves++;
  return { state: s, events: [{ t: 'undo' }] };
}

// Advance the play clock. Charges −2 per full 10 s, never below 0.
// Not an undoable action and never recorded in history.
export function tick(st, elapsedMs) {
  if (st.won || elapsedMs <= st.elapsed) return st;
  const s = { ...st, elapsed: elapsedMs };
  const steps = Math.floor(elapsedMs / SCORE.TIME_INTERVAL_MS);
  while (s.timeSteps < steps) {
    s.timeSteps++;
    s.score = Math.max(0, s.score + SCORE.TIME_PENALTY);
  }
  return s;
}

// ---------------------------------------------------------------- helpers for input

// Double-click: the foundation this card can go to right now, or -1.
export function foundationTargetFor(st, src) {
  const cards = cardsAt(st, src);
  if (cards.length !== 1) return -1;
  const fi = foundationIndexFor(cards[0]);
  return foundationReject(st, fi, cards[0]) ? -1 : fi;
}

// ---------------------------------------------------------------- auto-finish

export function canAutoFinish(st) {
  return !st.won && st.stock.length === 0 && st.waste.length === 0 &&
    st.tab.every((col) => col.every((c) => c.up)) && foundationCount(st) < 52;
}

// One step of the auto-finish: send the lowest playable card up.
export function autoFinishStep(st) {
  if (!canAutoFinish(st)) return null;
  let best = null;
  st.tab.forEach((col, i) => {
    const c = col[col.length - 1];
    if (!c) return;
    const fi = foundationIndexFor(c);
    if (!foundationReject(st, fi, c) && (!best || c.r < best.r)) best = { r: c.r, i, idx: col.length - 1, fi };
  });
  if (!best) return null;
  return move(st, { pile: 'tab', i: best.i, idx: best.idx }, { pile: 'found', i: best.fi });
}

// ---------------------------------------------------------------- stuck detection
//
// "Stuck" means no sequence of tableau/foundation shuffling leads to real
// progress. Progress is: a stock/waste card leaves the pool, a face-down card
// gets revealed, or the foundations grow past where they started.
//
// Every stock + waste card counts as reachable, because Draw One with
// unlimited recycles lets any of them become the waste top. Positions are
// searched breadth-first and de-duplicated, which rules out shuffling an
// identical run back and forth. A King at the bottom of a column is never moved
// into another empty column. If the search hits its node limit we answer
// "not stuck": a false loss dialog would be far worse than a missing one.

export function isStuck(st, nodeLimit = 4000) {
  if (st.won || canAutoFinish(st)) return false;
  const pool = [...st.stock, ...st.waste];
  const startFound = foundationCount(st);

  const keyOf = (tab, found) =>
    found.map((f) => f.length).join('.') + '|' + tab.map((col) => col.map(encodeCard).join('')).join(',');

  const seen = new Set();
  const queue = [{ tab: st.tab, found: st.found }];
  seen.add(keyOf(st.tab, st.found));

  while (queue.length) {
    if (seen.size > nodeLimit) return false;
    const { tab, found } = queue.shift();
    const fake = { tab, found };
    const fCount = found.reduce((n, f) => n + f.length, 0);
    const tops = tab.map((col) => col[col.length - 1]);

    // Any pool card playable anywhere is progress.
    for (const c of pool) {
      if (!foundationReject(fake, foundationIndexFor(c), c)) return false;
      if (tops.some((t) => !tableauReject(t, c))) return false;
    }

    const push = (nTab, nFound) => {
      const k = keyOf(nTab, nFound);
      if (!seen.has(k)) { seen.add(k); queue.push({ tab: nTab, found: nFound }); }
    };

    // Tableau → foundation
    for (let i = 0; i < 7; i++) {
      const c = tops[i];
      if (!c) continue;
      const fi = foundationIndexFor(c);
      if (foundationReject(fake, fi, c)) continue;
      const below = tab[i][tab[i].length - 2];
      if (fCount + 1 > startFound || (below && !below.up)) return false;
      const nTab = tab.slice(); nTab[i] = tab[i].slice(0, -1);
      const nFound = found.slice(); nFound[fi] = found[fi].concat([c]);
      push(nTab, nFound);
    }

    // Tableau → tableau runs
    for (let i = 0; i < 7; i++) {
      const col = tab[i];
      for (let idx = 0; idx < col.length; idx++) {
        if (!col[idx].up) continue;
        for (let j = 0; j < 7; j++) {
          if (j === i || tableauReject(tops[j], col[idx])) continue;
          if (idx === 0 && !tops[j]) continue; // King from an empty-able column into another empty column: pointless
          if (idx > 0 && !col[idx - 1].up) return false; // reveals a face-down card
          const nTab = tab.slice();
          nTab[i] = col.slice(0, idx);
          nTab[j] = tab[j].concat(col.slice(idx));
          push(nTab, found);
        }
      }
    }

    // Foundation → tableau (can unlock a placement)
    for (let fi = 0; fi < 4; fi++) {
      const c = found[fi][found[fi].length - 1];
      if (!c) continue;
      for (let j = 0; j < 7; j++) {
        if (tableauReject(tops[j], c)) continue;
        const nTab = tab.slice(); nTab[j] = tab[j].concat([c]);
        const nFound = found.slice(); nFound[fi] = found[fi].slice(0, -1);
        push(nTab, nFound);
      }
    }
  }
  return true;
}
