/**
 * Optional: open multiplayer lobby on startup with `?net=1`
 * or `localStorage.setItem('doomjs-net','1')`.
 * Multiplayer is always available via the top-right toggle; single-player is default.
 */
export function isNetMode() {
  try {
    if (typeof location !== 'undefined') {
      const q = new URLSearchParams(location.search);
      if (q.has('net') && q.get('net') !== '0') {
        return true;
      }
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('doomjs-net') === '1';
    }
  } catch {
    // ignore
  }
  return false;
}

/** Production relay on Miget (override with ?relay=ws://127.0.0.1:7777 for local). */
export const MIGET_RELAY_URL = 'wss://doomjsrelay-iazgi.eu-east-1.migetapp.com';

/** @returns {string} */
export function defaultRelayUrl() {
  try {
    const q = new URLSearchParams(location.search);
    return q.get('relay') || MIGET_RELAY_URL;
  } catch {
    return MIGET_RELAY_URL;
  }
}
