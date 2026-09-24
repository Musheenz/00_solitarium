// anim.js — easing, tweens, and the on-demand frame loop.
// The loop only runs while something moves; otherwise the canvas redraws on
// events. Idle cost is zero.

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------- tweens

const tweens = new Set();

// Tween numeric props of obj. Returns a handle with cancel(). A new tween on
// the same obj+prop replaces the old one, so every animation is interruptible.
export function tween(obj, to, { dur = 150, delay = 0, easing = ease.outCubic, onStart, onDone, onUpdate } = {}) {
  for (const t of tweens) {
    if (t.obj !== obj) continue;
    for (const k of Object.keys(to)) delete t.to[k];
    if (!Object.keys(t.to).length) tweens.delete(t);
  }
  const t = { obj, to: { ...to }, from: null, dur, delay, easing, start: now(), onStart, onDone, onUpdate, started: false };
  tweens.add(t);
  requestFrame();
  return { cancel: () => tweens.delete(t), t };
}

export function cancelTweens(obj) {
  for (const t of tweens) if (t.obj === obj) tweens.delete(t);
}

export function isTweening(obj) {
  for (const t of tweens) if (t.obj === obj) return true;
  return false;
}

// Jump every tween to its end (used before a new state lands).
export function finishAll(filter = () => true) {
  for (const t of [...tweens]) {
    if (!filter(t.obj)) continue;
    Object.assign(t.obj, t.to);
    tweens.delete(t);
    t.onDone?.();
  }
}

function stepTweens(time) {
  for (const t of [...tweens]) {
    const el = time - t.start - t.delay;
    if (el < 0) continue;
    if (!t.started) {
      t.started = true;
      t.from = {};
      for (const k of Object.keys(t.to)) t.from[k] = t.obj[k];
      t.onStart?.();
    }
    const p = t.dur <= 0 ? 1 : Math.min(1, el / t.dur);
    const e = t.easing(p);
    for (const k of Object.keys(t.to)) t.obj[k] = lerp(t.from[k], t.to[k], e);
    t.onUpdate?.(p);
    if (p >= 1) {
      tweens.delete(t);
      t.onDone?.();
    }
  }
}

// ---------------------------------------------------------------- frame loop

const now = () => performance.now();
let renderFn = () => {};
const busy = new Set(); // named things that need frames: 'drag', 'particles', ...
let scheduled = false;
let lastTime = 0;

export function setRenderer(fn) { renderFn = fn; }

export function setBusy(name, on) {
  if (on) { busy.add(name); requestFrame(); } else busy.delete(name);
}

export function requestFrame() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(frame);
}

function frame(time) {
  scheduled = false;
  const dt = lastTime ? Math.min(50, time - lastTime) : 16;
  lastTime = time;
  stepTweens(time);
  renderFn(time, dt);
  if (tweens.size || busy.size) requestFrame();
  else lastTime = 0;
}

export const animating = () => tweens.size > 0 || busy.size > 0;
