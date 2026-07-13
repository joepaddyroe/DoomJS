import { damageMobj } from './monster/MobjCombat.js';
import { gameRandom } from './GameRandom.js';

/** Power-up tics remaining (p_user.c / p_inter.c). */
export const pw_invulnerability = 0;
export const pw_strength = 1;
export const pw_invisibility = 2;
export const pw_ironfeet = 3;
export const pw_allmap = 4;
export const NUMPOWERS = 5;

/** Damage applied every 32 tics (p_spec.c — leveltime & 0x1f). */
const DAMAGE_INTERVAL_MASK = 0x1f;

/**
 * Tick down active power-ups.
 * @param {import('./Player.js').Player} player
 */
export function tickPlayerPowers(player) {
  for (let i = 0; i < NUMPOWERS; i++) {
    if (player.powers[i]) {
      player.powers[i]--;
    }
  }
}

/**
 * Sector floor damage and effects (p_spec.c — P_PlayerInSpecialSector).
 * @param {import('./Player.js').Player} player
 */
export function thinkPlayerSpecialSector(player) {
  const mo = player.mo;
  const sector = mo.subsector?.sector;
  if (!sector) {
    return;
  }

  // Falling — not on the sector floor yet.
  if (mo.z !== sector.floorHeight) {
    return;
  }

  // Vanilla applies damage on every 32nd gametic.
  if (player.leveltime & DAMAGE_INTERVAL_MASK) {
    return;
  }

  const suited = player.powers[pw_ironfeet] > 0;

  switch (sector.special) {
    case 5:
      if (!suited) {
        damageMobj(mo, null, null, 10, player);
      }
      break;
    case 7:
      if (!suited) {
        damageMobj(mo, null, null, 5, player);
      }
      break;
    case 4:
    case 16:
      if (!suited || gameRandom() < 5) {
        damageMobj(mo, null, null, 20, player);
      }
      break;
    default:
      break;
  }
}

/**
 * @param {import('./Player.js').Player} player
 * @param {number} power
 * @param {number} tics
 * @returns {boolean}
 */
export function givePower(player, power, tics) {
  if (power < 0 || power >= NUMPOWERS) {
    return false;
  }
  if (player.powers[power] >= tics) {
    return false;
  }
  player.powers[power] = tics;
  player.bonuscount += 2;
  return true;
}

/** @param {import('./Player.js').Player} player @param {number} tics */
export function giveIronFeet(player, tics = 60 * 35) {
  return givePower(player, pw_ironfeet, tics);
}
