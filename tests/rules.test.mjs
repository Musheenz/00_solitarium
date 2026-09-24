// Rules tests. Run from the repo root:  node --test tests/rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../docs/js/game.js';

// Build a position. Card names like '7H'; prefix '#' for face-down.
// found: { S: 3 } puts A–3 of spades on the spade foundation.
function build({ stock = [], waste = [], found = {}, tab = [] } = {}) {
  const s = G.emptyState();
  const c = (n, defUp) => (n.startsWith('#') ? G.cardFromName(n.slice(1), false) : G.cardFromName(n, defUp));
  s.stock = stock.map((n) => c(n, false));
  s.waste = waste.map((n) => c(n, true));
  for (const [suit, h] of Object.entries(found)) {
    const fi = G.SUITS.indexOf(suit);
    for (let r = 1; r <= h; r++) s.found[fi].push(G.cardFromName(G.RANK_NAMES[r] + suit));
  }
  tab.forEach((col, i) => { s.tab[i] = col.map((n) => c(n, true)); });
  return s;
}
const T = (i, idx) => ({ pile: 'tab', i, idx });
const toT = (i) => ({ pile: 'tab', i });
const toF = (suit) => ({ pile: 'found', i: G.SUITS.indexOf(suit) });
const W = { pile: 'waste' };
const F = (suit) => ({ pile: 'found', i: G.SUITS.indexOf(suit) });

// ------------------------------------------------------------ deal

test('deal: 1..7 cards per column, top up, 24 in stock, 52 unique', () => {
  const s = G.newGame(12345);
  s.tab.forEach((col, i) => {
    assert.equal(col.length, i + 1);
    col.forEach((c, k) => assert.equal(c.up, k === i));
  });
  assert.equal(s.stock.length, 24);
  assert.ok(s.stock.every((c) => !c.up));
  const ids = new Set([...s.stock, ...s.tab.flat()].map((c) => c.id));
  assert.equal(ids.size, 52);
});

test('deal is deterministic per seed', () => {
  assert.deepEqual(G.newGame(7), G.newGame(7));
  assert.notDeepEqual(G.newGame(7).stock, G.newGame(8).stock);
});

test('card names match asset file names', () => {
  assert.equal(G.cardName(G.cardFromName('10D')), '10D');
  assert.equal(G.cardName(G.makeCard(0)), 'AS');
  assert.equal(G.cardName(G.makeCard(51)), 'KC');
});

// ------------------------------------------------------------ tableau

test('tableau: alternating colors, one rank down', () => {
  const s = build({ waste: ['7H'], tab: [['8S'], ['8D'], ['9C']] });
  assert.equal(G.moveReject(s, W, toT(0)), null);
  assert.equal(G.moveReject(s, W, toT(1)), 'color');
  assert.equal(G.moveReject(s, W, toT(2)), 'rank');
});

test('tableau: face-up runs move together, partial runs too', () => {
  const s = build({ tab: [['#2C', '9S', '8H', '7C'], ['10D'], ['9D']] });
  const r = G.move(s, T(0, 1), toT(1));
  assert.ok(r);
  assert.deepEqual(r.state.tab[1].map(G.cardName), ['10D', '9S', '8H', '7C']);
  const r2 = G.move(s, T(0, 2), toT(2));
  assert.equal(G.moveReject(s, T(0, 2), toT(2)), 'color');
  assert.equal(r2, null);
});

test('tableau: face-down cards cannot be moved', () => {
  const s = build({ tab: [['#9S', '8H'], ['10D']] });
  assert.equal(G.moveReject(s, T(0, 0), toT(1)), 'empty');
});

test('empty column accepts only a King (or run starting with a King)', () => {
  const s = build({ waste: ['QH'], tab: [[], ['#3C', 'KS', 'QD'], ['#4C', 'QS']] });
  assert.equal(G.moveReject(s, W, toT(0)), 'king');
  assert.equal(G.moveReject(s, T(2, 1), toT(0)), 'king');
  assert.equal(G.moveReject(s, T(1, 1), toT(0)), null);
});

// ------------------------------------------------------------ foundations

test('foundation: Ace first, then same suit upward', () => {
  const s = build({ waste: ['2H'], tab: [['AH'], ['AS'], ['2S']], found: {} });
  assert.equal(G.moveReject(s, W, toF('H')), 'rank');
  assert.equal(G.moveReject(s, T(1, 0), toF('H')), 'suit');
  const r = G.move(s, T(0, 0), toF('H'));
  assert.ok(r);
  assert.equal(G.moveReject(r.state, W, toF('H')), null);
});

test('foundation: only single cards', () => {
  const s = build({ found: { H: 4 }, tab: [['5H', '4C']] });
  assert.equal(G.moveReject(s, T(0, 0), toF('H')), 'rank');
});

test('foundation → tableau allowed, costs 15', () => {
  const s = build({ found: { H: 5 }, tab: [['6S']] });
  s.score = 50;
  const r = G.move(s, F('H'), toT(0));
  assert.ok(r);
  assert.equal(r.state.score, 35);
  assert.equal(r.state.found[1].length, 4);
});

test('double-click target', () => {
  const s = build({ found: { S: 2 }, waste: ['3S'], tab: [['3H']] });
  assert.equal(G.foundationTargetFor(s, W), 0);
  assert.equal(G.foundationTargetFor(s, T(0, 0)), -1);
});

// ------------------------------------------------------------ stock

test('draw moves one card face-up to the waste', () => {
  const s = build({ stock: ['2C', '3C', '4C'] });
  const r = G.draw(s);
  assert.deepEqual(r.state.waste.map(G.cardName), ['4C']);
  assert.ok(r.state.waste[0].up);
  assert.equal(r.state.stock.length, 2);
});

test('recycle restores the original order, face-down, −100 floored at 0', () => {
  let s = build({ stock: ['2C', '3C', '4C'] });
  s.score = 150;
  for (let i = 0; i < 3; i++) s = G.draw(s).state;
  assert.deepEqual(s.waste.map(G.cardName), ['4C', '3C', '2C']);
  const r = G.draw(s);
  assert.deepEqual(r.state.stock.map(G.cardName), ['2C', '3C', '4C']);
  assert.ok(r.state.stock.every((c) => !c.up));
  assert.equal(r.state.score, 50);
  let s2 = r.state;
  for (let i = 0; i < 3; i++) s2 = G.draw(s2).state;
  assert.equal(G.draw(s2).state.score, 0); // floor
});

test('recycles are unlimited; empty stock + empty waste is a no-op', () => {
  let s = build({ stock: ['2C'] });
  for (let i = 0; i < 20; i++) { s = G.draw(s).state; }
  assert.ok(s);
  assert.equal(G.draw(build({})), null);
});

// ------------------------------------------------------------ scoring

test('scoring: every move type', () => {
  const s = build({ waste: ['7H'], stock: ['AD'], tab: [['8S'], ['#2C', 'AC'], ['#9C', 'KD']], found: {} });
  const a = G.move(s, W, toT(0));
  assert.equal(a.state.score, 5, 'waste → tableau +5');

  const b = G.move(s, T(1, 1), toF('C'));
  assert.equal(b.state.score, 15, 'tableau → foundation +10 and flip +5');
  assert.ok(b.events.some((e) => e.t === 'flip'));
  assert.ok(b.state.tab[1][0].up, 'auto-flip');

  const e = G.move(build({ waste: ['AD'] }), W, toF('D'));
  assert.equal(e.state.score, 10, 'waste → foundation +10');

  const f = G.move(build({ tab: [['#5C', '9H'], ['10S']] }), T(0, 1), toT(1));
  assert.equal(f.state.score, 5, 'tableau → tableau 0, flip +5');
});

test('time penalty: −2 every full 10 s, floored at 0', () => {
  let s = build({});
  s.score = 5;
  s = G.tick(s, 9999);
  assert.equal(s.score, 5);
  s = G.tick(s, 10000);
  assert.equal(s.score, 3);
  s = G.tick(s, 35000);
  assert.equal(s.score, 0);
  assert.equal(s.timeSteps, 3);
});

test('win bonus 700000 / seconds when time ≥ 30 s', () => {
  const mk = () => build({ found: { S: 13, H: 13, D: 13, C: 12 }, tab: [['KC']] });
  let s = G.tick(mk(), 100000); // 100 s, 10 penalties, but score is 0 already
  const r = G.move(s, T(0, 0), toF('C'));
  assert.ok(r.state.won);
  assert.equal(r.state.score, 10 + 7000);
  const quick = G.move(G.tick(mk(), 29000), T(0, 0), toF('C'));
  assert.equal(quick.state.score, 10);
});

// ------------------------------------------------------------ undo

test('undo restores cards and score, unlimited', () => {
  let s = build({ stock: ['2H', 'AH'], tab: [['#5C', '9H'], ['10S']] });
  const s0 = s;
  s = G.draw(s).state;               // AH
  s = G.move(s, W, toF('H')).state;  // +10
  s = G.move(s, T(0, 1), toT(1)).state; // flip +5
  assert.equal(s.score, 15);
  s = G.undo(s).state;
  assert.equal(s.score, 10);
  assert.equal(s.tab[0].length, 2);
  assert.equal(s.tab[0][0].up, false);
  s = G.undo(G.undo(s).state).state;
  assert.equal(s.score, 0);
  assert.equal(G.encodeSnapshot(s), G.encodeSnapshot(s0));
  assert.equal(G.undo(s), null);
});

test('undo restores score after a recycle penalty', () => {
  let s = build({ stock: ['2C'] });
  s.score = 120;
  s = G.draw(G.draw(s).state).state;
  assert.equal(s.score, 20);
  assert.equal(G.undo(s).state.score, 120);
});

test('actions never mutate their input', () => {
  const s = G.newGame(99);
  const before = JSON.stringify(s);
  G.draw(s);
  G.move(s, T(6, 6), toT(0));
  G.undo(G.draw(s).state);
  assert.equal(JSON.stringify(s), before);
});

// ------------------------------------------------------------ auto-finish

test('auto-finish triggers only with empty stock/waste and all face-up', () => {
  const ready = build({ found: { S: 11, H: 11, D: 13, C: 13 }, tab: [['KS', 'QH'], ['QS'], ['KH']] });
  assert.ok(G.canAutoFinish(ready));
  assert.ok(!G.canAutoFinish(build({ stock: ['AS'], tab: [['KS']] })));
  assert.ok(!G.canAutoFinish(build({ waste: ['AS'], tab: [['KS']] })));
  assert.ok(!G.canAutoFinish(build({ tab: [['#KS', 'QH']] })));

  let s = ready;
  let steps = 0;
  while (!s.won) { s = G.autoFinishStep(s).state; steps++; }
  assert.equal(steps, 4);
  assert.equal(G.foundationCount(s), 52);
});

// ------------------------------------------------------------ stuck detection

test('stuck: nothing playable anywhere', () => {
  const s = build({
    stock: ['9C', '9S'], waste: ['4D'],
    tab: [['#2H', '5H'], ['#2D', '5D'], ['#3H', 'KS'], ['#3D', 'KC'], ['#4H', '6H'], ['#AH', '6D'], ['#AD', 'JH']],
  });
  assert.equal(G.isStuck(s), true);
});

test('not stuck: a buried stock card can be played', () => {
  const s = build({
    stock: ['4S', '9S'], waste: ['4D'],
    tab: [['#2H', '5H'], ['#2D', '5D'], ['#3H', 'KS'], ['#3D', 'KC'], ['#4H', '6H'], ['#AH', '6D'], ['#AD', 'JH']],
  });
  assert.equal(G.isStuck(s), false); // 4S onto 5H/5D
});

test('not stuck: a move reveals a face-down card', () => {
  const s = build({ tab: [['#2H', '9S'], ['10H']] });
  assert.equal(G.isStuck(s), false);
});

test('not stuck: a card can go to the foundation', () => {
  const s = build({ tab: [['#2H', 'AS']] });
  assert.equal(G.isStuck(s), false);
});

test('stuck: only pointless moves (King to empty column, run back and forth)', () => {
  const s = build({
    stock: ['2C'],
    tab: [['KS', 'QH'], [], ['8D'], ['9S'], ['9C'], ['#4C', '5S'], ['#5C', '6S']],
  });
  // 8D can hop between 9S and 9C forever, and KS-QH could go to the empty
  // column, but none of that reveals anything or plays the 2C.
  assert.equal(G.isStuck(s), true);
});

test('not stuck: needs a two-step shuffle before progress', () => {
  // 5H sits on 6C. Moving it onto 6S exposes 6C, which can then go up.
  const s = build({
    stock: ['2H'], found: { C: 5 },
    tab: [['6C', '5H'], ['#4D', '6S'], ['KD'], ['KH'], ['KS'], [], []],
  });
  assert.equal(G.isStuck(s), false);
});

test('not stuck: foundation card comes down to unlock a placement', () => {
  // 4D needs a black 5; 5S is on the foundation. Bring it down onto 6H,
  // then 4D (covering a face-down card) goes onto it.
  const s = build({
    found: { S: 5 },
    tab: [['#9C', '4D'], ['6H'], ['KC'], ['KD'], ['KH'], ['KS'], []],
  });
  assert.equal(G.isStuck(s), false);
});

test('a fresh deal is never stuck and a won game is not stuck', () => {
  for (let seed = 1; seed <= 50; seed++) assert.equal(G.isStuck(G.newGame(seed)), false);
  const won = build({ found: { S: 13, H: 13, D: 13, C: 12 }, tab: [['KC']] });
  assert.equal(G.isStuck(G.move(won, T(0, 0), toF('C')).state), false);
});
