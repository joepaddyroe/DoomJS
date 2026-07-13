import { ML_TWOSIDED } from '../mapFormat.js';

/**
 * Sector on the other side of a two-sided line (p_spec.c — getNextSector).
 * @param {import('../Level.js').LevelLine} line
 * @param {import('../Level.js').LevelSector} sector
 */
export function getNextSector(line, sector) {
  if (!(line.flags & ML_TWOSIDED)) {
    return null;
  }

  if (line.frontSector === sector) {
    return line.backSector;
  }

  return line.frontSector;
}

/**
 * @param {import('../Level.js').LevelSector} sec
 */
export function findLowestCeilingSurrounding(sec) {
  let height = 0x7fffffff;

  for (const check of sec.lines) {
    const other = getNextSector(check, sec);
    if (!other) {
      continue;
    }
    if (other.ceilingHeight < height) {
      height = other.ceilingHeight;
    }
  }

  return height;
}

/**
 * @param {import('../Level.js').LevelSector} sec
 */
export function findLowestFloorSurrounding(sec) {
  let height = 0x7fffffff;

  for (const check of sec.lines) {
    const other = getNextSector(check, sec);
    if (!other) {
      continue;
    }
    if (other.floorHeight < height) {
      height = other.floorHeight;
    }
  }

  return height;
}

/**
 * @param {import('../Level.js').LevelSector} sec
 */
export function findHighestFloorSurrounding(sec) {
  let height = -0x80000000;

  for (const check of sec.lines) {
    const other = getNextSector(check, sec);
    if (!other) {
      continue;
    }
    if (other.floorHeight > height) {
      height = other.floorHeight;
    }
  }

  return height;
}

/**
 * @param {import('../Level.js').LevelLine} line
 * @param {import('../Level.js').LevelSector[]} sectors
 * @param {number} start
 */
export function findSectorFromLineTag(line, sectors, start) {
  for (let i = start + 1; i < sectors.length; i++) {
    if (sectors[i].tag === line.tag) {
      return i;
    }
  }
  return -1;
}

/**
 * Door sector for a use line — opposite side from the user (p_doors.c).
 * @param {import('../Level.js').LevelLine} line
 * @param {number} side
 */
export function doorSectorForUseLine(line, side) {
  return side === 0 ? line.backSector : line.frontSector;
}
