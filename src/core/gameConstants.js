import { FRACBITS, FRACUNIT } from './renderConstants.js';

/** Simulation rate (doomdef.h — TICRATE). */
export const TICRATE = 35;

/** Eye height above feet (p_local.h — VIEWHEIGHT). */
export const VIEWHEIGHT = 41 * FRACUNIT;

/** Player collision radius (p_local.h — PLAYERRADIUS). */
export const PLAYER_RADIUS = 16 * FRACUNIT;

/** Player height (doomdef.h — mobjinfo[MT_PLAYER].height). */
export const PLAYER_HEIGHT = 56 * FRACUNIT;

/** Max XY movement per step (p_local.h — MAXMOVE). */
export const MAXMOVE = 30 * FRACUNIT;

/** Ground friction (p_mobj.c). */
export const FRICTION = 0xe800;

/** Speed at which momentum zeroes (p_mobj.c). */
export const STOPSPEED = 0x1000;

/** Max step height (p_map.c). */
export const MAXSTEPHEIGHT = 24 * FRACUNIT;

/** Blockmap cell size (p_local.h). */
export const MAPBLOCKSHIFT = FRACBITS + 7;
export const MAPBLOCKSIZE = 1 << MAPBLOCKSHIFT;
export const MAPBTOFRAC = MAPBLOCKSHIFT - FRACBITS;

/** Line slope categories (p_setup.c). */
export const ST_HORIZONTAL = 0;
export const ST_VERTICAL = 1;
export const ST_POSITIVE = 2;
export const ST_NEGATIVE = 3;

/** Line flags (doomdef.h). */
export const ML_BLOCKING = 1;
export const ML_BLOCKMONSTERS = 2;

/** Mobj flags used by collision (doomdef.h). */
export const MF_NOCLIP = 1 << 6;
export const MF_TELEPORT = 1 << 14;
export const MF_DROPOFF = 1 << 25;

/** Keyboard movement speeds (g_game.c — forwardmove / sidemove). */
export const FORWARDMOVE = [0x19, 0x32];
export const SIDEMOVE = [0x18, 0x28];
export const ANGLETURN = [640, 1280, 320];

/** Thrust scale (p_user.c — cmd->forwardmove * 2048). */
export const THRUST_SCALE = 2048;

/** Path trace flags (p_maputl.c). */
export const PT_ADDLINES = 1;

/** Max intercepts per slide (p_local.h). */
export const MAXINTERCEPTS = 128;
