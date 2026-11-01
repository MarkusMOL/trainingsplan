// Zentrale Konfiguration: Farben, Sportarten, Wochentage, Ampel.
// Neue Sportarten / Trainingsziele hier ergänzen – unbekannte Werte funktionieren trotzdem (Fallback).

export const APP_VERSION = '4.0.0';

// Farbton (HSL-Hue) je Trainingsziel. Unbekannte Ziele bekommen einen stabilen Hash-Farbton.
export const GOAL_HUES = {
  'AE': 152,
  'AE+SS': 28,
  'AE+ME': 265,
};

// Anzeigename, Symbol und Reihenfolge je Sportart (Schlüssel = Wert der CSV-Spalte "Sportart").
export const SPORTS = {
  Swim:     { label: 'Schwimmen', icon: '🏊', order: 1 },
  Bike:     { label: 'Rad',       icon: '🚴', order: 2 },
  Run:      { label: 'Laufen',    icon: '🏃', order: 3 },
  Athletik: { label: 'Athletik',  icon: '🤸', order: 4 },
  Strength: { label: 'Kraft',     icon: '🏋️', order: 5 },
};

export const DAY_ORDER = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Ampel für die zeitliche Erfüllung (Ist-Minuten / Plan-Minuten):
//   grün  : über  90 %
//   gelb  : ab    50 %
//   rot   : darunter
export const THRESHOLDS = { green: 0.9, yellow: 0.5 };
export const LEVEL_LABEL = { green: 'erfüllt', yellow: 'teilweise', red: 'verfehlt' };

// ---- OneDrive-Anbindung (privates Microsoft-Konto) ----
// Diese Werte können hier vor dem Hochladen eingetragen oder in der App unter Einstellungen gesetzt werden
// (Einstellungen in der App haben Vorrang). Die Client-ID ist kein Geheimnis.
export const ONEDRIVE_DEFAULTS = {
  clientId: '',   // "Anwendungs-(Client-)ID" der Azure-App-Registrierung
  // Pfade ab OneDrive-Stamm, z. B. 'Training/Plan.csv'. Leer = Datei nicht verwenden.
  paths: { plan: '', ist: '', basis: '', wk: '', hist: '' },
  tenant: 'consumers', // 'consumers' = nur private Microsoft-Konten, 'common' = privat + Arbeit/Schule
};

// Beim Start wird immer synchronisiert. Kehrt man später in die App zurück, wird erneut synchronisiert,
// sofern der letzte Versuch länger als so viele Minuten zurückliegt.
export const SYNC = { minIntervalMin: 5 };

// ---- Darstellung der Auswertungen ----
export const SPORT_HUES = { Swim: 205, Bike: 35, Run: 280, Athletik: 170 };   // Farbton je Sportart in Diagrammen
export const PHASE_HUES = { PREP: 215, BASE: 175, BUILD: 265, PEAK: 28, RACE: 48, TRANS: 0 }; // Zeitleiste der Wettkämpfe
