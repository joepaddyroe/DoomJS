import { evDoDoor, VLDoorType } from './Doors.js';
import { evDoFloor, FloorMoveType } from './FloorMovers.js';

/** @typedef {import('./Doors.js').SpecContext} SpecContext */

/**
 * @param {SpecContext} ctx
 * @param {import('../Level.js').LevelLine} line
 * @param {number} type
 */
function crossDoor(ctx, line, type) {
  if (evDoDoor(ctx, line, type)) {
    line.special = 0;
  }
}

/**
 * @param {SpecContext} ctx
 * @param {import('../Level.js').LevelLine} line
 * @param {number} floorType
 */
function crossFloor(ctx, line, floorType) {
  if (evDoFloor(ctx, line, floorType)) {
    line.special = 0;
  }
}

/**
 * Line specials triggered by crossing (p_spec.c — P_CrossSpecialLine).
 *
 * @param {import('../Mobj.js').Mobj} thing
 * @param {import('../Level.js').LevelLine} line
 * @param {number} _oldSide
 * @param {SpecContext} ctx
 */
export function crossSpecialLine(thing, line, _oldSide, ctx) {
  if (!thing.playerObject) {
    return;
  }

  switch (line.special) {
    case 2:
      crossDoor(ctx, line, VLDoorType.open);
      break;

    case 3:
      crossDoor(ctx, line, VLDoorType.close);
      break;

    case 4:
    case 90:
      crossDoor(ctx, line, VLDoorType.normal);
      break;

    case 16:
    case 76:
      crossDoor(ctx, line, VLDoorType.close30ThenOpen);
      break;

    case 38:
    case 82:
      crossFloor(ctx, line, FloorMoveType.lowerToLowest);
      break;

    case 52:
      ctx.onExitLevel?.(false);
      break;

    case 108:
    case 105:
      crossDoor(ctx, line, VLDoorType.blazeRaise);
      break;

    case 109:
    case 106:
      crossDoor(ctx, line, VLDoorType.blazeOpen);
      break;

    case 110:
    case 107:
      crossDoor(ctx, line, VLDoorType.blazeClose);
      break;

    case 124:
      line.special = 0;
      ctx.onExitLevel?.(true);
      break;

    default:
      break;
  }
}
