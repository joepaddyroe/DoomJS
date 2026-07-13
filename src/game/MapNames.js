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
