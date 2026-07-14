import { damageMobj } from './monster/MobjCombat.js';
import { gameRandom } from './GameRandom.js';
import { MF_SHADOW } from './mobjFlags.js';

/** Power-up tics remaining (p_user.c / p_inter.c). */
export const pw_invulnerability = 0;
export const pw_strength = 1;
export const pw_invisibility = 2;
export const pw_ironfeet = 3;
export const pw_allmap = 4;
export const NUMPOWERS = 5;

/** doomdef.h */
export const INVULNTICS = 30 * 35;
export const INVISTICS = 60 * 35;
export const IRONTICS = 60 * 35;

/** Damage applied every 32 tics (p_spec.c — leveltime & 0x1f). */
const DAMAGE_INTERVAL_MASK = 0x1f;

/**
 * Tick down active power-ups (p_user.c — P_PlayerTick).
 * @param {import('./Player.js').Player} player
 */
export function tickPlayerPowers(player) {
  if (player.powers[pw_strength]) {
    player.powers[pw_strength]++;
  }

  if (player.powers[pw_invulnerability]) {
    player.powers[pw_invulnerability]--;
  }

  if (player.powers[pw_invisibility]) {
    if (--player.powers[pw_invisibility] <= 0) {
      player.powers[pw_invisibility] = 0;
      player.mo.flags &= ~MF_SHADOW;
    }
  }

  if (player.powers[pw_ironfeet]) {
    player.powers[pw_ironfeet]--;
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
 * @param {number} [tics]
 * @returns {boolean}
 */
export function givePower(player, power, tics = 1) {
  if (power < 0 || power >= NUMPOWERS) {
    return false;
  }

  if (power === pw_invulnerability) {
    if (player.powers[power] >= INVULNTICS) {
      return false;
    }
    player.powers[power] = INVULNTICS;
    player.bonuscount += 2;
    return true;
  }

  if (power === pw_invisibility) {
    if (player.powers[power] >= INVISTICS) {
      return false;
    }
    player.powers[power] = INVISTICS;
    player.mo.flags |= MF_SHADOW;
    player.bonuscount += 2;
    return true;
  }

  if (power === pw_ironfeet) {
    if (player.powers[power] >= tics) {
      return false;
    }
    player.powers[power] = tics;
    player.bonuscount += 2;
    return true;
  }

  if (power === pw_strength) {
    player.powers[power] = 1;
    player.bonuscount += 2;
    return true;
  }

  if (player.powers[power]) {
    return false;
  }

  player.powers[power] = tics;
  player.bonuscount += 2;
  return true;
}

/** @param {import('./Player.js').Player} player @param {number} tics */
export function giveIronFeet(player, tics = IRONTICS) {
  return givePower(player, pw_ironfeet, tics);
}
