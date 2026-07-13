/** @typedef {'shareware' | 'registered' | 'retail' | 'commercial'} Gamemode */

/**
 * Detect IWAD type from lump names (d_main.c — IdentifyVersion).
 * @param {import('../wad/WadFile.js').WadFile} wad
 * @returns {Gamemode}
 */
export function detectGamemode(wad) {
  if (wad.indexOf('MAP01') >= 0) {
    return 'commercial';
  }
  if (wad.indexOf('E4M1') >= 0) {
    return 'retail';
  }
  if (wad.indexOf('E3M1') >= 0) {
    return 'registered';
  }
  return 'shareware';
}

/**
 * @param {Gamemode} gamemode
 * @returns {number}
 */
export function episodeMenuCount(gamemode) {
  if (gamemode === 'retail') {
    return 4;
  }
  return 3;
}

/**
 * @param {number} episode 1-based
 * @param {number} map 1-based
 * @returns {string}
 */
export function mapNameForEpisode(episode, map = 1) {
  return `E${episode}M${map}`;
}
