import { evDoDoor, evVerticalDoor, VLDoorType } from './Doors.js';

/** @typedef {import('./Doors.js').DoorContext} DoorContext */

/**
 * Activate a use line (p_switch.c — P_UseSpecialLine).
 * @param {import('../Mobj.js').Mobj} thing
 * @param {import('../Level.js').LevelLine} line
 * @param {number} side
 * @param {DoorContext} ctx
 * @returns {boolean}
 */
export function useSpecialLine(thing, line, side, ctx) {
  if (side) {
    return false;
  }

  if (!thing.playerObject) {
    return false;
  }

  const player = thing.playerObject;

  switch (line.special) {
    case 1:
    case 26:
    case 27:
    case 28:
    case 31:
    case 32:
    case 33:
    case 34:
    case 117:
    case 118:
      evVerticalDoor(ctx, line, player, side);
      return true;

    case 29:
      evDoDoor(ctx, line, VLDoorType.normal);
      return true;

    case 50:
      evDoDoor(ctx, line, VLDoorType.close);
      return true;

    case 103:
      evDoDoor(ctx, line, VLDoorType.open);
      return true;

    case 111:
      evDoDoor(ctx, line, VLDoorType.blazeRaise);
      return true;

    case 112:
      evDoDoor(ctx, line, VLDoorType.blazeOpen);
      return true;

    case 113:
      evDoDoor(ctx, line, VLDoorType.blazeClose);
      return true;

    default:
      return false;
  }
}
