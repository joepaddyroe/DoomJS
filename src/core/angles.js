/** Binary angle constants (tables.h / r_main.c). */

export const FINEANGLES = 8192;
export const FINEMASK = FINEANGLES - 1;
export const ANGLETOFINESHIFT = 19;
export const ANG45 = 0x20000000;
export const ANG90 = 0x40000000;
export const ANG180 = 0x80000000;
export const ANG270 = 0xc0000000;

export const FIELDOFVIEW = 2048;
export const NF_SUBSECTOR = 0x8000;

export const SLOPERANGE = 2048;
export const SLOPEBITS = 11;
export const DBITS = 16 - SLOPEBITS;

export const BOXTOP = 0;
export const BOXBOTTOM = 1;
export const BOXLEFT = 2;
export const BOXRIGHT = 3;

export const LIGHTLEVELS = 16;
export const LIGHTSEGSHIFT = 4;
export const MAXLIGHTSCALE = 48;
export const LIGHTSCALESHIFT = 12;
export const MAXLIGHTZ = 128;
export const LIGHTZSHIFT = 20;
export const NUMCOLORMAPS = 32;

export const HEIGHTBITS = 12;
export const HEIGHTUNIT = 1 << HEIGHTBITS;

export const SIL_NONE = 0;
export const SIL_BOTTOM = 1;
export const SIL_TOP = 2;
export const SIL_BOTH = 3;

export const ML_TWOSIDED = 4;
export const ML_DONTPEGTOP = 8;
export const ML_DONTPEGBOTTOM = 16;
export const ML_MAPPED = 256;

/** @param {number} angle BAM angle (unsigned 32-bit). @returns {number} finesine/finecosine index. */
export function fineAngleIndex(angle) {
  return (angle >>> ANGLETOFINESHIFT) & FINEMASK;
}

/** @param {number} angle BAM angle (unsigned 32-bit). @returns {number} finetangent index (4096 entries). */
export function tangentAngleIndex(angle) {
  const index = angle >>> ANGLETOFINESHIFT;
  return index >= FINEANGLES / 2 ? (FINEANGLES / 2) - 1 : index;
}

/** @param {number} degrees Map thing angle in degrees. @returns {number} BAM angle. */
export function angleFromDegrees(degrees) {
  return Math.imul(ANG45, (degrees / 45) | 0) >>> 0;
}
