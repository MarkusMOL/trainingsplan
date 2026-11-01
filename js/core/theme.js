import * as settings from './settings.js';

const mq = window.matchMedia('(prefers-color-scheme: dark)');
export const getTheme = () => settings.get('theme', 'auto');

function syncMeta() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

/** mode: 'auto' | 'light' | 'dark' */
export function applyTheme(mode = getTheme()) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.dataset.theme = mode;
  else delete root.dataset.theme;
  requestAnimationFrame(syncMeta);
}

export function setTheme(mode) {
  settings.set('theme', mode);
  applyTheme(mode);
}

export function initTheme() {
  applyTheme();
  mq.addEventListener('change', () => { if (getTheme() === 'auto') applyTheme(); });
}
