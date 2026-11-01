import { GOAL_HUES } from '../core/config.js';

/** Farbton je Trainingsziel; unbekannte Ziele bekommen einen stabilen Hash-Farbton. */
export function goalHue(goal) {
  if (!goal) return null;
  if (goal in GOAL_HUES) return GOAL_HUES[goal];
  let hash = 0;
  for (const ch of goal) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

/** Attribute für ein Element, das nach Trainingsziel eingefärbt wird (CSS: --h). */
export function goalAttrs(goal) {
  const hue = goalHue(goal);
  return hue === null
    ? { class: 'goal-none', style: { '--h': '215' } }
    : { class: 'goal-x', style: { '--h': String(hue) } };
}
