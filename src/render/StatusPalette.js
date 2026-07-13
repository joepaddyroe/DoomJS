import { pw_ironfeet, pw_strength } from '../game/PlayerPowers.js';

/** st_stuff.c — PLAYPAL palette indices */
const START_REDPALS = 1;
const START_BONUSPALS = 9;
const NUM_REDPALS = 8;
const NUM_BONUSPALS = 4;
const RADIATION_PAL = 13;

/**
 * Status-bar palette selection (st_stuff.c — ST_doPaletteStuff).
 * @param {import('../game/Player.js').Player} player
 * @returns {number}
 */
export function statusPaletteIndex(player) {
  let cnt = player.damagecount;

  if (player.powers[pw_strength]) {
    const bzc = 12 - (player.powers[pw_strength] >> 6);
    if (bzc > cnt) {
      cnt = bzc;
    }
  }

  if (cnt) {
    let palette = (cnt + 7) >> 3;
    if (palette >= NUM_REDPALS) {
      palette = NUM_REDPALS - 1;
    }
    return palette + START_REDPALS;
  }

  if (player.bonuscount) {
    let palette = (player.bonuscount + 7) >> 3;
    if (palette >= NUM_BONUSPALS) {
      palette = NUM_BONUSPALS - 1;
    }
    return palette + START_BONUSPALS;
  }

  if (player.powers[pw_ironfeet] > 4 * 32 || (player.powers[pw_ironfeet] & 8)) {
    return RADIATION_PAL;
  }

  return 0;
}
