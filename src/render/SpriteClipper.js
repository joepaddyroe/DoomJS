import { SIL_BOTTOM, SIL_TOP } from '../core/angles.js';
import { SPR_CLIP_BOTTOM_OPEN, SPR_CLIP_TOP_OPEN } from './ClipSegList.js';
import { pointOnSegSide } from '../math/viewMath.js';

/**
 * @typedef {Object} SpriteClipInput
 * @property {number} x1
 * @property {number} x2
 * @property {number} scale
 * @property {number} gx
 * @property {number} gy
 * @property {number} gz
 * @property {number} gzt
 */

/**
 * Build per-column sprite clip arrays (r_things.c — R_DrawSprite).
 * @param {SpriteClipInput} spr
 * @param {import('./WallDrawer.js').DrawSeg[]} drawSegs
 * @param {number} drawSegCount
 * @param {number} viewHeight
 * @returns {{ clipbot: Int16Array, cliptop: Int16Array }}
 */
export function computeSpriteClip(spr, drawSegs, drawSegCount, viewHeight) {
  const width = spr.x2 - spr.x1 + 1;
  const clipbot = new Int16Array(width);
  const cliptop = new Int16Array(width);
  clipbot.fill(-2);
  cliptop.fill(-2);

  for (let i = drawSegCount - 1; i >= 0; i--) {
    const ds = drawSegs[i];
    if (ds.x1 > spr.x2 || ds.x2 < spr.x1 || !ds.silhouette) {
      continue;
    }

    const r1 = Math.max(ds.x1, spr.x1);
    const r2 = Math.min(ds.x2, spr.x2);
    const scale = ds.scale1 > ds.scale2 ? ds.scale1 : ds.scale2;
    const lowscale = ds.scale1 > ds.scale2 ? ds.scale2 : ds.scale1;

    if (scale < spr.scale
      || (lowscale < spr.scale && !pointOnSegSide(spr.gx, spr.gy, ds.curline))) {
      continue;
    }

    let silhouette = ds.silhouette;
    if (spr.gz >= ds.bsilheight) {
      silhouette &= ~SIL_BOTTOM;
    }
    if (spr.gzt <= ds.tsilheight) {
      silhouette &= ~SIL_TOP;
    }

    for (let x = r1; x <= r2; x++) {
      const idx = x - spr.x1;
      if ((silhouette & SIL_BOTTOM) && ds.sprbottomclip) {
        if (clipbot[idx] === -2) {
          clipbot[idx] = spriteBottomClipAt(ds, x, viewHeight);
        }
      }
      if ((silhouette & SIL_TOP) && ds.sprtopclip) {
        if (cliptop[idx] === -2) {
          cliptop[idx] = spriteTopClipAt(ds, x, viewHeight);
        }
      }
    }
  }

  for (let i = 0; i < width; i++) {
    if (clipbot[i] === -2) {
      clipbot[i] = viewHeight;
    }
    if (cliptop[i] === -2) {
      cliptop[i] = -1;
    }
  }

  return { clipbot, cliptop };
}

/**
 * @param {import('./WallDrawer.js').DrawSeg} ds
 * @param {number} screenX
 * @param {number} viewHeight
 */
function spriteTopClipAt(ds, screenX, viewHeight) {
  if (ds.sprtopclip === SPR_CLIP_TOP_OPEN) {
    return viewHeight;
  }
  return /** @type {Int16Array} */ (ds.sprtopclip)[screenX - ds.x1];
}

/**
 * @param {import('./WallDrawer.js').DrawSeg} ds
 * @param {number} screenX
 * @param {number} viewHeight
 */
function spriteBottomClipAt(ds, screenX, viewHeight) {
  if (ds.sprbottomclip === SPR_CLIP_BOTTOM_OPEN) {
    return -1;
  }
  return /** @type {Int16Array} */ (ds.sprbottomclip)[screenX - ds.x1];
}
