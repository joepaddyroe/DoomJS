import { ANG90, ANG270 } from '../../core/angles.js';
import { MELEERANGE } from '../../core/gameConstants.js';
import { MF_SHOOTABLE } from '../mobjFlags.js';
import { pointToAngle2 } from '../../math/viewMath.js';

/**
 * @param {number} dx
 * @param {number} dy
 */
export function approxDistance(dx, dy) {
  if (dx < 0) {
    dx = -dx;
  }
  if (dy < 0) {
    dy = -dy;
  }
  if (dx > dy) {
    return dx + (dy >> 1);
  }
  return dy + (dx >> 1);
}

/**
 * Line-of-sight check (p_sight.c — wall-only trace).
 * @param {import('../MapThingSpawner.js').MapThingMobj|import('../Mobj.js').Mobj} actor
 * @param {import('../Mobj.js').Mobj} target
 * @param {import('../MapCollision.js').MapCollision} collision
 */
export function checkSight(actor, target, collision) {
  return collision.lineOfSightClear(actor.x, actor.y, target.x, target.y);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {import('../Player.js').Player} player
 * @param {import('../MapCollision.js').MapCollision} collision
 * @param {boolean} allaround
 */
export function lookForPlayer(actor, player, collision, allaround) {
  if (!player || player.health <= 0) {
    return false;
  }

  const mo = player.mo;
  if (!checkSight(actor, mo, collision)) {
    return false;
  }

  if (!allaround) {
    const an = (pointToAngle2(actor.x, actor.y, mo.x, mo.y, collision.tables.tantoangle)
      - actor.angle) >>> 0;
    if (an > ANG90 && an < ANG270) {
      const dist = approxDistance(mo.x - actor.x, mo.y - actor.y);
      if (dist > MELEERANGE) {
        return false;
      }
    }
  }

  if (!(mo.flags & MF_SHOOTABLE)) {
    return false;
  }

  actor.target = mo;
  return true;
}

/**
 * Deterministic multi-player look (p_enemy.c — P_LookForPlayers).
 * Always scans seats in ascending order so every peer picks the same target.
 *
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {(import('../Player.js').Player|null|undefined)[]} players
 * @param {import('../MapCollision.js').MapCollision} collision
 * @param {boolean} allaround
 */
export function lookForPlayers(actor, players, collision, allaround) {
  if (!players?.length) {
    return false;
  }
  for (let i = 0; i < players.length; i++) {
    if (lookForPlayer(actor, players[i], collision, allaround)) {
      return true;
    }
  }
  return false;
}
