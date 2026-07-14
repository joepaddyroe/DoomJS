import { FLOORSPEED } from '../../core/gameConstants.js';
import { FRACUNIT } from '../../core/renderConstants.js';
import { movePlaneWithSectorChange } from './PlaneMovement.js';
import {
  findLowestCeilingSurrounding,
  findLowestFloorSurrounding,
  findHighestFloorSurrounding,
  findSectorFromLineTag,
} from './SectorQuery.js';

/** @typedef {import('./Doors.js').SpecContext} SpecContext */
/** @typedef {import('../Level.js').LevelSector} LevelSector */

export class FloorMoveThinker {
  /**
   * @param {LevelSector} sector
   * @param {number} dest
   * @param {number} direction -1 down, 1 up
   * @param {number} speed
   */
  constructor(sector, dest, direction, speed) {
    this.sector = sector;
    this.dest = dest;
    this.direction = direction;
    this.speed = speed;
    /** @type {SpecContext|null} */
    this.context = null;
  }

  think() {
    if (!this.context) {
      return;
    }

    const res = movePlaneWithSectorChange(
      this.context.collision,
      this.sector,
      this.speed,
      this.dest,
      0,
      this.direction,
    );
    if (res === 'pastdest') {
      this.sector.specialdata = null;
      this.context.thinkers.remove(this);
    }
  }
}

/** @enum {number} */
export const FloorMoveType = {
  lowerToLowest: 0,
  lowerToHighest: 1,
  raiseToHighest: 2,
  /** p_floor.c — raiseFloor */
  raiseFloor: 3,
  /** p_floor.c — turboLower (fast lower to highest surrounding + 8) */
  turboLower: 4,
};

/**
 * @param {SpecContext} ctx
 * @param {import('../Level.js').LevelLine} line
 * @param {number} type FloorMoveType
 * @returns {boolean}
 */
export function evDoFloor(ctx, line, type) {
  let secnum = -1;
  let activated = false;

  while ((secnum = findSectorFromLineTag(line, ctx.sectors, secnum)) >= 0) {
    const sec = ctx.sectors[secnum];
    if (sec.specialdata) {
      continue;
    }

    let dest;
    let speed = FLOORSPEED;
    switch (type) {
      case FloorMoveType.lowerToHighest:
        dest = findHighestFloorSurrounding(sec);
        break;
      case FloorMoveType.raiseFloor: {
        dest = findLowestCeilingSurrounding(sec);
        if (dest > sec.ceilingHeight) {
          dest = sec.ceilingHeight;
        }
        dest -= 8 * FRACUNIT;
        break;
      }
      case FloorMoveType.raiseToHighest:
        dest = findHighestFloorSurrounding(sec);
        break;
      case FloorMoveType.turboLower:
        dest = findHighestFloorSurrounding(sec);
        if (dest !== sec.floorHeight) {
          dest += 8 * FRACUNIT;
        }
        speed = FLOORSPEED * 4;
        break;
      case FloorMoveType.lowerToLowest:
      default:
        dest = findLowestFloorSurrounding(sec);
        break;
    }

    if (dest === sec.floorHeight) {
      continue;
    }

    activated = true;

    const floor = new FloorMoveThinker(sec, dest, dest < sec.floorHeight ? -1 : 1, speed);
    floor.context = ctx;
    sec.specialdata = floor;
    ctx.thinkers.add(floor);
  }

  return activated;
}
