import { FRACBITS } from '../../core/renderConstants.js';
import { MF_SHOOTABLE } from '../mobjFlags.js';
import { damageMobj } from './MobjCombat.js';
import { checkSight } from './Sight.js';

/**
 * Blast damage in a square radius (p_map.c — P_RadiusAttack).
 * @param {import('../MapThingSpawner.js').MapThingMobj} spot
 * @param {import('../Mobj.js').Mobj|null} source
 * @param {number} damage
 * @param {import('../MapThingSpawner.js').MapThingMobj[]} things
 * @param {import('../MapCollision.js').MapCollision} collision
 * @param {import('../Player.js').Player} player
 */
export function radiusAttack(spot, source, damage, things, collision, player) {
  for (const thing of things) {
    if (thing === spot || thing.removed || !(thing.flags & MF_SHOOTABLE)) {
      continue;
    }

    let dx = Math.abs(thing.x - spot.x);
    let dy = Math.abs(thing.y - spot.y);
    let dist = dx > dy ? dx : dy;
    dist = (dist - thing.radius) >> FRACBITS;
    if (dist < 0) {
      dist = 0;
    }
    if (dist >= damage) {
      continue;
    }
    if (!checkSight(thing, spot, collision)) {
      continue;
    }
    damageMobj(thing, spot, source, damage - dist, player, collision.dropCtx);
  }

  const mo = player.mo;
  if (player.health <= 0) {
    return;
  }

  let dx = Math.abs(mo.x - spot.x);
  let dy = Math.abs(mo.y - spot.y);
  let dist = dx > dy ? dx : dy;
  dist = (dist - mo.radius) >> FRACBITS;
  if (dist < 0) {
    dist = 0;
  }
  if (dist >= damage) {
    return;
  }
  if (!checkSight(mo, spot, collision)) {
    return;
  }
  damageMobj(mo, spot, source, damage - dist, player);
}
