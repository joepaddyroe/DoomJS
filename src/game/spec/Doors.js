import { FRACUNIT } from '../../core/renderConstants.js';
import { VDOORSPEED, VDOORWAIT } from '../../core/gameConstants.js';
import { movePlaneWithSectorChange } from './PlaneMovement.js';
import {
  doorSectorForUseLine,
  findLowestCeilingSurrounding,
  findSectorFromLineTag,
} from './SectorQuery.js';

/** @typedef {import('../Level.js').LevelSector} LevelSector */
/** @typedef {import('../Level.js').LevelLine} LevelLine */
/** @typedef {import('./ThinkerList.js').ThinkerList} ThinkerList */

/** @enum {number} */
export const VLDoorType = {
  normal: 0,
  close30ThenOpen: 1,
  close: 2,
  open: 3,
  raiseIn5Mins: 4,
  blazeRaise: 5,
  blazeOpen: 6,
  blazeClose: 7,
};

/**
 * @typedef {Object} SpecContext
 * @property {ThinkerList} thinkers
 * @property {LevelSector[]} sectors
 * @property {import('../../render/TextureManager.js').TextureManager} textures
 * @property {Map<number, number>} switchPairs
 * @property {import('../../audio/SoundSystem.js').SoundSystem|null} [sound]
 * @property {import('../MapCollision.js').MapCollision|null} [collision]
 * @property {(secret?: boolean) => void} [onExitLevel]
 * @property {import('../Mobj.js').Mobj|null} [playerMo]
 */

/** @typedef {SpecContext} DoorContext */

/**
 * @param {DoorContext} ctx
 * @param {LevelSector} sec
 */
function playerOccupiesSector(ctx, sec) {
  const mo = ctx.playerMo;
  if (!mo) {
    return false;
  }
  return mo.subsector?.sector === sec;
}

export class VerticalDoorThinker {
  /**
   * @param {LevelSector} sector
   * @param {number} type VLDoorType
   */
  constructor(sector, type) {
    this.sector = sector;
    this.type = type;
    /** @type {number} 0 wait, 1 up, -1 down, 2 initial wait */
    this.direction = 1;
    this.speed = VDOORSPEED;
    this.topwait = VDOORWAIT;
    this.topcountdown = 0;
    this.topheight = 0;
    /** @type {DoorContext|null} */
    this.context = null;
  }

  think() {
    if (this.context) {
      tickVerticalDoor(this, this.context);
    }
  }
}

/**
 * @param {VerticalDoorThinker} door
 * @param {DoorContext} ctx
 */
export function tickVerticalDoor(door, ctx) {
  const sec = door.sector;

  switch (door.direction) {
    case 0:
      if (playerOccupiesSector(ctx, sec)) {
        door.topcountdown = door.topwait;
        break;
      }
      if (--door.topcountdown <= 0) {
        if (door.type === VLDoorType.blazeRaise || door.type === VLDoorType.normal) {
          door.direction = -1;
          playDoorSound(ctx.sound, 'dorcls');
        } else if (door.type === VLDoorType.close30ThenOpen) {
          door.direction = 1;
          playDoorSound(ctx.sound, 'doropn');
        }
      }
      break;

    case 2:
      if (--door.topcountdown <= 0 && door.type === VLDoorType.raiseIn5Mins) {
        door.direction = 1;
        door.type = VLDoorType.normal;
        playDoorSound(ctx.sound, 'doropn');
      }
      break;

    case -1: {
      if (playerOccupiesSector(ctx, sec)) {
        door.direction = 1;
        playDoorSound(ctx.sound, 'doropn');
        break;
      }
      const res = movePlaneWithSectorChange(ctx.collision, sec, door.speed, sec.floorHeight, 1, -1);
      if (res === 'pastdest') {
        if (door.type === VLDoorType.blazeRaise
          || door.type === VLDoorType.blazeClose
          || door.type === VLDoorType.normal
          || door.type === VLDoorType.close) {
          sec.specialdata = null;
          ctx.thinkers.remove(door);
        } else if (door.type === VLDoorType.close30ThenOpen) {
          door.direction = 0;
          door.topcountdown = 35 * 30;
        }
      }
      break;
    }

    case 1: {
      const res = movePlaneWithSectorChange(ctx.collision, sec, door.speed, door.topheight, 1, 1);
      if (res === 'pastdest') {
        if (door.type === VLDoorType.blazeRaise || door.type === VLDoorType.normal) {
          door.direction = 0;
          door.topcountdown = door.topwait;
        } else {
          sec.specialdata = null;
          ctx.thinkers.remove(door);
        }
      }
      break;
    }

    default:
      break;
  }
}

/**
 * @param {DoorContext} ctx
 * @param {LevelLine} line
 * @param {import('../Player.js').Player|null} player
 * @param {number} side
 */
export function evVerticalDoor(ctx, line, player, side) {
  const sec = doorSectorForUseLine(line, side);
  if (!sec) {
    return;
  }

  if (sec.specialdata) {
    const door = sec.specialdata;
    if (line.special === 1 || line.special === 26 || line.special === 27 || line.special === 28) {
      if (door.direction === -1) {
        door.direction = 1;
      } else if (player) {
        door.direction = -1;
      }
    }
    return;
  }

  playDoorSound(ctx.sound, 'doropn');

  const door = spawnDoor(ctx, sec, VLDoorType.normal);
  door.direction = 1;
  door.speed = VDOORSPEED;
  door.topwait = VDOORWAIT;

  switch (line.special) {
    case 1:
    case 26:
    case 27:
    case 28:
      door.type = VLDoorType.normal;
      break;
    case 31:
    case 32:
    case 33:
    case 34:
      door.type = VLDoorType.open;
      line.special = 0;
      break;
    case 117:
      door.type = VLDoorType.blazeRaise;
      door.speed = VDOORSPEED * 4;
      break;
    case 118:
      door.type = VLDoorType.blazeOpen;
      line.special = 0;
      door.speed = VDOORSPEED * 4;
      break;
    default:
      door.type = VLDoorType.normal;
      break;
  }

  door.topheight = findLowestCeilingSurrounding(sec) - 4 * FRACUNIT;
}

/**
 * @param {DoorContext} ctx
 * @param {LevelLine} line
 * @param {number} type VLDoorType
 */
export function evDoDoor(ctx, line, type) {
  let secnum = -1;
  let activated = false;

  while ((secnum = findSectorFromLineTag(line, ctx.sectors, secnum)) >= 0) {
    const sec = ctx.sectors[secnum];
    if (sec.specialdata) {
      continue;
    }

    activated = true;
    const door = spawnDoor(ctx, sec, type);
    configureDoor(door, sec, type, ctx.sound);
  }

  return activated;
}

/**
 * @param {DoorContext} ctx
 * @param {LevelSector} sec
 * @param {number} type
 */
function spawnDoor(ctx, sec, type) {
  const door = new VerticalDoorThinker(sec, type);
  door.context = ctx;
  sec.specialdata = door;
  ctx.thinkers.add(door);
  return door;
}

/**
 * @param {VerticalDoorThinker} door
 * @param {LevelSector} sec
 * @param {number} type
 * @param {import('../../audio/SoundSystem.js').SoundSystem|null} sound
 */
function configureDoor(door, sec, type, sound) {
  door.speed = VDOORSPEED;
  door.topwait = VDOORWAIT;

  switch (type) {
    case VLDoorType.blazeClose:
      door.topheight = findLowestCeilingSurrounding(sec) - 4 * FRACUNIT;
      door.direction = -1;
      door.speed = VDOORSPEED * 4;
      playDoorSound(sound, 'dorcls');
      break;

    case VLDoorType.close:
      door.topheight = findLowestCeilingSurrounding(sec) - 4 * FRACUNIT;
      door.direction = -1;
      playDoorSound(sound, 'dorcls');
      break;

    case VLDoorType.close30ThenOpen:
      door.topheight = sec.ceilingHeight;
      door.direction = -1;
      playDoorSound(sound, 'dorcls');
      break;

    case VLDoorType.blazeRaise:
    case VLDoorType.blazeOpen:
      door.direction = 1;
      door.topheight = findLowestCeilingSurrounding(sec) - 4 * FRACUNIT;
      door.speed = VDOORSPEED * 4;
      if (door.topheight !== sec.ceilingHeight) {
        playDoorSound(sound, 'doropn');
      }
      break;

    case VLDoorType.normal:
    case VLDoorType.open:
    default:
      door.direction = 1;
      door.topheight = findLowestCeilingSurrounding(sec) - 4 * FRACUNIT;
      if (door.topheight !== sec.ceilingHeight) {
        playDoorSound(sound, 'doropn');
      }
      break;
  }
}

/**
 * @param {import('../../audio/SoundSystem.js').SoundSystem|null} sound
 * @param {'doropn' | 'dorcls'} id
 */
function playDoorSound(sound, id) {
  sound?.start(id);
}
