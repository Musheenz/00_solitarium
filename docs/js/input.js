// input.js — Pointer Events and keys, converted to native-pixel coordinates.
// A touchpad tap arrives as an ordinary pointerdown/pointerup pair.

export function attachInput(canvas, view, h) {
  const toNative = (e) => {
    const r = canvas.getBoundingClientRect();
    const dx = (e.clientX - r.left) * (canvas.width / r.width);
    const dy = (e.clientY - r.top) * (canvas.height / r.height);
    return { x: (dx - view.ox) / view.S, y: dy / view.S, t: e.timeStamp };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }
    h.down(toNative(e), e);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    // A release we never heard about (alt-tab, lid closed mid-drag): no button held.
    if (e.pointerType === 'mouse' && e.buttons === 0 && h.isHolding()) { h.up(toNative(e), e); return; }
    h.move(toNative(e), e);
  });
  canvas.addEventListener('pointerup', (e) => {
    h.up(toNative(e), e);
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ok */ }
  });
  canvas.addEventListener('pointercancel', () => h.cancel());
  canvas.addEventListener('lostpointercapture', () => { if (h.isHolding()) h.cancel(); });
  window.addEventListener('blur', () => h.cancel());
  canvas.addEventListener('pointerleave', () => h.leave());
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => h.key(e));
}
