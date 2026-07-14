/** @typedef {'ok' | 'pastdest' | 'crushed'} MoveResult */

/**
 * Move a plane and carry things in the sector (p_floor.c — T_MovePlane + P_ChangeSector).
 * @param {import('../MapCollision.js').MapCollision|null} collision
 * @param {import('../Level.js').LevelSector} sector
 * @param {number} speed
 * @param {number} dest
 * @param {0 | 1} floorOrCeiling
 * @param {number} direction
 * @returns {MoveResult}
 */
export function movePlaneWithSectorChange(collision, sector, speed, dest, floorOrCeiling, direction) {
  const res = movePlane(sector, speed, dest, floorOrCeiling, direction);
  collision?.changeSector(sector);
  return res;
}

/**
 * Move a floor or ceiling plane (p_floor.c — T_MovePlane).
 * Crushing is omitted for now — returns ok while moving, pastdest at destination.
 *
 * @param {import('../Level.js').LevelSector} sector
 * @param {number} speed
 * @param {number} dest
 * @param {0 | 1} floorOrCeiling 0 = floor, 1 = ceiling
 * @param {number} direction -1 or 1
 * @returns {MoveResult}
 */
export function movePlane(sector, speed, dest, floorOrCeiling, direction) {
  if (floorOrCeiling === 0) {
    if (direction === -1) {
      if (sector.floorHeight - speed < dest) {
        sector.floorHeight = dest;
        return 'pastdest';
      }
      sector.floorHeight -= speed;
      return 'ok';
    }

    if (sector.floorHeight + speed > dest) {
      sector.floorHeight = dest;
      return 'pastdest';
    }
    sector.floorHeight += speed;
    return 'ok';
  }

  if (direction === -1) {
    if (sector.ceilingHeight - speed < dest) {
      sector.ceilingHeight = dest;
      return 'pastdest';
    }
    sector.ceilingHeight -= speed;
    return 'ok';
  }

  if (sector.ceilingHeight + speed > dest) {
    sector.ceilingHeight = dest;
    return 'pastdest';
  }
  sector.ceilingHeight += speed;
  return 'ok';
}
