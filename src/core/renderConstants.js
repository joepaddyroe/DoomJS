/**
 * Screen and fixed-point constants from doomdef.h / m_fixed.h / r_draw.c.
 */

export const SCREENWIDTH = 320;
export const SCREENHEIGHT = 200;
export const SBARHEIGHT = 32;

export const FRACBITS = 16;
export const FRACUNIT = 1 << FRACBITS;

/** Wall textures are 128 texels tall; index wraps with & 127. */
export const MAX_TEXTURE_HEIGHT = 128;

/** Flat (floor/ceiling) textures are 64×64. */
export const FLAT_SIZE = 64;
export const FLAT_MASK = 63;
/** Row stride mask for flat spot calc: (yfrac>>10) & FLAT_ROWMASK (r_draw.c). */
export const FLAT_ROWMASK = FLAT_MASK << 6;

export const CENTERY = SCREENHEIGHT / 2;
export const BASEYCENTER = 100;
