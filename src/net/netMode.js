/**
 * Feature flag for experimental net lockstep.
 * Enable with `?net=1` or `localStorage.setItem('doomjs-net','1')`.
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

/** @returns {string} */
export function defaultRelayUrl() {
  try {
    const q = new URLSearchParams(location.search);
    return q.get('relay') || 'ws://127.0.0.1:7777';
  } catch {
    return 'ws://127.0.0.1:7777';
  }
}
