import { FRACBITS, FRACUNIT } from '../../core/renderConstants.js';
import { MF_CORPSE } from '../mobjFlags.js';

const LOG_INTERVAL = 35;

let tickCounter = 0;

/**
 * Corpse Z diagnostics — enable by default; disable in console:
 * `localStorage.setItem('doomjs-corpse-debug', '0')`
 * @returns {boolean}
 */
export function isCorpseDebugEnabled() {
  if (typeof localStorage === 'undefined') {
    return true;
  }
  return localStorage.getItem('doomjs-corpse-debug') !== '0';
}

/**
 * Log corpses whose Z differs from sector floor or tracked floorz.
 * @param {import('../MapThingSpawner.js').MapThingMobj[]} things
 */
export function tickCorpseDebug(things) {
  if (!isCorpseDebugEnabled()) {
    return;
  }

  tickCounter++;
  if (tickCounter % LOG_INTERVAL !== 0) {
    return;
  }

  for (const thing of things) {
    if (!(thing.flags & MF_CORPSE) || thing.removed) {
      continue;
    }

    const sectorFloor = thing.subsector?.sector?.floorHeight;
    if (sectorFloor === undefined) {
      continue;
    }

    const zDelta = thing.z - sectorFloor;
    const floorzDelta = thing.floorz - sectorFloor;
    const onFloor = thing.z === thing.floorz;

    if (Math.abs(zDelta) <= FRACUNIT && Math.abs(floorzDelta) <= FRACUNIT && onFloor) {
      continue;
    }

    const toMap = (v) => v >> FRACBITS;
    const momz = thing.momz ?? 0;

    console.log(
      `[corpse] ${thing.monsterType ?? 'thing'}`
      + ` @ (${toMap(thing.x)},${toMap(thing.y)})`
      + ` z=${toMap(thing.z)} floorz=${toMap(thing.floorz)} sector=${toMap(sectorFloor)}`
      + ` Δz=${toMap(zDelta)} Δfloorz=${toMap(floorzDelta)}`
      + ` onFloor=${onFloor}`
      + ` mom=(${thing.momx >> FRACBITS},${thing.momy >> FRACBITS},${momz >> FRACBITS})`,
    );
  }
}
