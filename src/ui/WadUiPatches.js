import { PatchRenderer } from '../render/PatchRenderer.js';
import { SCREENWIDTH } from '../core/renderConstants.js';
import { TICRATE } from '../core/gameConstants.js';

/**
 * First source column when a patch is wider than the screen (st_stuff.c — STBAR).
 * @param {number} patchWidth
 * @returns {number}
 */
function centeredSourceColumn(patchWidth) {
  if (patchWidth <= SCREENWIDTH) {
    return 0;
  }
  return (patchWidth - SCREENWIDTH) >> 1;
}

/**
 * Draw a full-screen UI patch (TITLEPIC, HELP*, etc.).
 * Wide 426px lumps are center-cropped to 320px like the status bar source window.
 * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
 * @param {{ header: import('../render/PatchRenderer.js').PatchHeader, data: Uint8Array }} patch
 */
export function drawFullScreenPatch(renderer, patch) {
  const { header, data } = patch;
  if (header.width > SCREENWIDTH) {
    renderer.drawPatchSlice(0, 0, header, data, centeredSourceColumn(header.width), SCREENWIDTH);
    return;
  }
  renderer.drawPatch(0, 0, header, data);
}

/**
 * @param {import('../wad/WadFile.js').WadFile} wad
 * @param {string} name
 * @returns {{ header: import('../render/PatchRenderer.js').PatchHeader, data: Uint8Array }}
 */
export function loadUiPatch(wad, name) {
  return PatchRenderer.parsePatch(wad.readLumpByName(name));
}

/** Episode map pointer positions from wi_stuff.c (lnodes). */
export const EPISODE_MAP_NODES = [
  [
    { x: 185, y: 164 },
    { x: 148, y: 143 },
    { x: 69, y: 122 },
    { x: 209, y: 102 },
    { x: 116, y: 89 },
    { x: 166, y: 55 },
    { x: 71, y: 56 },
    { x: 135, y: 29 },
    { x: 71, y: 24 },
  ],
  [
    { x: 254, y: 25 },
    { x: 97, y: 50 },
    { x: 188, y: 64 },
    { x: 128, y: 78 },
    { x: 214, y: 92 },
    { x: 133, y: 130 },
    { x: 208, y: 136 },
    { x: 148, y: 140 },
    { x: 235, y: 158 },
  ],
  [
    { x: 156, y: 168 },
    { x: 48, y: 154 },
    { x: 174, y: 95 },
    { x: 265, y: 75 },
    { x: 130, y: 48 },
    { x: 279, y: 23 },
    { x: 198, y: 48 },
    { x: 140, y: 25 },
    { x: 281, y: 136 },
  ],
];

/** E1 episode map animation defs (epsd0animinfo). */
const EPISODE0_ANIMS = [
  { period: TICRATE / 3, frames: 3, x: 224, y: 104 },
  { period: TICRATE / 3, frames: 3, x: 184, y: 160 },
  { period: TICRATE / 3, frames: 3, x: 112, y: 136 },
  { period: TICRATE / 3, frames: 3, x: 72, y: 112 },
  { period: TICRATE / 3, frames: 3, x: 88, y: 96 },
  { period: TICRATE / 3, frames: 3, x: 64, y: 48 },
  { period: TICRATE / 3, frames: 3, x: 192, y: 40 },
  { period: TICRATE / 3, frames: 3, x: 136, y: 16 },
  { period: TICRATE / 3, frames: 3, x: 80, y: 16 },
  { period: TICRATE / 3, frames: 3, x: 64, y: 24 },
];

/**
 * @param {string} mapName e.g. E1M1
 * @returns {{ epsd: number, map: number }|null}
 */
export function parseEpisodeMap(mapName) {
  const match = /^E(\d)M(\d)$/i.exec(mapName);
  if (!match) {
    return null;
  }
  return { epsd: Number(match[1]) - 1, map: Number(match[2]) - 1 };
}

/**
 * @param {import('../wad/WadFile.js').WadFile} wad
 * @param {number} epsd
 * @returns {Array<Array<{ header: import('../render/PatchRenderer.js').PatchHeader, data: Uint8Array }>>}
 */
function loadEpisode0Animations(wad, epsd) {
  if (epsd !== 0) {
    return [];
  }

  return EPISODE0_ANIMS.map((anim, animIndex) => {
    const frames = [];
    for (let frame = 0; frame < anim.frames; frame++) {
      frames.push(loadUiPatch(wad, `WIA${epsd}${String(animIndex).padStart(2, '0')}${String(frame).padStart(2, '0')}`));
    }
    return frames;
  });
}

/**
 * @param {import('../wad/WadFile.js').WadFile} wad
 * @param {string} name
 * @returns {{ header: import('../render/PatchRenderer.js').PatchHeader, data: Uint8Array }|null}
 */
function tryLoadUiPatch(wad, name) {
  if (wad.indexOf(name) < 0) {
    return null;
  }
  return loadUiPatch(wad, name);
}

/**
 * Vanilla menu patches (m_menu.c).
 */
export class MenuPatches {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    this.titlePic = loadUiPatch(wad, 'TITLEPIC');
    this.doomLogo = tryLoadUiPatch(wad, 'M_DOOM');
    this.newGame = loadUiPatch(wad, 'M_NEWG');
    this.chooseSkill = loadUiPatch(wad, 'M_SKILL');
    this.episodeTitle = tryLoadUiPatch(wad, 'M_EPISOD');
    this.optionsTitle = tryLoadUiPatch(wad, 'M_OPTTTL');
    this.soundTitle = tryLoadUiPatch(wad, 'M_SVOL');
    this.loadTitle = tryLoadUiPatch(wad, 'M_LOADG');
    this.saveTitle = tryLoadUiPatch(wad, 'M_SAVEG');
    this.skills = [
      loadUiPatch(wad, 'M_JKILL'),
      loadUiPatch(wad, 'M_ROUGH'),
      loadUiPatch(wad, 'M_HURT'),
      loadUiPatch(wad, 'M_ULTRA'),
      tryLoadUiPatch(wad, 'M_NMARE'),
    ].filter((patch) => patch !== null);
    this.episodes = [
      tryLoadUiPatch(wad, 'M_EPI1'),
      tryLoadUiPatch(wad, 'M_EPI2'),
      tryLoadUiPatch(wad, 'M_EPI3'),
      tryLoadUiPatch(wad, 'M_EPI4'),
    ].filter((patch) => patch !== null);
    this.mainItems = {
      M_NGAME: tryLoadUiPatch(wad, 'M_NGAME'),
      M_OPTION: tryLoadUiPatch(wad, 'M_OPTION'),
      M_LOADG: tryLoadUiPatch(wad, 'M_LOADG'),
      M_SAVEG: tryLoadUiPatch(wad, 'M_SAVEG'),
      M_RDTHIS: tryLoadUiPatch(wad, 'M_RDTHIS'),
      M_QUITG: tryLoadUiPatch(wad, 'M_QUITG'),
    };
    this.optionItems = [
      tryLoadUiPatch(wad, 'M_ENDGAM'),
      tryLoadUiPatch(wad, 'M_MESSG'),
      tryLoadUiPatch(wad, 'M_DETAIL'),
      tryLoadUiPatch(wad, 'M_SCRNSZ'),
      tryLoadUiPatch(wad, 'M_MSENS'),
      tryLoadUiPatch(wad, 'M_SVOL'),
    ].filter((patch) => patch !== null);
    this.soundItems = [
      tryLoadUiPatch(wad, 'M_SFXVOL'),
      tryLoadUiPatch(wad, 'M_MUSVOL'),
    ].filter((patch) => patch !== null);
    this.detailHigh = tryLoadUiPatch(wad, 'M_GDHIGH');
    this.detailLow = tryLoadUiPatch(wad, 'M_GDLOW');
    this.msgOn = tryLoadUiPatch(wad, 'M_MSGON');
    this.msgOff = tryLoadUiPatch(wad, 'M_MSGOFF');
    this.skulls = [
      loadUiPatch(wad, 'M_SKULL1'),
      loadUiPatch(wad, 'M_SKULL2'),
    ];
    this.thermoLeft = tryLoadUiPatch(wad, 'M_THERML');
    this.thermoMid = tryLoadUiPatch(wad, 'M_THERMM');
    this.thermoRight = tryLoadUiPatch(wad, 'M_THERMR');
    this.thermoDot = tryLoadUiPatch(wad, 'M_THERMO');
    this.saveBorderLeft = tryLoadUiPatch(wad, 'M_LSLEFT');
    this.saveBorderMid = tryLoadUiPatch(wad, 'M_LSCNTR');
    this.saveBorderRight = tryLoadUiPatch(wad, 'M_LSRGHT');
    this.help1 = tryLoadUiPatch(wad, 'HELP1');
    this.help2 = tryLoadUiPatch(wad, 'HELP2');
    this.help = tryLoadUiPatch(wad, 'HELP');
    this.credit = tryLoadUiPatch(wad, 'CREDIT');

    /** @type {Record<string, { header: import('../render/PatchRenderer.js').PatchHeader, data: Uint8Array }>} */
    this.patchByName = {};
    const registerPatch = (name, patch) => {
      if (patch) {
        this.patchByName[name] = patch;
      }
    };
    for (const [name, patch] of Object.entries(this.mainItems)) {
      registerPatch(name, patch);
    }
    for (const name of [
      'M_ENDGAM', 'M_MESSG', 'M_DETAIL', 'M_SCRNSZ', 'M_MSENS', 'M_SVOL',
      'M_SFXVOL', 'M_MUSVOL', 'M_EPI1', 'M_EPI2', 'M_EPI3', 'M_EPI4',
      'M_JKILL', 'M_ROUGH', 'M_HURT', 'M_ULTRA', 'M_NMARE',
    ]) {
      registerPatch(name, tryLoadUiPatch(wad, name));
    }
  }

  /** @param {string} name */
  getPatch(name) {
    return this.patchByName[name] ?? null;
  }
}

/**
 * Intermission map screen patches (wi_stuff.c subset).
 */
export class IntermissionPatches {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {number} epsd
   * @param {number} map
   */
  constructor(wad, epsd, map) {
    this.epsd = epsd;
    this.map = map;
    this.background = loadUiPatch(wad, `WIMAP${epsd}`);
    this.entering = loadUiPatch(wad, 'WIENTER');
    this.levelName = loadUiPatch(wad, `WILV${epsd}${map}`);
    this.pointer = [
      loadUiPatch(wad, 'WIURH0'),
      loadUiPatch(wad, 'WIURH1'),
    ];
    this.animDefs = epsd === 0 ? EPISODE0_ANIMS : [];
    this.animFrames = loadEpisode0Animations(wad, epsd);
    /** @type {number[]} */
    this.animCounters = this.animDefs.map(() => 0);
    /** @type {number[]} */
    this.animNextTic = this.animDefs.map((anim, index) => index + 1);
  }

  /** @param {number} tic */
  tickAnimations(tic) {
    for (let i = 0; i < this.animDefs.length; i++) {
      if (tic !== this.animNextTic[i]) {
        continue;
      }
      const anim = this.animDefs[i];
      this.animCounters[i] = (this.animCounters[i] + 1) % anim.frames;
      this.animNextTic[i] = tic + anim.period;
    }
  }
}
