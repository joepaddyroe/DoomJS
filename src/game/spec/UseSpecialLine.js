import { evDoDoor, evVerticalDoor, VLDoorType } from './Doors.js';
import { changeSwitchTexture } from './SwitchList.js';
import { evDoFloor, FloorMoveType } from './FloorMovers.js';
import { evDoPlat, PlatType } from './Plats.js';

/** @typedef {import('./Doors.js').SpecContext} SpecContext */

/**
 * Activate a use line (p_switch.c — P_UseSpecialLine).
 * @param {import('../Mobj.js').Mobj} thing
 * @param {import('../Level.js').LevelLine} line
 * @param {number} side
 * @param {SpecContext} ctx
 * @returns {boolean}
 */
export function useSpecialLine(thing, line, side, ctx) {
  if (side) {
    switch (line.special) {
      case 124:
        break;
      default:
        return false;
    }
  }

  if (!thing.playerObject) {
    return false;
  }

  const player = thing.playerObject;

  switch (line.special) {
    case 11:
      if (changeSwitchTexture(line, ctx, false)) {
        ctx.onExitLevel?.(false);
      }
      return true;

    case 51:
      if (changeSwitchTexture(line, ctx, false)) {
        ctx.onExitLevel?.(true);
      }
      return true;

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
      if (evDoDoor(ctx, line, VLDoorType.normal)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 50:
      if (evDoDoor(ctx, line, VLDoorType.close)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 103:
      if (evDoDoor(ctx, line, VLDoorType.open)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 63:
      if (evDoDoor(ctx, line, VLDoorType.normal)) {
        changeSwitchTexture(line, ctx, true);
      }
      return true;

    case 111:
      if (evDoDoor(ctx, line, VLDoorType.blazeRaise)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 112:
      if (evDoDoor(ctx, line, VLDoorType.blazeOpen)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 113:
      if (evDoDoor(ctx, line, VLDoorType.blazeClose)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 23:
      if (evDoFloor(ctx, line, FloorMoveType.lowerToLowest)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 101:
      if (evDoFloor(ctx, line, FloorMoveType.raiseFloor)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 102:
      if (evDoFloor(ctx, line, FloorMoveType.lowerToHighest)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 20:
      if (evDoPlat(ctx, line, PlatType.raiseAndChange)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    case 14:
    case 15:
      if (evDoPlat(ctx, line, PlatType.raiseToNearestAndChange)) {
        changeSwitchTexture(line, ctx, false);
      }
      return true;

    default:
      return false;
  }
}
