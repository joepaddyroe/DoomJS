import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { ANG45, fineAngleIndex } from '../core/angles.js';
import { fixedDiv, fixedMul } from '../math/fixed.js';
import { SPR_PUFF } from '../game/weapons/weaponConstants.js';
import { MF_SHADOW } from '../game/mobjFlags.js';
import { mapSpriteLumpName } from '../wad/SpritePatches.js';
import { computeSpriteClip, renderMaskedSegsBehindSprite } from './SpriteClipper.js';
import { pointToAngle } from '../math/viewMath.js';

/** Puff animation frames (info.c — S_PUFF1..S_PUFF4). */
const PUFF_TICS = [4, 4, 4, 4];

/** Vanilla r_things.c — MINZ: closer than this in view depth, sprite is not drawn. */
const SPRITE_MINZ = FRACUNIT * 4;

/**
 * r_things.c projects sprites without rejecting on screen Y; only columns are
 * clipped during draw.
 * @param {{ x1: number, x2: number, texturemid: number }} projected
 * @param {import('./PatchRenderer.js').PatchHeader} patch
 * @param {number} viewHeight
 * @param {number} viewWidth
 * @param {number} centerYFrac
 * @param {number} verticalScale
 */
function spriteIntersectsView(projected, patch, viewHeight, viewWidth, centerYFrac, verticalScale) {
  if (projected.x2 < 0 || projected.x1 >= viewWidth || verticalScale <= 0) {
    return false;
  }

  const topY = (centerYFrac - fixedMul(projected.texturemid, verticalScale)) >> FRACBITS;
  const bottomY = topY + ((patch.height * verticalScale) >> FRACBITS);
  return topY < viewHeight && bottomY >= 0;
}


/**
 * @typedef {Object} Puff
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} frame
 * @property {number} tics
 */

/**
 * Bullet puff effects (p_mobj.c — P_SpawnPuff).
 */
export class PuffManager {
  constructor() {
    /** @type {Puff[]} */
    this.puffs = [];
  }

  /** @param {number} x @param {number} y @param {number} z */
  spawn(x, y, z) {
    this.puffs.push({
      x,
      y,
      z: z + (((Math.random() * 2) | 0) - 1) * 1024,
      frame: 0,
      tics: Math.max(1, PUFF_TICS[0] - (Math.random() * 4 | 0)),
    });
  }

  tick() {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      puff.tics--;
      if (puff.tics > 0) {
        continue;
      }

      puff.frame++;
      if (puff.frame >= PUFF_TICS.length) {
        this.puffs.splice(i, 1);
        continue;
      }

      puff.tics = PUFF_TICS[puff.frame];
    }
  }
}

/**
 * Project and draw world-space billboards (r_things.c — R_ProjectSprite).
 */
export class BillboardRenderer {
  /**
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {import('../wad/SpritePatches.js').SpritePatches} sprites
   * @param {Uint8Array} colormaps
   */
  constructor(renderer, sprites, colormaps) {
    this.renderer = renderer;
    this.sprites = sprites;
    this.colormaps = colormaps;
  }

  /**
   * @param {Puff[]} puffs
   * @param {{ x: number, y: number, z: number, angle: number }} view
   * @param {import('./ViewSetup.js').ViewSetup} viewSetup
   * @param {import('../math/tables.js').createTrigTables extends Function ? ReturnType<createTrigTables> : any} tables
   * @param {import('./WallDrawer.js').DrawSeg[]} drawSegs
   * @param {number} drawSegCount
   * @param {import('./WallDrawer.js').WallDrawer} wallDrawer
   * @param {number} [extralight=0]
   */
  drawPuffs(puffs, view, viewSetup, tables, drawSegs, drawSegCount, wallDrawer, extralight = 0) {
    const viewCos = tables.finecosine[fineAngleIndex(view.angle)];
    const viewSin = tables.finesine[fineAngleIndex(view.angle)];
    const lightIndex = Math.min(31, 16 + extralight);
    const colormap = this.colormaps.subarray(lightIndex * 256, (lightIndex + 1) * 256);

    for (const puff of puffs) {
      const patch = this.sprites.getPatch(SPR_PUFF, puff.frame);
      const projected = this.projectSprite(
        puff.x,
        puff.y,
        puff.z,
        view,
        viewSetup,
        viewCos,
        viewSin,
        patch,
      );
      if (!projected) {
        continue;
      }

      const scaleV = projected.scale;
      const scaleH = projected.xscale;
      if (!spriteIntersectsView(
        projected,
        patch.header,
        viewSetup.viewHeight,
        viewSetup.viewWidth,
        viewSetup.centerYFrac,
        scaleV,
      )) {
        continue;
      }

      const { clipbot, cliptop } = computeSpriteClip(projected, drawSegs, drawSegCount, viewSetup.viewHeight);
      renderMaskedSegsBehindSprite(projected, drawSegs, drawSegCount, wallDrawer);
      this.renderer.drawPatchScaled(
        projected.x,
        projected.texturemid,
        patch.header,
        patch.data,
        colormap,
        scaleV,
        scaleH,
        viewSetup.centerYFrac,
        clipbot,
        cliptop,
        projected.x1,
      );
    }
  }

  /**
   * @param {import('../game/MapThingSpawner.js').MapThingMobj[]} things
   * @param {{ x: number, y: number, z: number, angle: number }} view
   * @param {import('./ViewSetup.js').ViewSetup} viewSetup
   * @param {import('../math/tables.js').createTrigTables extends Function ? ReturnType<createTrigTables> : any} tables
   * @param {import('./WallDrawer.js').DrawSeg[]} drawSegs
   * @param {number} drawSegCount
   * @param {import('./WallDrawer.js').WallDrawer} wallDrawer
   * @param {number} [extralight=0]
   */
  drawThings(things, view, viewSetup, tables, drawSegs, drawSegCount, wallDrawer, extralight = 0) {
    const viewCos = tables.finecosine[fineAngleIndex(view.angle)];
    const viewSin = tables.finesine[fineAngleIndex(view.angle)];
    const lightIndex = Math.min(31, 16 + extralight);
    const colormap = this.colormaps.subarray(lightIndex * 256, (lightIndex + 1) * 256);
    const fullbright = this.colormaps.subarray(0, 256);

    const visible = [];
    for (const thing of things) {
      if (thing.removed) {
        continue;
      }

      const rotation = thing.monsterType
        ? ((((pointToAngle(thing.x, thing.y, view.x, view.y, tables.tantoangle)
          - thing.angle) >>> 0) + ((ANG45 >>> 1) * 9 >>> 0)) >>> 29)
        : 0;

      let patch;
      let flip = false;
      if (thing.monsterType) {
        const resolved = this.sprites.getWorldSprite(thing.sprite, thing.frame, rotation);
        if (!resolved) {
          continue;
        }
        patch = resolved.patch;
        flip = resolved.flip;
      } else {
        try {
          patch = this.sprites.getPatchByName(
            mapSpriteLumpName(thing.sprite, thing.frame, thing.fullbright),
          );
        } catch {
          continue;
        }
      }

      const projected = this.projectSprite(
        thing.x,
        thing.y,
        thing.z,
        view,
        viewSetup,
        viewCos,
        viewSin,
        patch,
      );
      if (!projected) {
        continue;
      }

      const scaleV = projected.scale;
      const scaleH = projected.xscale;
      if (!spriteIntersectsView(
        projected,
        patch.header,
        viewSetup.viewHeight,
        viewSetup.viewWidth,
        viewSetup.centerYFrac,
        scaleV,
      )) {
        continue;
      }

      visible.push({ thing, patch, projected, flip, scaleH, scaleV });
    }

    visible.sort((a, b) => b.projected.distance - a.projected.distance);

    for (const entry of visible) {
      const useColormap = entry.thing.fullbright ? fullbright : colormap;
      const { clipbot, cliptop } = computeSpriteClip(entry.projected, drawSegs, drawSegCount, viewSetup.viewHeight);
      renderMaskedSegsBehindSprite(entry.projected, drawSegs, drawSegCount, wallDrawer);
      if (entry.thing.flags & MF_SHADOW) {
        this.renderer.drawPatchScaledFuzz(
          entry.projected.x,
          entry.projected.texturemid,
          entry.patch.header,
          entry.patch.data,
          entry.scaleV,
          entry.scaleH,
          viewSetup.centerYFrac,
          clipbot,
          cliptop,
          entry.projected.x1,
          entry.flip,
        );
      } else {
        this.renderer.drawPatchScaled(
          entry.projected.x,
          entry.projected.texturemid,
          entry.patch.header,
          entry.patch.data,
          useColormap,
          entry.scaleV,
          entry.scaleH,
          viewSetup.centerYFrac,
          clipbot,
          cliptop,
          entry.projected.x1,
          entry.flip,
        );
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {{ x: number, y: number, z: number }} view
   * @param {import('./ViewSetup.js').ViewSetup} viewSetup
   * @param {number} viewCos
   * @param {number} viewSin
   * @param {{ header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }} patch
   */
  projectSprite(x, y, z, view, viewSetup, viewCos, viewSin, patch) {
    const trX = x - view.x;
    const trY = y - view.y;

    let gxt = fixedMul(trX, viewCos);
    let gyt = -fixedMul(trY, viewSin);
    const tz = gxt - gyt;
    if (tz < SPRITE_MINZ) {
      return null;
    }

    const xscale = fixedDiv(viewSetup.projection, tz);
    gxt = -fixedMul(trX, viewSin);
    gyt = fixedMul(trY, viewCos);
    const tx = -(gyt + gxt);

    if (Math.abs(tx) > (tz << 2)) {
      return null;
    }

    const screenX = (viewSetup.centerXFrac + fixedMul(tx, xscale)) >> FRACBITS;
    const left = (viewSetup.centerXFrac + fixedMul(tx - (patch.header.leftOffset << FRACBITS), xscale)) >> FRACBITS;
    const right = (viewSetup.centerXFrac + fixedMul(
      tx + ((patch.header.width - patch.header.leftOffset) << FRACBITS),
      xscale,
    )) >> FRACBITS;

    if (left >= viewSetup.viewWidth || right < 0) {
      return null;
    }

    const spriteTopZ = z + (patch.header.topOffset << FRACBITS);

    return {
      x: screenX,
      x1: left,
      x2: right,
      xscale,
      scale: xscale << viewSetup.detailShift,
      texturemid: (z - view.z) + (patch.header.topOffset << FRACBITS),
      distance: tz,
      gx: x,
      gy: y,
      gz: z,
      gzt: spriteTopZ,
    };
  }
}
