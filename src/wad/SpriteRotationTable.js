import { FF_FRAMEMASK } from '../game/weapons/weaponConstants.js';

/**
 * @typedef {{ lumpName: string, flip: boolean }} SpriteRotationEntry
 */

/**
 * Maps sprite frame + view rotation to WAD lump names (r_things.c — R_InitSpriteDefs).
 * Handles paired lumps like POSSA2A8 (rotation 2 normal, rotation 8 flipped).
 */
export class SpriteRotationTable {
  /**
   * @param {import('./WadFile.js').WadFile} wad
   */
  constructor(wad) {
    /** @type {Map<string, (SpriteRotationEntry|null)[]>} */
    this.frames = new Map();
    this._build(wad);
  }

  /** @param {import('./WadFile.js').WadFile} wad */
  _build(wad) {
    for (const lump of wad.lumps) {
      const name = lump.name;
      if (name.length < 6) {
        continue;
      }

      const base = name.slice(0, 5);
      const rot1 = name.charCodeAt(5) - 48;
      if (rot1 < 0 || rot1 > 9) {
        continue;
      }

      if (!this.frames.has(base)) {
        this.frames.set(base, new Array(8).fill(null));
      }
      const slots = this.frames.get(base);

      if (rot1 === 0) {
        const entry = { lumpName: name, flip: false };
        for (let i = 0; i < 8; i++) {
          slots[i] = entry;
        }
        continue;
      }

      slots[rot1 - 1] = { lumpName: name, flip: false };

      if (name.length >= 8) {
        const rot2 = name.charCodeAt(7) - 48;
        if (rot2 >= 1 && rot2 <= 8) {
          slots[rot2 - 1] = { lumpName: name, flip: true };
        }
      }
    }
  }

  /**
   * @param {string} spritePrefix
   * @param {number} frame
   * @param {number} rotation 0–7 (r_things.c — R_ProjectSprite)
   * @returns {SpriteRotationEntry|null}
   */
  resolve(spritePrefix, frame, rotation) {
    const letter = String.fromCharCode('A'.charCodeAt(0) + (frame & FF_FRAMEMASK));
    const slots = this.frames.get(spritePrefix + letter);
    if (!slots) {
      return null;
    }
    return slots[rotation & 7] ?? slots[0];
  }
}
