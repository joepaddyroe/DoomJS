import { FRACUNIT } from '../../core/renderConstants.js';
import { PLATSPEED, PLATWAIT } from '../../core/gameConstants.js';
import { movePlaneWithSectorChange } from './PlaneMovement.js';
import { findSectorFromLineTag } from './SectorQuery.js';

/** @typedef {import('./Doors.js').SpecContext} SpecContext */
/** @typedef {import('../Level.js').LevelSector} LevelSector */

/** @enum {number} */
export const PlatType = {
  raiseAndChange: 0,
  raiseToNearestAndChange: 1,
  downWaitUpStay: 2,
};

export class PlatThinker {
  /**
   * @param {LevelSector} sector
   * @param {number} type PlatType
   * @param {number} high
   * @param {number} [low]
   */
  constructor(sector, type, high, low = high) {
    this.sector = sector;
    this.type = type;
    this.high = high;
    this.low = low;
    this.speed = PLATSPEED;
    this.direction = 1;
    this.wait = 0;
    /** @type {SpecContext|null} */
    this.context = null;
  }

  think() {
    if (!this.context) {
      return;
    }

    if (this.type === PlatType.downWaitUpStay) {
      if (this.wait > 0) {
        this.wait--;
        return;
      }

      const target = this.direction > 0 ? this.high : this.low;
      const res = movePlaneWithSectorChange(
        this.context.collision,
        this.sector,
        this.speed,
        target,
        0,
        this.direction,
      );
      if (res === 'pastdest') {
        if (this.direction < 0) {
          this.direction = 1;
          this.wait = PLATWAIT;
        } else {
          this.sector.specialdata = null;
          this.context.thinkers.remove(this);
        }
      }
      return;
    }

    const res = movePlaneWithSectorChange(
      this.context.collision,
      this.sector,
      this.speed,
      this.high,
      0,
      this.direction,
    );
    if (res === 'pastdest') {
      this.sector.specialdata = null;
      this.context.thinkers.remove(this);
    }
  }
}

/**
 * @param {LevelSector} sec
 * @returns {number}
 */
function lowestNeighborFloor(sec) {
  let low = sec.floorHeight;
  for (const line of sec.lines) {
    const other = line.frontSector === sec ? line.backSector : line.frontSector;
    if (other && other.floorHeight < low) {
      low = other.floorHeight;
    }
  }
  return low;
}

/**
 * @param {LevelSector} sec
 * @returns {number}
 */
function highestNeighborFloor(sec) {
  let high = sec.floorHeight;
  for (const line of sec.lines) {
    const other = line.frontSector === sec ? line.backSector : line.frontSector;
    if (other && other.floorHeight > high) {
      high = other.floorHeight;
    }
  }
  return high;
}

/**
 * @param {SpecContext} ctx
 * @param {import('../Level.js').LevelLine} line
 * @param {number} type PlatType
 * @returns {boolean}
 */
export function evDoPlat(ctx, line, type) {
  let secnum = -1;
  let activated = false;

  while ((secnum = findSectorFromLineTag(line, ctx.sectors, secnum)) >= 0) {
    const sec = ctx.sectors[secnum];
    if (sec.specialdata) {
      continue;
    }

    let high = sec.floorHeight;
    let low = sec.floorHeight;
    let direction = 1;

    if (type === PlatType.raiseAndChange) {
      high = sec.floorHeight + 24 * FRACUNIT;
    } else if (type === PlatType.raiseToNearestAndChange) {
      high = highestNeighborFloor(sec);
    } else if (type === PlatType.downWaitUpStay) {
      high = sec.floorHeight;
      low = lowestNeighborFloor(sec);
      direction = -1;
    }

    if (high === sec.floorHeight && direction > 0) {
      continue;
    }
    if (type === PlatType.downWaitUpStay && low >= high) {
      continue;
    }

    activated = true;
    const plat = new PlatThinker(sec, type, high, low);
    plat.direction = direction;
    plat.context = ctx;
    sec.specialdata = plat;
    ctx.thinkers.add(plat);
  }

  return activated;
}
