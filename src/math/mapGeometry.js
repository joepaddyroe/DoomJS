import {
  BOXTOP,
  BOXBOTTOM,
  BOXLEFT,
  BOXRIGHT,
} from '../core/angles.js';
import { FRACBITS } from '../core/renderConstants.js';
import {
  ST_HORIZONTAL,
  ST_VERTICAL,
  ST_POSITIVE,
  ST_NEGATIVE,
} from '../core/gameConstants.js';
import { fixedDiv, fixedMul } from './fixed.js';

/**
 * @param {number} x
 * @param {number} y
 * @param {{ v1: {x:number,y:number}, dx: number, dy: number }} line
 * @returns {0|1}
 */
export function pointOnLineSide(x, y, line) {
  if (!line.dx) {
    if (x <= line.v1.x) {
      return line.dy > 0 ? 1 : 0;
    }
    return line.dy < 0 ? 1 : 0;
  }
  if (!line.dy) {
    if (y <= line.v1.y) {
      return line.dx < 0 ? 1 : 0;
    }
    return line.dx > 0 ? 1 : 0;
  }

  const dx = x - line.v1.x;
  const dy = y - line.v1.y;
  const left = fixedMul(line.dy >> FRACBITS, dx);
  const right = fixedMul(dy, line.dx >> FRACBITS);
  return right < left ? 0 : 1;
}

/**
 * @param {number[]} bbox [top, bottom, left, right]
 * @param {import('../game/Level.js').LevelLine} line
 * @returns {0|1|-1}
 */
export function boxOnLineSide(bbox, line) {
  let p1;
  let p2;

  switch (line.slopetype) {
    case ST_HORIZONTAL:
      p1 = bbox[BOXTOP] > line.v1.y ? 1 : 0;
      p2 = bbox[BOXBOTTOM] > line.v1.y ? 1 : 0;
      if (line.dx < 0) {
        p1 ^= 1;
        p2 ^= 1;
      }
      break;
    case ST_VERTICAL:
      p1 = bbox[BOXRIGHT] < line.v1.x ? 1 : 0;
      p2 = bbox[BOXLEFT] < line.v1.x ? 1 : 0;
      if (line.dy < 0) {
        p1 ^= 1;
        p2 ^= 1;
      }
      break;
    case ST_POSITIVE:
      p1 = pointOnLineSide(bbox[BOXLEFT], bbox[BOXTOP], line);
      p2 = pointOnLineSide(bbox[BOXRIGHT], bbox[BOXBOTTOM], line);
      break;
    case ST_NEGATIVE:
      p1 = pointOnLineSide(bbox[BOXRIGHT], bbox[BOXTOP], line);
      p2 = pointOnLineSide(bbox[BOXLEFT], bbox[BOXBOTTOM], line);
      break;
    default:
      return -1;
  }

  if (p1 === p2) {
    return p1;
  }
  return -1;
}

/**
 * Opening through a two-sided line (p_maputl.c — P_LineOpening).
 * @param {import('../game/Level.js').LevelLine} line
 */
export function lineOpening(line) {
  if (!line.backSector) {
    return { opentop: 0, openbottom: 0, openrange: 0, lowfloor: 0 };
  }

  const front = line.frontSector;
  const back = line.backSector;
  const opentop = front.ceilingHeight < back.ceilingHeight
    ? front.ceilingHeight
    : back.ceilingHeight;

  let openbottom;
  let lowfloor;
  if (front.floorHeight > back.floorHeight) {
    openbottom = front.floorHeight;
    lowfloor = back.floorHeight;
  } else {
    openbottom = back.floorHeight;
    lowfloor = front.floorHeight;
  }

  return {
    opentop,
    openbottom,
    openrange: opentop - openbottom,
    lowfloor,
  };
}

/**
 * @param {import('../game/Level.js').LevelLine} line
 */
export function makeDivline(line) {
  return {
    x: line.v1.x,
    y: line.v1.y,
    dx: line.dx,
    dy: line.dy,
  };
}

/**
 * Fraction along trace (v2) where it crosses div (v1).
 * Full 64-bit math — the >>8 FixedMul form in p_maputl.c loses precision on
 * axis-aligned traces and breaks small mobj hitscan (barrels).
 * @param {{ x: number, y: number, dx: number, dy: number }} trace
 * @param {{ x: number, y: number, dx: number, dy: number }} div
 */
export function interceptVector(trace, div) {
  const den = BigInt(trace.dx) * BigInt(div.dy) - BigInt(trace.dy) * BigInt(div.dx);
  if (den === 0n) {
    return 0;
  }
  const num = BigInt(div.x - trace.x) * BigInt(div.dy)
    - BigInt(div.y - trace.y) * BigInt(div.dx);
  return Number((num << 16n) / den);
}

/**
 * Point-on-side for a divline (p_maputl.c — P_PointOnDivlineSide).
 */
export function pointOnDivlineSide(x, y, line) {
  if (!line.dx) {
    if (x <= line.x) {
      return line.dy > 0 ? 1 : 0;
    }
    return line.dy < 0 ? 1 : 0;
  }
  if (!line.dy) {
    if (y <= line.y) {
      return line.dx < 0 ? 1 : 0;
    }
    return line.dx > 0 ? 1 : 0;
  }

  const dx = x - line.x;
  const dy = y - line.y;
  if (((line.dy ^ line.dx ^ dx ^ dy) & 0x80000000) !== 0) {
    if (((line.dy ^ dx) & 0x80000000) !== 0) {
      return 1;
    }
    return 0;
  }

  const left = fixedMul(line.dy >> 8, dx >> 8);
  const right = fixedMul(dy >> 8, line.dx >> 8);
  return right < left ? 0 : 1;
}

/**
 * Compute line bbox and slopetype (p_setup.c).
 * @param {import('../game/Level.js').LevelLine} line
 */
export function calcLineBounds(line) {
  const { v1, v2, dx, dy } = line;

  if (!dy) {
    line.slopetype = ST_HORIZONTAL;
  } else if (!dx) {
    line.slopetype = ST_VERTICAL;
  } else if (fixedMul(dy, dx) > 0) {
    line.slopetype = ST_POSITIVE;
  } else {
    line.slopetype = ST_NEGATIVE;
  }

  line.bbox = [0, 0, 0, 0];
  if (v1.x < v2.x) {
    line.bbox[BOXLEFT] = v1.x;
    line.bbox[BOXRIGHT] = v2.x;
  } else {
    line.bbox[BOXLEFT] = v2.x;
    line.bbox[BOXRIGHT] = v1.x;
  }
  if (v1.y < v2.y) {
    line.bbox[BOXBOTTOM] = v1.y;
    line.bbox[BOXTOP] = v2.y;
  } else {
    line.bbox[BOXBOTTOM] = v2.y;
    line.bbox[BOXTOP] = v1.y;
  }
  line.validcount = 0;
}
