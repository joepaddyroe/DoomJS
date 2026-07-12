import { FRACUNIT } from '../core/renderConstants.js';
import { angleFromDegrees } from '../core/angles.js';
import { mobjDefForType } from './mobjInfo.js';

/**
 * @typedef {Object} MapThingMobj
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} angle
 * @property {number} radius
 * @property {number} height
 * @property {number} flags
 * @property {string} sprite
 * @property {number} frame
 * @property {boolean} fullbright
 * @property {string|null} pickup
 * @property {number} mapType
 * @property {boolean} removed
 */

const MF_NOTSINGLE = 16;

/**
 * @param {import('./MapLoader.js').MapThing} thing
 * @param {number} [skill=2] Hurt me plenty
 */
export function shouldSpawnMapThing(thing, skill = 2) {
  if (thing.type >= 1 && thing.type <= 4) {
    return false;
  }
  if (thing.type === 11) {
    return false;
  }
  if (thing.options & MF_NOTSINGLE) {
    return false;
  }
  if (thing.type >= 3001 && thing.type <= 6999) {
    return false;
  }

  const mask = 1 << (skill - 1);
  if (thing.options === 0) {
    return true;
  }
  return (thing.options & mask) !== 0;
}

/**
 * @param {import('./Level.js').Level} level
 * @param {import('./MapLoader.js').MapThing} thing
 * @returns {MapThingMobj|null}
 */
export function spawnMapThing(level, thing) {
  const def = mobjDefForType(thing.type);
  if (!def) {
    return null;
  }

  const x = thing.x * FRACUNIT;
  const y = thing.y * FRACUNIT;
  const subsector = level.findSubsector(x, y);
  const floor = subsector.sector.floorHeight;

  return {
    x,
    y,
    z: floor,
    angle: angleFromDegrees(thing.angle),
    radius: def.radius,
    height: def.height,
    flags: def.flags,
    sprite: def.sprite,
    frame: def.frame ?? 0,
    fullbright: def.fullbright ?? false,
    pickup: def.pickup ?? null,
    mapType: thing.type,
    removed: false,
  };
}

/**
 * @param {import('./Level.js').Level} level
 * @param {number} [skill=2]
 * @returns {MapThingMobj[]}
 */
export function spawnMapThings(level, skill = 2) {
  /** @type {MapThingMobj[]} */
  const spawned = [];

  for (const thing of level.things) {
    if (!shouldSpawnMapThing(thing, skill)) {
      continue;
    }
    const mobj = spawnMapThing(level, thing);
    if (mobj) {
      spawned.push(mobj);
    }
  }

  return spawned;
}
