// Globaler App-Zustand.
export const state = {
  plan: null, source: null, error: null,        // Plan (Pflicht)
  ist: null, istSource: null, istError: null,   // Ist-Daten (optional)
  events: null,                                  // Termine: { seasonStart, seasonEnd, a1, a2, list }
  history: null,                                 // Vorjahre: { years: [...] }
  sources: {},                                   // Quelle je Datensatz (für die Einstellungen)
  warnings: [],                                  // z. B. ungültige OneDrive-Datei, Ersatzdaten verwendet
  syncing: false,                                // OneDrive-Abgleich läuft
  sync: null,                                    // { authNeeded, errors[] } nach dem letzten Abgleich
  importNote: null,                              // Ergebnis des letzten Mehrfach-Imports { lines[], error }
  authError: null,                               // Fehler bei der Rückkehr von der Microsoft-Anmeldung
};

export function setState(patch) {
  Object.assign(state, patch);
}
