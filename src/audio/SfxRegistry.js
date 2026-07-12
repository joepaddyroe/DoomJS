/**
 * Logical sound names from sounds.c → WAD lump names (i_sound.c — getsfx).
 * Expand as more gameplay systems need audio.
 */
export const SFX_LUMPS = {
  pistol: 'DSPISTOL',
  shotgn: 'DSSHOTGN',
  sgcock: 'DSSGCOCK',
  itemup: 'DSITEMUP',
  wpnup: 'DSWPNUP',
  oof: 'DSOOF',
  noway: 'DSNOWAY',
  doropn: 'DSDOROPN',
  dorcls: 'DSDORCLS',
};

/** @type {readonly string[]} */
export const PRELOAD_SFX = Object.keys(SFX_LUMPS);
