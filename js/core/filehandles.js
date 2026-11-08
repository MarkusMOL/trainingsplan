// Merkt sich per Android-/Desktop-Dateiauswahl gewählte Dateien (File System Access API, Chrome ab Android 132)
// und liest sie später ohne erneute Auswahl. Die Zugriffsrechte speichert der Browser; bei einer neuen Sitzung
// kann eine einmalige Bestätigung nötig sein (requestPermission braucht eine Nutzeraktion).
const DB = 'tp-files', STORE = 'handles';

export const isSupported = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function' && typeof indexedDB !== 'undefined';

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req?.result); };
    t.onerror = t.onabort = () => { db.close(); reject(t.error); };
  });
}

export const remember = (id, handle) => run('readwrite', (s) => s.put(handle, id));
export const forgetAll = () => run('readwrite', (s) => s.clear());

/** @returns {Promise<{id: string, handle: FileSystemFileHandle}[]>} */
export async function remembered() {
  if (!isSupported()) return [];
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const out = [];
      const t = db.transaction(STORE, 'readonly');
      const cur = t.objectStore(STORE).openCursor();
      cur.onsuccess = () => { const c = cur.result; if (c) { out.push({ id: c.key, handle: c.value }); c.continue(); } };
      t.oncomplete = () => { db.close(); resolve(out); };
      t.onerror = t.onabort = () => { db.close(); resolve([]); };
    });
  } catch {
    return [];
  }
}

/**
 * Öffnet den Dateiauswahldialog (mehrere Dateien). startHandle: eine gemerkte Datei; der Dialog öffnet dann im selben Ordner.
 * Bricht der Nutzer ab, kommt ein leeres Array zurück.
 */
export async function pick(startHandle = null) {
  const base = { multiple: true, id: 'tp-csv' };
  try {
    return await window.showOpenFilePicker(startHandle ? { ...base, startIn: startHandle } : base);
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    if (!startHandle) throw e;
    // startIn nicht unterstützt oder ungültig: ohne versuchen
    try {
      return await window.showOpenFilePicker(base);
    } catch (e2) {
      if (e2?.name === 'AbortError') return [];
      throw e2;
    }
  }
}
