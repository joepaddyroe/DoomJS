import { FRACUNIT } from '../../core/renderConstants.js';
import { PLATSPEED } from '../../core/gameConstants.js';
import { movePlane } from './PlaneMovement.js';
import { findSectorFromLineTag } from './SectorQuery.js';

/** @typedef {import('./Doors.js').SpecContext} SpecContext */
/** @typedef {import('../Level.js').LevelSector} LevelSector */

/** @enum {number} */
export const PlatType = {
  raiseAndChange: 0,
  raiseToNearestAndChange: 1,
};

export class PlatThinker {
  /**
   * @param {LevelSector} sector
   * @param {number} type PlatType
   * @param {number} height Target height
   */
  constructor(sector, type, height) {
    this.sector = sector;
    this.type = type;
    this.height = height;
    this.speed = PLATSPEED;
    this.direction = 1;
    /** @type {SpecContext|null} */
    this.context = null;
  }

  think() {
    if (!this.context) {
      return;
    }

    const res = movePlane(this.sector, this.speed, this.height, 0, this.direction);
    if (res === 'pastdest') {
      this.sector.specialdata = null;
      this.context.thinkers.remove(this);
    }
  }
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

    let height = sec.floorHeight;
    if (type === PlatType.raiseAndChange) {
      height = sec.floorHeight + 24 * FRACUNIT;
    } else {
      for (const check of sec.lines) {
        const other = check.frontSector === sec ? check.backSector : check.frontSector;
        if (other && other.floorHeight > height) {
          height = other.floorHeight;
        }
      }
    }

    if (height === sec.floorHeight) {
      continue;
    }

    activated = true;
    const plat = new PlatThinker(sec, type, height);
    plat.context = ctx;
    sec.specialdata = plat;
    ctx.thinkers.add(plat);
  }

  return activated;
}
