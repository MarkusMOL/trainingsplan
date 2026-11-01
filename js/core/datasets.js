// Alle Datendateien der App an einer Stelle.
//   id         Kennung
//   label      Anzeigename
//   odKey      Einstellungs-Schlüssel für den OneDrive-Pfad
//   cache      Schlüssel der lokalen Kopie der OneDrive-Datei
//   imp/impName  Schlüssel der importierten Datei (Text / Dateiname)
//   bundled    mitgelieferte Datei (optional)    embedded: globale Variable in standalone.html
export const DATASETS = [
  { id: 'plan',  label: 'Plan',                 odKey: 'odPlanPath',  cache: 'odPlan',  imp: 'csv',      impName: 'csvName',      bundled: 'data/plan.csv',         embedded: '__EMBEDDED_PLAN__',  example: 'Training/Plan.csv' },
  { id: 'ist',   label: 'Ist-Daten',            odKey: 'odIstPath',   cache: 'odIst',   imp: 'istCsv',   impName: 'istCsvName',   bundled: 'data/ist.csv',          embedded: '__EMBEDDED_IST__',   example: 'Training/Ist.csv' },
  { id: 'basis', label: 'Basisdaten (Termine)', odKey: 'odBasisPath', cache: 'odBasis', imp: 'basisCsv', impName: 'basisCsvName', bundled: 'data/basisdaten.csv',   embedded: '__EMBEDDED_BASIS__', example: 'Training/Basisdaten.csv' },
  { id: 'wk',    label: 'WK-Kalender',          odKey: 'odWkPath',    cache: 'odWk',    imp: 'wkCsv',    impName: 'wkCsvName',    bundled: 'data/wk-kalender.csv',  embedded: '__EMBEDDED_WK__',    example: 'Training/WK-Kalender.csv' },
  { id: 'hist',  label: 'Vorjahre',             odKey: 'odHistPath',  cache: 'odHist',  imp: 'histCsv',  impName: 'histCsvName',  bundled: 'data/vorjahre.csv',     embedded: '__EMBEDDED_HIST__',  example: 'Training/Vorjahre.csv' },
];
export const dataset = (id) => DATASETS.find((d) => d.id === id);
