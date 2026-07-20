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
  plpain: 'DSPLPAIN',
  noway: 'DSNOWAY',
  // Menu (m_menu.c)
  pstop: 'DSPSTOP',
  swtchn: 'DSSWTCHN',
  swtchx: 'DSSWTCHX',
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
  // Demon / spectre
  sgtsit: 'DSSGTSIT',
  sgtatk: 'DSSGTATK',
  sgtdth: 'DSSGTDTH',
  dmpain: 'DSDMPAIN',
  dmact: 'DSDMACT',
  // Cacodemon / baron / lost soul
  cacsit: 'DSCACSIT',
  cacdth: 'DSCACDTH',
  brssit: 'DSBRSSIT',
  brsdth: 'DSBRSDTH',
  sklatk: 'DSSKLATK',
  // Bosses
  spisit: 'DSSPISIT',
  spidth: 'DSSPIDTH',
  cybsit: 'DSCYBSIT',
  cybdth: 'DSCYBDTH',
  hoof: 'DSHOOF',
  metal: 'DSMETAL',
  // Barrel / gib / fireball
  barexp: 'DSBAREXP',
  slop: 'DSSLOP',
  firsht: 'DSFIRSHT',
  firxpl: 'DSFIRXPL',
  rlaunc: 'DSRLAUNC',
  plasma: 'DSPLASMA',
  bfg: 'DSBFG',
  rxplod: 'DSRXPLOD',
  sawful: 'DSSAWFUL',
  sawhit: 'DSSAWHIT',
  pldeth: 'DSPLDETH',
};

/** @type {readonly string[]} */
export const PRELOAD_SFX = Object.keys(SFX_LUMPS);

/** sounds.c nominal volumes (0–127), applied on top of the SFX volume slider. */
export const SFX_VOLUME = {
  plpain: 96 / 127,
};
