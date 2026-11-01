const SWIPE_MIN = 60;

/** Wischen (links = nächste, rechts = vorherige Woche) und Pfeiltasten. Gibt eine Aufräum-Funktion zurück. */
export function attachWeekNav(el, { prev, next, go }) {
  let x0 = null, y0 = null;
  const onStart = (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; };
  const onEnd = (e) => {
    if (x0 === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = y0 = null;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const target = dx < 0 ? next : prev;
    if (target !== undefined) go(target);
  };
  const onKey = (e) => {
    if (document.querySelector('dialog[open]') || /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft' && prev !== undefined) go(prev);
    if (e.key === 'ArrowRight' && next !== undefined) go(next);
  };
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
