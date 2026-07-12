import { FRACUNIT } from '../../core/renderConstants.js';

/** Weapon types (doomdef.h). */
export const WP_FIST = 0;
export const WP_PISTOL = 1;
export const NUM_WEAPONS = 2;

export const WP_NOCHANGE = -1;

/** Ammo types (doomdef.h). */
export const AM_CLIP = 0;
export const AM_NOAMMO = -1;
export const NUM_AMMO = 1;

/** Psprite slots (p_pspr.h). */
export const PS_WEAPON = 0;
export const PS_FLASH = 1;
export const NUM_PSPRITES = 2;

/** Psprite vertical positions (p_pspr.c). */
export const WEAPONTOP = 32 * FRACUNIT;
export const WEAPONBOTTOM = 128 * FRACUNIT;
export const LOWERSPEED = FRACUNIT * 6;
export const RAISESPEED = FRACUNIT * 6;

/** Hitscan range (p_local.h — MISSILERANGE). */
export const MISSILERANGE = 32 * 64 * FRACUNIT;

/** Frame flag — fullbright sprite (r_defs.h — FF_FULLBRIGHT). */
export const FF_FULLBRIGHT = 0x8000;
export const FF_FRAMEMASK = 0x7fff;

/** Sprite name prefixes (info.h — spritenum_t order). */
export const SPRITE_PREFIX = [
  'TROO', 'SHTG', 'PUNG', 'PISG', 'PISF', 'SHTF', 'SHT2', 'CHGG', 'CHGF',
  'MISG', 'MISF', 'SAWG', 'PLSG', 'PLSF', 'BFGG', 'BFGF',
];

/** State indices (info.h — subset used by pistol). */
export const S_NULL = 0;
export const S_LIGHTDONE = 1;
export const S_PISTOL = 10;
export const S_PISTOLDOWN = 11;
export const S_PISTOLUP = 12;
export const S_PISTOL1 = 13;
export const S_PISTOL2 = 14;
export const S_PISTOL3 = 15;
export const S_PISTOL4 = 16;
export const S_PISTOLFLASH = 17;

/**
 * @typedef {Object} WeaponState
 * @property {number} sprite SPR_* index
 * @property {number} frame Frame index (may include FF_FULLBRIGHT)
 * @property {number} tics Duration in tics; 0 runs action every tic
 * @property {string|null} action Action function name
 * @property {number} nextState
 */

/** @type {WeaponState[]} */
export const WEAPON_STATES = [];

function addState(sprite, frame, tics, action, nextState) {
  WEAPON_STATES.push({ sprite, frame, tics, action, nextState });
}

// S_NULL, S_LIGHTDONE — placeholders for indices 0–1
addState(0, 0, -1, null, S_NULL);
addState(1, 4, 0, 'Light0', S_NULL);

addState(0, 0, 0, null, S_NULL); // S_PUNCH — unused indices 2–9 (8 states)
addState(0, 0, 0, null, S_NULL);
addState(0, 0, 0, null, S_NULL);
addState(0, 0, 0, null, S_NULL);
addState(0, 0, 0, null, S_NULL);
addState(0, 0, 0, null, S_NULL);
addState(0, 0, 0, null, S_NULL);
addState(0, 0, 0, null, S_NULL);

// Pistol chain (indices 10–17, info.c)
addState(3, 0, 1, 'WeaponReady', S_PISTOL);             // S_PISTOL
addState(3, 0, 1, 'Lower', S_PISTOLDOWN);                 // S_PISTOLDOWN
addState(3, 0, 1, 'Raise', S_PISTOLUP);                   // S_PISTOLUP
addState(3, 0, 4, null, S_PISTOL2);                     // S_PISTOL1
addState(3, 1, 6, 'FirePistol', S_PISTOL3);             // S_PISTOL2
addState(3, 2, 4, null, S_PISTOL4);                     // S_PISTOL3
addState(3, 1, 5, 'ReFire', S_PISTOL);                  // S_PISTOL4
addState(4, FF_FULLBRIGHT, 7, 'Light1', S_LIGHTDONE);   // S_PISTOLFLASH

/** @type {{ ammo: number, upstate: number, downstate: number, readystate: number, atkstate: number, flashstate: number }[]} */
export const WEAPON_INFO = [
  {
    ammo: AM_NOAMMO,
    upstate: S_NULL,
    downstate: S_NULL,
    readystate: S_NULL,
    atkstate: S_NULL,
    flashstate: S_NULL,
  },
  {
    ammo: AM_CLIP,
    upstate: S_PISTOLUP,
    downstate: S_PISTOLDOWN,
    readystate: S_PISTOL,
    atkstate: S_PISTOL1,
    flashstate: S_PISTOLFLASH,
  },
];

/** @param {number} sprite @param {number} frame */
export function spriteLumpName(sprite, frame) {
  const prefix = SPRITE_PREFIX[sprite];
  const letter = String.fromCharCode('A'.charCodeAt(0) + (frame & FF_FRAMEMASK));
  return `${prefix}${letter}0`;
}
