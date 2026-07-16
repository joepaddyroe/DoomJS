import { FRACUNIT } from '../core/renderConstants.js';
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  VIEWHEIGHT,
} from '../core/gameConstants.js';
import { angleFromDegrees } from '../core/angles.js';
import { MF_DROPOFF, MF_PICKUP, MF_SHOOTABLE, MF_SOLID } from './mobjFlags.js';

/**
 * Map object — player mobj state (p_mobj.c / mobj_t).
 * @typedef {Object} Mobj
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} momx
 * @property {number} momy
 * @property {number} momz
 * @property {number} angle BAM angle
 * @property {number} floorz
 * @property {number} ceilingz
 * @property {number} radius
 * @property {number} height
 * @property {number} flags
 * @property {number} health
 * @property {import('./Level.js').LevelSubsector|null} subsector
 * @property {true} player
 */

/**
 * @param {import('./MapLoader.js').MapThing} thing
 * @param {import('./Level.js').Level} level
 * @returns {Mobj}
 */
export function createPlayerMobj(thing, level) {
  const x = thing.x * FRACUNIT;
  const y = thing.y * FRACUNIT;
  const subsector = level.findSubsector(x, y);
  const floor = subsector.sector.floorHeight;

  return {
    x,
    y,
    z: floor,
    momx: 0,
    momy: 0,
    momz: 0,
    angle: angleFromDegrees(thing.angle),
    floorz: floor,
    ceilingz: subsector.sector.ceilingHeight,
    radius: PLAYER_RADIUS,
    height: PLAYER_HEIGHT,
    flags: MF_SOLID | MF_SHOOTABLE | MF_DROPOFF | MF_PICKUP,
    health: 100,
    subsector,
    player: true,
    // Drawn for remote players in net (local view excludes own mo).
    sprite: 'PLAY',
    frame: 0,
    monsterType: 'player',
  };
}

export { VIEWHEIGHT };
