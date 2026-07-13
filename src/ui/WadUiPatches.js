import { PatchRenderer } from '../render/PatchRenderer.js';
import { TICRATE } from '../core/gameConstants.js';

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
 * Vanilla menu patches (m_menu.c — NewDef / M_DrawNewGame).
 */
export class MenuPatches {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    this.newGame = loadUiPatch(wad, 'M_NEWG');
    this.chooseSkill = loadUiPatch(wad, 'M_SKILL');
    this.skills = [
      loadUiPatch(wad, 'M_JKILL'),
      loadUiPatch(wad, 'M_ROUGH'),
      loadUiPatch(wad, 'M_HURT'),
      loadUiPatch(wad, 'M_ULTRA'),
    ];
    this.skulls = [
      loadUiPatch(wad, 'M_SKULL1'),
      loadUiPatch(wad, 'M_SKULL2'),
    ];
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
