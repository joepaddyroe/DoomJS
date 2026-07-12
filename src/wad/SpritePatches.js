import { PatchRenderer } from '../render/PatchRenderer.js';
import { FF_FRAMEMASK, PS_FLASH, PS_WEAPON, WEAPON_STATES, spriteLumpName } from '../game/weapons/weaponConstants.js';
import { FRACBITS, FRACUNIT, SCREENWIDTH } from '../core/renderConstants.js';
import { SpriteRotationTable } from './SpriteRotationTable.js';

/**
 * @param {string} spritePrefix
 * @param {number} frame
 * @param {boolean} [fullbright=false]
 * @param {number} [rotation=-1] 0–7 for rotating sprites; -1 uses non-directional "0" suffix
 */
export function mapSpriteLumpName(spritePrefix, frame, fullbright = false, rotation = -1) {
  const letter = String.fromCharCode('A'.charCodeAt(0) + (frame & FF_FRAMEMASK));
  const rotSuffix = rotation < 0 ? '0' : String((rotation & 7) + 1);
  return `${spritePrefix}${letter}${rotSuffix}`;
}

/**
 * Weapon patch loader — reads sprite lumps from the WAD (e.g. PISGA0).
 */
export class SpritePatches {
  /**
   * @param {import('./WadFile.js').WadFile} wad
   */
  constructor(wad) {
    this.wad = wad;
    this.rotations = new SpriteRotationTable(wad);
    /** @type {Map<string, { header: import('../render/PatchRenderer.js').PatchHeader, data: Uint8Array }>} */
    this.cache = new Map();
  }

  /**
   * @param {number} sprite
   * @param {number} frame
   */
  getPatch(sprite, frame) {
    const name = spriteLumpName(sprite, frame & FF_FRAMEMASK);
    return this.getPatchByName(name);
  }

  /**
   * @param {string} name Lump name (e.g. COLUA0, SHOTA0)
   */
  getPatchByName(name) {
    let patch = this.cache.get(name);
    if (!patch) {
      const data = this.wad.readLumpByName(name);
      patch = PatchRenderer.parsePatch(data);
      this.cache.set(name, patch);
    }
    return patch;
  }

  /**
   * Resolve a world sprite with optional 8-way rotation (r_things.c).
   * @param {string} spritePrefix
   * @param {number} frame
   * @param {number} [rotation=0] 0–7
   * @returns {{ patch: { header: import('../render/PatchRenderer.js').PatchHeader, data: Uint8Array }, flip: boolean }|null}
   */
  getWorldSprite(spritePrefix, frame, rotation = 0) {
    const resolved = this.rotations.resolve(spritePrefix, frame, rotation);
    if (resolved) {
      return { patch: this.getPatchByName(resolved.lumpName), flip: resolved.flip };
    }

    const letter = String.fromCharCode('A'.charCodeAt(0) + (frame & FF_FRAMEMASK));
    const flatName = `${spritePrefix}${letter}0`;
    try {
      return { patch: this.getPatchByName(flatName), flip: false };
    } catch {
      return null;
    }
  }
}

/**
 * Draw player weapon sprites over the 3D view (r_things.c — R_DrawPSprite).
 */
export class PspriteRenderer {
  /**
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {SpritePatches} sprites
   * @param {Uint8Array} colormaps
   */
  constructor(renderer, sprites, colormaps) {
    this.renderer = renderer;
    this.sprites = sprites;
    this.colormaps = colormaps;
  }

  /**
   * @param {import('../game/Player.js').Player} player
   * @param {number} extralight
   */
  draw(player, extralight) {
    const lightIndex = Math.min(31, 16 + extralight);
    const colormap = this.colormaps.subarray(lightIndex * 256, (lightIndex + 1) * 256);
    const fullbright = this.colormaps.subarray(0, 256);

    for (const slot of [PS_WEAPON, PS_FLASH]) {
      const psp = player.psprites[slot];
      if (psp.state === null) {
        continue;
      }

      const state = WEAPON_STATES[psp.state];
      const patch = this.sprites.getPatch(state.sprite, state.frame);
      const useFullbright = (state.frame & 0x8000) !== 0;

      // r_things.c — R_DrawPSprite (1:1 scale): tx = psp->sx - 160*FRACUNIT, sy via patch offsets in drawPatch.
      const screenX = (SCREENWIDTH >> 1) + ((psp.sx - (160 << FRACBITS)) >> FRACBITS);
      const screenY = psp.sy >> FRACBITS;

      this.renderer.drawPatch(
        screenX,
        screenY,
        patch.header,
        patch.data,
        useFullbright ? fullbright : colormap,
      );
    }
  }
}
