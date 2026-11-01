// OneDrive (privates Microsoft-Konto) über Microsoft Graph.
// Anmeldung: Authorization-Code-Flow mit PKCE (kein Client-Secret, kein Backend).
// Dateizugriff: Graph liefert eine vorab autorisierte Download-Adresse, die ohne Anmeldekopf geladen wird
// (der direkte /content-Aufruf scheitert im Browser an einer Weiterleitung mit CORS).
import * as settings from './settings.js';
import { ONEDRIVE_DEFAULTS } from './config.js';
import { decodeBytes } from './csv.js';
import { DATASETS } from './datasets.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPE = 'Files.Read offline_access';
const TIMEOUT_MS = 20000;

/** Anmeldung fehlt oder ist abgelaufen – der Nutzer muss sich neu anmelden. */
export class AuthRequiredError extends Error {}

// ---- Konfiguration ----
export function getConfig() {
  const pick = (key, def) => (settings.get(key) || def || '').trim();
  const paths = {};
  for (const ds of DATASETS) paths[ds.id] = pick(ds.odKey, ONEDRIVE_DEFAULTS.paths?.[ds.id]);
  return { clientId: pick('odClientId', ONEDRIVE_DEFAULTS.clientId), paths, tenant: ONEDRIVE_DEFAULTS.tenant };
}
export const isConfigured = () => { const c = getConfig(); return Boolean(c.clientId && Object.values(c.paths).some(Boolean)); };
/** Microsoft erlaubt Weiterleitungen nur auf https:// oder localhost – nicht bei file://. */
export const isSupported = () => location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');

// ---- Tokens ----
const loadTokens = () => { try { return JSON.parse(settings.get('odTokens') || 'null'); } catch { return null; } };
export const isSignedIn = () => Boolean(loadTokens()?.refresh);

export function signOut() {
  for (const k of ['odTokens', 'odPkce', 'odSyncedAt', 'odTry', ...DATASETS.map((d) => d.cache)]) settings.remove(k);
}

async function fetchT(url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } catch {
    throw new Error('Keine Verbindung zu OneDrive.');
  } finally {
    clearTimeout(timer);
  }
}

async function tokenRequest(params) {
  const { clientId, tenant } = getConfig();
  const res = await fetchT(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, scope: SCOPE, ...params }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error_description?.split('\r\n')[0] || json.error || `HTTP ${res.status}`);
    err.code = json.error;
    throw err;
  }
  const old = loadTokens();
  settings.set('odTokens', JSON.stringify({
    access: json.access_token,
    refresh: json.refresh_token ?? old?.refresh,
    expires: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 60) * 1000,
  }));
}

async function accessToken() {
  const t = loadTokens();
  if (!t?.refresh) throw new AuthRequiredError('Nicht bei OneDrive angemeldet.');
  if (t.access && t.expires > Date.now()) return t.access;
  try {
    await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh });
  } catch (e) {
    // Refresh-Token von Single-Page-Apps gelten nur 24 Stunden -> danach neue Anmeldung nötig
    if (['invalid_grant', 'interaction_required', 'login_required', 'consent_required'].includes(e.code)) {
      settings.remove('odTokens');
      throw new AuthRequiredError('Die OneDrive-Anmeldung ist abgelaufen.');
    }
    throw e;
  }
  return loadTokens().access;
}

// ---- Anmeldung (PKCE) ----
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

/** Leitet zur Microsoft-Anmeldeseite weiter; danach kommt der Nutzer mit ?code=… zurück (handleRedirect). */
export async function signIn() {
  const { clientId, tenant } = getConfig();
  if (!clientId) throw new Error('Bitte zuerst die Client-ID eintragen.');
  const verifier = randomString(48), state = randomString(16);
  settings.set('odPkce', JSON.stringify({ verifier, state, redirect: redirectUri() }));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const q = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: redirectUri(), response_mode: 'query',
    scope: SCOPE, state, code_challenge: challenge, code_challenge_method: 'S256',
  });
  location.assign(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${q}`);
}

/** Beim App-Start aufrufen: verarbeitet die Rückkehr von der Anmeldeseite. null = keine Rückkehr. */
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return null;
  const clean = () => history.replaceState(null, '', location.pathname + '#/');
  let saved = null;
  try { saved = JSON.parse(settings.get('odPkce') || 'null'); } catch { /* ignorieren */ }
  settings.remove('odPkce');
  if (!saved || q.get('state') !== saved.state) {
    clean();
    return { ok: false, error: 'Die Anmeldung konnte nicht zugeordnet werden. Bitte erneut anmelden.' };
  }
  if (q.has('error')) {
    clean();
    return { ok: false, error: (q.get('error_description') || q.get('error')).split('\r\n')[0] };
  }
  try {
    await tokenRequest({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: saved.redirect, code_verifier: saved.verifier });
    clean();
    return { ok: true };
  } catch (e) {
    clean();
    return { ok: false, error: `Anmeldung fehlgeschlagen: ${e.message}` };
  }
}

// ---- Dateizugriff ----
/** Lädt eine Textdatei per Pfad ab OneDrive-Stamm (z. B. "Training/Plan.csv"). */
export async function fetchCsv(path) {
  const token = await accessToken();
  const enc = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  const res = await fetchT(`${GRAPH}/me/drive/root:/${enc}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    settings.remove('odTokens');
    throw new AuthRequiredError('Die OneDrive-Anmeldung ist ungültig geworden.');
  }
  if (res.status === 404) throw new Error(`Datei nicht gefunden: ${path}`);
  if (!res.ok) throw new Error(`OneDrive meldet einen Fehler (HTTP ${res.status}).`);
  const url = (await res.json())['@microsoft.graph.downloadUrl'];
  if (!url) throw new Error(`„${path}“ ist keine Datei.`);
  const file = await fetchT(url);
  if (!file.ok) throw new Error(`Download fehlgeschlagen (HTTP ${file.status}).`);
  return decodeBytes(await file.arrayBuffer());
}
