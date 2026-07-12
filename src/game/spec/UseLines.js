import { ANGLETOFINESHIFT } from '../../core/angles.js';
import { FRACBITS } from '../../core/renderConstants.js';
import { PT_ADDLINES, USERANGE } from '../../core/gameConstants.js';
import { lineOpening, pointOnLineSide } from '../../math/mapGeometry.js';
import { useSpecialLine } from './UseSpecialLine.js';

/** @typedef {import('./Doors.js').DoorContext} DoorContext */
/** @typedef {import('../MapCollision.js').MapCollision} MapCollision */

/**
 * Raycast forward and use the first special line (p_map.c — P_UseLines).
 * @param {MapCollision} collision
 * @param {import('../Player.js').Player} player
 * @param {DoorContext} ctx
 */
export function useLines(collision, player, ctx) {
  const mo = player.mo;
  const tables = collision.tables;
  const angle = mo.angle >> ANGLETOFINESHIFT;
  const reach = USERANGE >> FRACBITS;

  const x1 = mo.x;
  const y1 = mo.y;
  const x2 = x1 + reach * tables.finecosine[angle];
  const y2 = y1 + reach * tables.finesine[angle];

  collision.pathTraverse(x1, y1, x2, y2, PT_ADDLINES, (incept) => {
    const line = incept.line;
    if (!line) {
      return true;
    }

    if (!line.special) {
      const opening = lineOpening(line);
      if (opening.openrange <= 0) {
        ctx.sound?.start('noway');
        return false;
      }
      return true;
    }

    let side = 0;
    if (pointOnLineSide(mo.x, mo.y, line) === 1) {
      side = 1;
    }

    useSpecialLine(mo, line, side, ctx);
    return false;
  });
}
