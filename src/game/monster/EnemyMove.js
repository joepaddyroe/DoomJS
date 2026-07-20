import { MELEERANGE } from '../../core/gameConstants.js';
import { FRACUNIT } from '../../core/renderConstants.js';
import { gameRandom } from '../GameRandom.js';
import { MF_JUSTHIT } from '../mobjFlags.js';
import { checkSight } from './Sight.js';
import { approxDistance } from './Sight.js';

export const DI_EAST = 0;
export const DI_NORTHEAST = 1;
export const DI_NORTH = 2;
export const DI_NORTHWEST = 3;
export const DI_WEST = 4;
export const DI_SOUTHWEST = 5;
export const DI_SOUTH = 6;
export const DI_SOUTHEAST = 7;
export const DI_NODIR = 8;

const OPPOSITE = [
  DI_WEST, DI_SOUTHWEST, DI_SOUTH, DI_SOUTHEAST,
  DI_EAST, DI_NORTHEAST, DI_NORTH, DI_NORTHWEST, DI_NODIR,
];

const DIAGS = [DI_NORTHWEST, DI_NORTHEAST, DI_SOUTHWEST, DI_SOUTHEAST];

const XSPEED = [FRACUNIT, 47000, 0, -47000, -FRACUNIT, -47000, 0, 47000];
const YSPEED = [0, 47000, FRACUNIT, 47000, 0, -47000, -FRACUNIT, -47000];

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {import('../MapCollision.js').MapCollision} collision
 */
export function enemyMove(actor, collision) {
  if (actor.movedir === DI_NODIR) {
    return false;
  }

  const arch = actor.monsterDef;
  const tryx = actor.x + arch.speed * XSPEED[actor.movedir];
  const tryy = actor.y + arch.speed * YSPEED[actor.movedir];

  return collision.tryMove(actor, tryx, tryy);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {import('../MapCollision.js').MapCollision} collision
 */
export function tryWalk(actor, collision) {
  if (!enemyMove(actor, collision)) {
    return false;
  }
  actor.movecount = gameRandom() & 15;
  return true;
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {import('../MapCollision.js').MapCollision} collision
 */
export function newChaseDir(actor, collision) {
  if (!actor.target) {
    return;
  }

  const olddir = actor.movedir;
  const turnaround = OPPOSITE[olddir];

  const deltax = actor.target.x - actor.x;
  const deltay = actor.target.y - actor.y;

  /** @type {number[]} */
  const d = [DI_NODIR, DI_NODIR, DI_NODIR];

  if (deltax > 10 * FRACUNIT) {
    d[1] = DI_EAST;
  } else if (deltax < -10 * FRACUNIT) {
    d[1] = DI_WEST;
  }

  if (deltay < -10 * FRACUNIT) {
    d[2] = DI_SOUTH;
  } else if (deltay > 10 * FRACUNIT) {
    d[2] = DI_NORTH;
  }

  if (d[1] !== DI_NODIR && d[2] !== DI_NODIR) {
    actor.movedir = DIAGS[((deltay < 0) << 1) + (deltax > 0 ? 1 : 0)];
    if (actor.movedir !== turnaround && tryWalk(actor, collision)) {
      return;
    }
  }

  if (gameRandom() > 200 || Math.abs(deltay) > Math.abs(deltax)) {
    const tdir = d[1];
    d[1] = d[2];
    d[2] = tdir;
  }

  if (d[1] === turnaround) {
    d[1] = DI_NODIR;
  }
  if (d[2] === turnaround) {
    d[2] = DI_NODIR;
  }

  if (d[1] !== DI_NODIR) {
    actor.movedir = d[1];
    if (tryWalk(actor, collision)) {
      return;
    }
  }

  if (d[2] !== DI_NODIR) {
    actor.movedir = d[2];
    if (tryWalk(actor, collision)) {
      return;
    }
  }

  let tdir = (gameRandom() & 7);
  if (tryWalk(actor, collision)) {
    return;
  }

  actor.movedir = turnaround;
  if (!tryWalk(actor, collision)) {
    actor.movedir = DI_NODIR;
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {import('../MapCollision.js').MapCollision} collision
 */
export function checkMeleeRange(actor, collision) {
  if (!actor.target) {
    return false;
  }

  const pl = actor.target;
  const dist = approxDistance(pl.x - actor.x, pl.y - actor.y);
  if (dist >= MELEERANGE - 20 * FRACUNIT + pl.radius) {
    return false;
  }

  return checkSight(actor, pl, collision);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {import('../MapCollision.js').MapCollision} collision
 */
export function checkMissileRange(actor, collision) {
  if (!actor.target) {
    return false;
  }

  if (!checkSight(actor, actor.target, collision)) {
    return false;
  }

  if (actor.flags & MF_JUSTHIT) {
    actor.flags &= ~MF_JUSTHIT;
    return true;
  }

  if (actor.reactiontime) {
    return false;
  }

  let dist = approxDistance(
    actor.x - actor.target.x,
    actor.y - actor.target.y,
  ) - 64 * FRACUNIT;

  if (!actor.monsterDef.meleeState) {
    dist -= 128 * FRACUNIT;
  }

  dist >>= 16;

  if (actor.monsterType === 'cyborg'
    || actor.monsterType === 'spider'
    || actor.monsterType === 'skull') {
    dist >>= 1;
  }

  if (dist > 200) {
    dist = 200;
  }

  if (actor.monsterType === 'cyborg' && dist > 160) {
    dist = 160;
  }

  if (gameRandom() < dist) {
    return false;
  }

  return true;
}
