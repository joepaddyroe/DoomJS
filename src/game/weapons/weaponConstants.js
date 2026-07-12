import { FRACUNIT } from '../../core/renderConstants.js';

/** Weapon types (doomdef.h). */
export const WP_FIST = 0;
export const WP_PISTOL = 1;
export const WP_SHOTGUN = 2;
export const NUM_WEAPONS = 3;

export const WP_NOCHANGE = -1;

/** Ammo types (doomdef.h). */
export const AM_CLIP = 0;
export const AM_SHELL = 1;
export const AM_CELL = 2;
export const AM_MISL = 3;
export const AM_NOAMMO = -1;
export const NUM_AMMO = 4;

/** Default max ammo (p_inter.c). */
export const MAX_AMMO = [200, 50, 300, 50];

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

/** Sprite name prefixes (info.h — spritenum_t order through SPR_PUFF). */
export const SPRITE_PREFIX = [
  'TROO', 'SHTG', 'PUNG', 'PISG', 'PISF', 'SHTF', 'SHT2', 'CHGG', 'CHGF',
  'MISG', 'MISF', 'SAWG', 'PLSG', 'PLSF', 'BFGG', 'BFGF', 'BLUD', 'PUFF',
];

export const SPR_PUFF = 17;

/** State indices (info.h). */
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
export const S_SGUN = 18;
export const S_SGUNDOWN = 19;
export const S_SGUNUP = 20;
export const S_SGUN1 = 21;
export const S_SGUN2 = 22;
export const S_SGUN3 = 23;
export const S_SGUN4 = 24;
export const S_SGUN5 = 25;
export const S_SGUN6 = 26;
export const S_SGUN7 = 27;
export const S_SGUN8 = 28;
export const S_SGUN9 = 29;
export const S_SGUNFLASH1 = 30;
export const S_SGUNFLASH2 = 31;

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

// S_NULL, S_LIGHTDONE
addState(0, 0, -1, null, S_NULL);
addState(1, 4, 0, 'Light0', S_NULL);

// S_PUNCH placeholders (indices 2–9)
for (let i = 0; i < 8; i++) {
  addState(0, 0, 0, null, S_NULL);
}

// Pistol (10–17)
addState(3, 0, 1, 'WeaponReady', S_PISTOL);
addState(3, 0, 1, 'Lower', S_PISTOLDOWN);
addState(3, 0, 1, 'Raise', S_PISTOLUP);
addState(3, 0, 4, null, S_PISTOL2);
addState(3, 1, 6, 'FirePistol', S_PISTOL3);
addState(3, 2, 4, null, S_PISTOL4);
addState(3, 1, 5, 'ReFire', S_PISTOL);
addState(4, FF_FULLBRIGHT, 7, 'Light1', S_LIGHTDONE);

// Shotgun (18–31)
addState(1, 0, 1, 'WeaponReady', S_SGUN);
addState(1, 0, 1, 'Lower', S_SGUNDOWN);
addState(1, 0, 1, 'Raise', S_SGUNUP);
addState(1, 0, 3, null, S_SGUN2);
addState(1, 0, 7, 'FireShotgun', S_SGUN3);
addState(1, 1, 5, null, S_SGUN4);
addState(1, 2, 5, null, S_SGUN5);
addState(1, 3, 4, null, S_SGUN6);
addState(1, 2, 5, null, S_SGUN7);
addState(1, 1, 5, null, S_SGUN8);
addState(1, 0, 3, null, S_SGUN9);
addState(1, 0, 7, 'ReFire', S_SGUN);
addState(5, FF_FULLBRIGHT, 4, 'Light1', S_SGUNFLASH2);
addState(5, FF_FULLBRIGHT | 1, 3, 'Light2', S_LIGHTDONE);

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
  {
    ammo: AM_SHELL,
    upstate: S_SGUNUP,
    downstate: S_SGUNDOWN,
    readystate: S_SGUN,
    atkstate: S_SGUN1,
    flashstate: S_SGUNFLASH1,
  },
];

/** @param {number} sprite @param {number} frame */
export function spriteLumpName(sprite, frame) {
  const prefix = SPRITE_PREFIX[sprite];
  const letter = String.fromCharCode('A'.charCodeAt(0) + (frame & FF_FRAMEMASK));
  return `${prefix}${letter}0`;
}
