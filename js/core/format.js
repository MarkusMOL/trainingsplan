const pad = (n) => String(n).padStart(2, '0');

/** Minuten -> "hh:mm" */
export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** 106 -> "106 %" (geschütztes Leerzeichen) */
export function fmtPercent(value) {
  return value === null || value === undefined ? '–' : `${Math.round(value)}\u00a0%`;
}

const dayFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** UTC-Mitternacht (ms) -> "26.10." */
export const fmtShortDate = (ms) => dayFmt.format(ms);
/** -> "Montag, 03.11.2025" */
export const fmtLongDate = (ms) => longFmt.format(ms);
/** -> "Di" */
export const weekdayShort = (ms) => WEEKDAYS[new Date(ms).getUTCDay()];
/** [startMs, endMs] -> "26.10. – 01.11." */
export const fmtRange = ([a, b]) => `${dayFmt.format(a)} – ${dayFmt.format(b)}`;

const dtFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
/** Zeitstempel (ms) -> "29.10., 14:05" */
export const fmtDateTime = (ms) => dtFmt.format(ms);
