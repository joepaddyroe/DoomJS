import { FRACUNIT } from '../../core/renderConstants.js';

/** Weapon types (doomdef.h). */
export const WP_FIST = 0;
export const WP_PISTOL = 1;
export const WP_SHOTGUN = 2;
export const WP_CHAINGUN = 3;
export const WP_MISSILE = 4;
export const WP_PLASMA = 5;
export const WP_BFG = 6;
export const WP_CHAINSAW = 7;
export const NUM_WEAPONS = 8;

export const WP_NOCHANGE = -1;

/** Cells consumed per BFG shot (p_pspr.c). */
export const BFGCELLS = 40;

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
export const S_PUNCH = 2;
export const S_PUNCHDOWN = 3;
export const S_PUNCHUP = 4;
export const S_PUNCH1 = 5;
export const S_PUNCH2 = 6;
export const S_PUNCH3 = 7;
export const S_PUNCH4 = 8;
export const S_PUNCH5 = 9;
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
export const S_CHAIN = 32;
export const S_CHAINDOWN = 33;
export const S_CHAINUP = 34;
export const S_CHAIN1 = 35;
export const S_CHAIN2 = 36;
export const S_CHAIN3 = 37;
export const S_CHAINFLASH1 = 38;
export const S_CHAINFLASH2 = 39;
export const S_MISSILE = 40;
export const S_MISSILEDOWN = 41;
export const S_MISSILEUP = 42;
export const S_MISSILE1 = 43;
export const S_MISSILE2 = 44;
export const S_MISSILE3 = 45;
export const S_MISSILEFLASH1 = 46;
export const S_MISSILEFLASH2 = 47;
export const S_MISSILEFLASH3 = 48;
export const S_MISSILEFLASH4 = 49;
export const S_SAW = 50;
export const S_SAWB = 51;
export const S_SAWDOWN = 52;
export const S_SAWUP = 53;
export const S_SAW1 = 54;
export const S_SAW2 = 55;
export const S_SAW3 = 56;
export const S_PLASMA = 57;
export const S_PLASMADOWN = 58;
export const S_PLASMAUP = 59;
export const S_PLASMA1 = 60;
export const S_PLASMA2 = 61;
export const S_PLASMAFLASH1 = 62;
export const S_PLASMAFLASH2 = 63;
export const S_BFG = 64;
export const S_BFGDOWN = 65;
export const S_BFGUP = 66;
export const S_BFG1 = 67;
export const S_BFG2 = 68;
export const S_BFG3 = 69;
export const S_BFG4 = 70;
export const S_BFGFLASH1 = 71;
export const S_BFGFLASH2 = 72;

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

// Fist (2–9) — p_pspr.c S_PUNCH*
addState(2, 0, 1, 'WeaponReady', S_PUNCH);
addState(2, 0, 1, 'Lower', S_PUNCHDOWN);
addState(2, 0, 1, 'Raise', S_PUNCHUP);
addState(2, 1, 4, null, S_PUNCH2);
addState(2, 2, 4, 'FirePunch', S_PUNCH3);
addState(2, 3, 5, null, S_PUNCH4);
addState(2, 2, 4, null, S_PUNCH5);
addState(2, 1, 5, 'ReFire', S_PUNCH);

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

// Chaingun (32–39)
addState(7, 0, 1, 'WeaponReady', S_CHAIN);
addState(7, 0, 1, 'Lower', S_CHAINDOWN);
addState(7, 0, 1, 'Raise', S_CHAINUP);
addState(7, 0, 4, 'FireCGun', S_CHAIN2);
addState(7, 1, 4, 'FireCGun', S_CHAIN3);
addState(7, 1, 0, 'ReFire', S_CHAIN);
addState(8, FF_FULLBRIGHT, 5, 'Light1', S_LIGHTDONE);
addState(8, FF_FULLBRIGHT | 1, 5, 'Light2', S_LIGHTDONE);

// Rocket launcher (40–49)
addState(9, 0, 1, 'WeaponReady', S_MISSILE);
addState(9, 0, 1, 'Lower', S_MISSILEDOWN);
addState(9, 0, 1, 'Raise', S_MISSILEUP);
addState(9, 1, 8, 'GunFlash', S_MISSILE2);
addState(9, 1, 12, 'FireMissile', S_MISSILE3);
addState(9, 1, 0, 'ReFire', S_MISSILE);
addState(10, FF_FULLBRIGHT, 3, 'Light1', S_MISSILEFLASH2);
addState(10, FF_FULLBRIGHT | 1, 4, null, S_MISSILEFLASH3);
addState(10, FF_FULLBRIGHT | 2, 4, 'Light2', S_MISSILEFLASH4);
addState(10, FF_FULLBRIGHT | 3, 4, 'Light2', S_LIGHTDONE);

// Chainsaw (50–56)
addState(11, 2, 4, 'WeaponReady', S_SAWB);
addState(11, 3, 4, 'WeaponReady', S_SAW);
addState(11, 2, 1, 'Lower', S_SAWDOWN);
addState(11, 2, 1, 'Raise', S_SAWUP);
addState(11, 0, 4, 'Saw', S_SAW2);
addState(11, 1, 4, 'Saw', S_SAW3);
addState(11, 1, 0, 'ReFire', S_SAW);

// Plasma rifle (57–63)
addState(12, 0, 1, 'WeaponReady', S_PLASMA);
addState(12, 0, 1, 'Lower', S_PLASMADOWN);
addState(12, 0, 1, 'Raise', S_PLASMAUP);
addState(12, 0, 3, 'FirePlasma', S_PLASMA2);
addState(12, 1, 20, 'ReFire', S_PLASMA);
addState(13, FF_FULLBRIGHT, 4, 'Light1', S_LIGHTDONE);
addState(13, FF_FULLBRIGHT | 1, 4, 'Light1', S_LIGHTDONE);

// BFG (64–72)
addState(14, 0, 1, 'WeaponReady', S_BFG);
addState(14, 0, 1, 'Lower', S_BFGDOWN);
addState(14, 0, 1, 'Raise', S_BFGUP);
addState(14, 0, 20, 'BFGsound', S_BFG2);
addState(14, 1, 10, 'GunFlash', S_BFG3);
addState(14, 1, 10, 'FireBFG', S_BFG4);
addState(14, 1, 20, 'ReFire', S_BFG);
addState(15, FF_FULLBRIGHT, 11, 'Light1', S_BFGFLASH2);
addState(15, FF_FULLBRIGHT | 1, 6, 'Light2', S_LIGHTDONE);

/** @type {{ ammo: number, upstate: number, downstate: number, readystate: number, atkstate: number, flashstate: number }[]} */
export const WEAPON_INFO = [
  {
    ammo: AM_NOAMMO,
    upstate: S_PUNCHUP,
    downstate: S_PUNCHDOWN,
    readystate: S_PUNCH,
    atkstate: S_PUNCH1,
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
  {
    ammo: AM_CLIP,
    upstate: S_CHAINUP,
    downstate: S_CHAINDOWN,
    readystate: S_CHAIN,
    atkstate: S_CHAIN1,
    flashstate: S_CHAINFLASH1,
  },
  {
    ammo: AM_MISL,
    upstate: S_MISSILEUP,
    downstate: S_MISSILEDOWN,
    readystate: S_MISSILE,
    atkstate: S_MISSILE1,
    flashstate: S_MISSILEFLASH1,
  },
  {
    ammo: AM_CELL,
    upstate: S_PLASMAUP,
    downstate: S_PLASMADOWN,
    readystate: S_PLASMA,
    atkstate: S_PLASMA1,
    flashstate: S_PLASMAFLASH1,
  },
  {
    ammo: AM_CELL,
    upstate: S_BFGUP,
    downstate: S_BFGDOWN,
    readystate: S_BFG,
    atkstate: S_BFG1,
    flashstate: S_BFGFLASH1,
  },
  {
    ammo: AM_NOAMMO,
    upstate: S_SAWUP,
    downstate: S_SAWDOWN,
    readystate: S_SAW,
    atkstate: S_SAW1,
    flashstate: S_NULL,
  },
];

/** @param {number} sprite @param {number} frame */
export function spriteLumpName(sprite, frame) {
  const prefix = SPRITE_PREFIX[sprite];
  const letter = String.fromCharCode('A'.charCodeAt(0) + (frame & FF_FRAMEMASK));
  return `${prefix}${letter}0`;
}
