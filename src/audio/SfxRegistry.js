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
  // Menu (m_menu.c)
  pstop: 'DSPSTOP',
  swtchn: 'DSWTCHN',
  swtchx: 'DSWTCHX',
  stnmov: 'DSTNMOV',
  doropn: 'DSDOROPN',
  dorcls: 'DSDORCLS',
  // Zombieman / shotgun guy
  posit1: 'DSPOSIT1',
  posit2: 'DSPOSIT2',
  posit3: 'DSPOSIT3',
  popain: 'DSPOPAIN',
  podth1: 'DSPODTH1',
  podth2: 'DSPODTH2',
  podth3: 'DSPODTH3',
  posact: 'DSPOSACT',
  // Imp
  bgsit1: 'DSBGSIT1',
  bgsit2: 'DSBGSIT2',
  bgdth1: 'DSBGDTH1',
  bgdth2: 'DSBGDTH2',
  bgact: 'DSBGACT',
  claw: 'DSCLAW',
  punch: 'DSPUNCH',
  // Barrel / gib / fireball
  barexp: 'DSBAREXP',
  slop: 'DSSLOP',
  firsht: 'DSFIRSHT',
  firxpl: 'DSFIRXPL',
  pldeth: 'DSPLDETH',
};

/** @type {readonly string[]} */
export const PRELOAD_SFX = Object.keys(SFX_LUMPS);
