import { FRACUNIT } from '../core/renderConstants.js';
import { angleFromDegrees } from '../core/angles.js';
import { DI_NODIR } from './monster/EnemyMove.js';
import { monsterArchetypeForType } from './monster/monsterInfo.js';
import { setMobjState } from './monster/MobjCombat.js';
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
 * @property {string|null} [monsterType]
 * @property {import('./monster/monsterInfo.js').MonsterArchetype|null} [monsterDef]
 * @property {string} [state]
 * @property {number} [stateTics]
 * @property {number} [health]
 * @property {number} [mass]
 * @property {import('./Mobj.js').Mobj|null} [target]
 * @property {number} [threshold]
 * @property {number} [reactiontime]
 * @property {number} [movedir]
 * @property {number} [movecount]
 * @property {number} [momx]
 * @property {number} [momy]
 * @property {number} [floorz]
 * @property {number} [ceilingz]
 * @property {import('./Level.js').LevelSubsector|null} [subsector]
 * @property {import('./Player.js').Player|null} [playerObject]
 * @property {boolean} [stateEntered]
 * @property {string|null} [pendingState]
 */

const MF_NOTSINGLE = 16;

/**
 * Skill spawn bit (p_mobj.c — P_SpawnMapThing).
 * @param {number} skill 1=baby, 2=hurt me plenty, 3=ultra violence, 4=nightmare
 */
export function skillSpawnBit(skill) {
  if (skill <= 1) {
    return 1;
  }
  if (skill >= 4) {
    return 4;
  }
  return 1 << (skill - 1);
}

/**
 * @param {import('./MapLoader.js').MapThing} thing
 * @param {number} [skill=3] Ultra violence — full E1M1 monster placement
 */
export function shouldSpawnMapThing(thing, skill = 3) {
  if (thing.type >= 1 && thing.type <= 4) {
    return false;
  }
  if (thing.type === 11) {
    return false;
  }
  if (thing.options & MF_NOTSINGLE) {
    return false;
  }

  const bit = skillSpawnBit(skill);
  return (thing.options & bit) !== 0;
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

  const monsterDef = monsterArchetypeForType(thing.type);
  const x = thing.x * FRACUNIT;
  const y = thing.y * FRACUNIT;
  const subsector = level.findSubsector(x, y);
  const floor = subsector.sector.floorHeight;
  const ceiling = subsector.sector.ceilingHeight;

  /** @type {MapThingMobj} */
  const mobj = {
    x,
    y,
    z: floor,
    angle: angleFromDegrees(thing.angle),
    radius: def.radius,
    height: def.height,
    flags: monsterDef ? monsterDef.flags : def.flags,
    sprite: def.sprite,
    frame: def.frame ?? 0,
    fullbright: def.fullbright ?? false,
    pickup: def.pickup ?? null,
    mapType: thing.type,
    removed: false,
    floorz: floor,
    ceilingz: ceiling,
    subsector,
    momx: 0,
    momy: 0,
    target: null,
    threshold: 0,
    movedir: DI_NODIR,
    movecount: 0,
    monsterType: null,
    monsterDef: null,
    state: '',
    stateTics: 0,
    health: 0,
    mass: 100,
    reactiontime: 0,
    stateEntered: false,
    pendingState: null,
  };

  if (monsterDef) {
    mobj.monsterType = monsterDef.id;
    mobj.monsterDef = monsterDef;
    mobj.health = monsterDef.spawnhealth;
    mobj.mass = monsterDef.mass;
    mobj.reactiontime = monsterDef.reactiontime;
    setMobjState(mobj, monsterDef.spawnState);
  }

  return mobj;
}

/**
 * @param {import('./Level.js').Level} level
 * @param {number} [skill=3]
 * @returns {MapThingMobj[]}
 */
export function spawnMapThings(level, skill = 3) {
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
