// Einfacher Key-Value-Speicher auf localStorage (mit Fallback in den Speicher, z. B. im Privatmodus).
const PREFIX = 'tp.';
const mem = new Map();

export function get(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    if (v !== null) return v;
  } catch { /* ignorieren */ }
  return mem.has(key) ? mem.get(key) : fallback;
}

/** @returns {boolean} true, wenn dauerhaft gespeichert */
export function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
    mem.delete(key);
    return true;
  } catch {
    mem.set(key, value);
    return false;
  }
}

export function remove(key) {
  mem.delete(key);
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignorieren */ }
}
