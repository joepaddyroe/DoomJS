import { ANGLETOFINESHIFT, FINEANGLES, FINEMASK, fineAngleIndex } from '../../core/angles.js';
import { PLAYER_RADIUS, PT_ADDLINES, USERANGE } from '../../core/gameConstants.js';
import { fixedMul } from '../../math/fixed.js';
import { lineOpening, pointOnLineSide } from '../../math/mapGeometry.js';
import { useSpecialLine } from './UseSpecialLine.js';

/** @typedef {import('./Doors.js').DoorContext} DoorContext */
/** @typedef {import('../MapCollision.js').MapCollision} MapCollision */

/** @typedef {'used' | 'blocked' | 'clear'} UseRayResult */

/**
 * Cast one use ray from an origin (p_map.c — P_UseLines / PTR_UseTraverse).
 * @param {MapCollision} collision
 * @param {import('../Mobj.js').Mobj} mo
 * @param {DoorContext} ctx
 * @param {number} x1
 * @param {number} y1
 * @param {number} fineAngle
 * @returns {UseRayResult}
 */
function useLineRay(collision, mo, ctx, x1, y1, fineAngle) {
  const tables = collision.tables;
  const x2 = x1 + fixedMul(USERANGE, tables.finecosine[fineAngle]);
  const y2 = y1 + fixedMul(USERANGE, tables.finesine[fineAngle]);

  let blocked = false;
  let used = false;

  collision.pathTraverse(x1, y1, x2, y2, PT_ADDLINES, (incept) => {
    const line = incept.line;
    if (!line) {
      return true;
    }

    if (!line.special) {
      const opening = lineOpening(line);
      if (opening.openrange <= 0) {
        blocked = true;
        return false;
      }
      return true;
    }

    let side = 0;
    if (pointOnLineSide(mo.x, mo.y, line) === 1) {
      side = 1;
    }

    if (useSpecialLine(mo, line, side, ctx)) {
      used = true;
      return false;
    }
    return true;
  });

  if (used) {
    return 'used';
  }

  if (blocked) {
    return 'blocked';
  }

  return 'clear';
}

/**
 * Raycast forward and use the first special line (p_map.c — P_UseLines).
 *
 * A single center ray often hits door frame geometry before the door linedef
 * (especially on diagonal jambs). Shoulder rays offset by PLAYERRADIUS match
 * how vanilla plays when the player stands slightly left/right of center.
 *
 * @param {MapCollision} collision
 * @param {import('../Player.js').Player} player
 * @param {DoorContext} ctx
 */
export function useLines(collision, player, ctx) {
  const mo = player.mo;
  const tables = collision.tables;
  const fineAngle = fineAngleIndex(mo.angle);
  const perpAngle = (fineAngle + (FINEANGLES / 4)) & FINEMASK;
  const shoulderX = fixedMul(PLAYER_RADIUS, tables.finecosine[perpAngle]);
  const shoulderY = fixedMul(PLAYER_RADIUS, tables.finesine[perpAngle]);

  const origins = [
    [mo.x, mo.y],
    [mo.x + shoulderX, mo.y + shoulderY],
    [mo.x - shoulderX, mo.y - shoulderY],
  ];

  let anyBlocked = false;

  for (const [x1, y1] of origins) {
    const result = useLineRay(collision, mo, ctx, x1, y1, fineAngle);
    if (result === 'used') {
      return;
    }
    if (result === 'blocked') {
      anyBlocked = true;
    }
  }

  if (anyBlocked) {
    ctx.sound?.start('noway');
  }
}
