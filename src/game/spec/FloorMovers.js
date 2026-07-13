import { FLOORSPEED } from '../../core/gameConstants.js';
import { movePlane } from './PlaneMovement.js';
import { findLowestFloorSurrounding, findHighestFloorSurrounding, findSectorFromLineTag } from './SectorQuery.js';

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

    const res = movePlane(this.sector, this.speed, this.dest, 0, this.direction);
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
    switch (type) {
      case FloorMoveType.lowerToHighest:
        dest = findHighestFloorSurrounding(sec);
        break;
      case FloorMoveType.raiseToHighest:
        dest = findHighestFloorSurrounding(sec);
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
    const floor = new FloorMoveThinker(sec, dest, dest < sec.floorHeight ? -1 : 1, FLOORSPEED);
    floor.context = ctx;
    sec.specialdata = floor;
    ctx.thinkers.add(floor);
  }

  return activated;
}
