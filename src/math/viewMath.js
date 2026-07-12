import {
  ANG90,
  ANG180,
  ANG270,
  ANGLETOFINESHIFT,
  DBITS,
} from '../core/angles.js';
import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { fixedDiv, fixedMul } from './fixed.js';
import { slopeDiv } from './tables.js';

/**
 * Point-on-side test for BSP (r_main.c — R_PointOnSide).
 * @param {number} x Fixed
 * @param {number} y Fixed
 * @param {{ x: number, y: number, dx: number, dy: number }} node
 * @returns {0|1}
 */
export function pointOnSide(x, y, node) {
  const dx = x - node.x;
  const dy = y - node.y;
  const ldx = node.dx;
  const ldy = node.dy;

  if (((ldy ^ ldx ^ dx ^ dy) & 0x80000000) !== 0) {
    if (((ldy ^ dx) & 0x80000000) !== 0) {
      return 1;
    }
    return 0;
  }

  const left = fixedMul(ldy >> FRACBITS, dx);
  const right = fixedMul(dy, ldx >> FRACBITS);
  return right < left ? 0 : 1;
}

/**
 * @param {number} x Fixed world x
 * @param {number} y Fixed world y
 * @param {number} viewX
 * @param {number} viewY
 * @param {Uint32Array} tantoangle
 * @returns {number} BAM angle
 */
export function pointToAngle(x, y, viewX, viewY, tantoangle) {
  let dx = x - viewX;
  let dy = y - viewY;

  if (dx === 0 && dy === 0) {
    return 0;
  }

  if (dx >= 0) {
    if (dy >= 0) {
      if (dx > dy) {
        return tantoangle[slopeDiv(dy, dx)];
      }
      return (ANG90 - 1 - tantoangle[slopeDiv(dx, dy)]) >>> 0;
    }

    dy = -dy;
    if (dx > dy) {
      return (-tantoangle[slopeDiv(dy, dx)]) >>> 0;
    }
    return (ANG270 + tantoangle[slopeDiv(dx, dy)]) >>> 0;
  }

  dx = -dx;
  if (dy >= 0) {
    if (dx > dy) {
      return (ANG180 - 1 - tantoangle[slopeDiv(dy, dx)]) >>> 0;
    }
    return (ANG90 + tantoangle[slopeDiv(dx, dy)]) >>> 0;
  }

  dy = -dy;
  if (dx > dy) {
    return (ANG180 + tantoangle[slopeDiv(dy, dx)]) >>> 0;
  }
  return (ANG270 - 1 - tantoangle[slopeDiv(dx, dy)]) >>> 0;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} viewX
 * @param {number} viewY
 * @param {Int32Array} finetangent
 * @returns {number}
 */
export function pointToDist(x, y, viewX, viewY, tantoangle, finesine) {
  let dx = Math.abs(x - viewX);
  let dy = Math.abs(y - viewY);

  if (dy > dx) {
    const temp = dx;
    dx = dy;
    dy = temp;
  }

  if (dx === 0) {
    return 0;
  }

  // r_main.c R_PointToDist uses FixedDiv(dy,dx), not SlopeDiv (that is R_PointToAngle only).
  const angle = ((tantoangle[(fixedDiv(dy, dx) | 0) >> DBITS] + ANG90) >>> 0) >> ANGLETOFINESHIFT;
  const sine = finesine[angle];
  if (!sine) {
    return dx;
  }
  return fixedDiv(dx, sine);
}

/**
 * @param {number} visAngle
 * @param {number} viewAngle
 * @param {number} rwNormalAngle
 * @param {number} rwDistance
 * @param {number} projection
 * @param {Int32Array} finesine
 * @returns {number}
 */
export function scaleFromGlobalAngle(
  visAngle,
  viewAngle,
  rwNormalAngle,
  rwDistance,
  projection,
  finesine,
) {
  let angleA = (ANG90 + (visAngle - viewAngle)) >>> 0;
  let angleB = (ANG90 + (visAngle - rwNormalAngle)) >>> 0;

  const sineA = finesine[(angleA >>> 0) >> ANGLETOFINESHIFT];
  const sineB = finesine[(angleB >>> 0) >> ANGLETOFINESHIFT];
  let num = fixedMul(projection, sineB);
  const den = fixedMul(rwDistance, sineA);

  if (den > num >> 16) {
    let scale = fixedMul(num, fixedDiv(FRACUNIT, den));
    if (scale > 64 * FRACUNIT) {
      scale = 64 * FRACUNIT;
    } else if (scale < 256) {
      scale = 256;
    }
    return scale;
  }

  return 64 * FRACUNIT;
}
