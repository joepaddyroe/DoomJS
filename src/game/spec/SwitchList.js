/**
 * Switch texture pairs (p_switch.c — alphSwitchList + P_ChangeSwitchTexture).
 */

/** @type {readonly [string, string][]} */
const ALPH_SWITCH_LIST = [
  ['SW1BRCOM', 'SW2BRCOM'],
  ['SW1BRN1', 'SW2BRN1'],
  ['SW1BRN2', 'SW2BRN2'],
  ['SW1BRNGN', 'SW2BRNGN'],
  ['SW1BROWN', 'SW2BROWN'],
  ['SW1COMM', 'SW2COMM'],
  ['SW1COMP', 'SW2COMP'],
  ['SW1DIRT', 'SW2DIRT'],
  ['SW1EXIT', 'SW2EXIT'],
  ['SW1GRAY', 'SW2GRAY'],
  ['SW1GRAY1', 'SW2GRAY1'],
  ['SW1METAL', 'SW2METAL'],
  ['SW1PIPE', 'SW2PIPE'],
  ['SW1SLAD', 'SW2SLAD'],
  ['SW1STARG', 'SW2STARG'],
  ['SW1STON1', 'SW2STON1'],
  ['SW1STON2', 'SW2STON2'],
  ['SW1STONE', 'SW2STONE'],
  ['SW1STRTN', 'SW2STRTN'],
  ['SW1BLUE', 'SW2BLUE'],
  ['SW1CMT', 'SW2CMT'],
  ['SW1GARG', 'SW2GARG'],
  ['SW1GSTON', 'SW2GSTON'],
  ['SW1HOT', 'SW2HOT'],
  ['SW1LION', 'SW2LION'],
  ['SW1SATYR', 'SW2SATYR'],
  ['SW1SKIN', 'SW2SKIN'],
  ['SW1VINE', 'SW2VINE'],
  ['SW1WOOD', 'SW2WOOD'],
];

/**
 * @param {import('../../render/TextureManager.js').TextureManager} textures
 * @returns {Map<number, number>}
 */
export function buildSwitchPairs(textures) {
  /** @type {Map<number, number>} */
  const pairs = new Map();

  for (const [a, b] of ALPH_SWITCH_LIST) {
    const indexA = textures.textureNameToIndex.get(a);
    const indexB = textures.textureNameToIndex.get(b);
    if (indexA !== undefined && indexB !== undefined) {
      pairs.set(indexA, indexB);
      pairs.set(indexB, indexA);
    }
  }

  return pairs;
}

/**
 * Flip a switch wall texture on the line front sidedef (p_switch.c).
 *
 * @param {import('../Level.js').LevelLine} line
 * @param {import('./Doors.js').SpecContext} ctx
 * @param {boolean} useAgain Retriggerable button — keep line.special.
 * @returns {boolean}
 */
export function changeSwitchTexture(line, ctx, useAgain) {
  if (!ctx.textures) {
    return false;
  }

  const switchSide = line.sideFront;
  if (!switchSide) {
    return false;
  }

  const slots = [
    switchSide.topTexture,
    switchSide.midTexture,
    switchSide.bottomTexture,
  ];
  const fields = ['topTexture', 'midTexture', 'bottomTexture'];

  for (let i = 0; i < slots.length; i++) {
    const texIndex = slots[i];
    if (!texIndex) {
      continue;
    }
    const pair = ctx.switchPairs.get(texIndex);
    if (!pair) {
      continue;
    }

    switchSide[fields[i]] = pair;

    if (!useAgain) {
      line.special = 0;
    }

    const sound = line.special === 11 || line.special === 51 ? 'swtchx' : 'swtchn';
    ctx.sound?.start(sound);
    return true;
  }

  return false;
}
