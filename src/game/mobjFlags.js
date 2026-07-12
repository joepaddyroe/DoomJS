/** Mobj flags (p_mobj.h). */
export const MF_SPECIAL = 1;
export const MF_SOLID = 2;
export const MF_SHOOTABLE = 4;
export const MF_COUNTITEM = 0x80;
export const MF_NOBLOOD = 0x200;
export const MF_COUNTKILL = 0x400;
export const MF_CORPSE = 0x20000;
export const MF_DROPOFF = 1 << 25;
export const MF_JUSTHIT = 1 << 26;
export const MF_JUSTATTACKED = 1 << 27;
export const MF_PICKUP = 0x800;
/** p_mobj.h — deaf monsters need LOS even for sound alerts */
export const MF_AMBUSH = 32;
export const MF_MISSILE = 0x10000;
export const MF_NOGRAVITY = 1 << 5;
