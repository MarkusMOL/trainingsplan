// Statische SVG-Icons (vertrauenswürdige Konstanten, daher innerHTML ok).
const PATHS = {
  left:     '<path d="M15 18l-6-6 6-6"/>',
  right:    '<path d="M9 18l6-6-6-6"/>',
  back:     '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  grid:     '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  today:    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  refresh:  '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  chart:    '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  flag:     '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  trend:    '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  history:  '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2"/>',
  sliders:  '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/>',
};

export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML =
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
  return span;
}
