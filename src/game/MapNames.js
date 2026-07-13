/** Episode 1 map titles (d_englsh.h). */
export const EP1_MAP_NAMES = [
  'Hangar',
  'Plant',
  'Toxin Refinery',
  'Command Control',
  'Phobos Lab',
  'Central Processing',
  'Computer Station',
  'Phobos Anomaly',
];

/**
 * @param {string} mapName e.g. E1M1
 * @returns {string}
 */
export function titleForMap(mapName) {
  const match = /^E1M(\d)$/i.exec(mapName);
  if (match) {
    const index = Number(match[1]) - 1;
    return EP1_MAP_NAMES[index] ?? mapName;
  }
  return mapName;
}

/**
 * Next map in episode order (g_game.c — G_WorldDone).
 * @param {string} mapName
 * @param {boolean} [secret=false]
 * @returns {string|null}
 */
export function nextMapName(mapName, secret = false) {
  const match = /^E(\d)M(\d)$/i.exec(mapName);
  if (!match) {
    return null;
  }

  const episode = Number(match[1]);
  const map = Number(match[2]);

  if (secret && map === 8) {
    return `E${episode}M9`;
  }

  if (map >= 8) {
    return null;
  }

  return `E${episode}M${map + 1}`;
}
