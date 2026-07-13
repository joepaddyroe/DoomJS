import { gameRandom } from './GameRandom.js';
import { spawnPickupThing } from './MapThingSpawner.js';

/**
 * Drop an item on monster death (p_mobj.c — P_DropItem).
 *
 * @param {import('./MapThingSpawner.js').MapThingMobj} source
 * @param {import('./Level.js').Level} level
 * @param {import('./MapThingSpawner.js').MapThingMobj[]} things
 */
export function tryDropItem(source, level, things) {
  const dropType = source.monsterDef?.dropItem;
  const dropChance = source.monsterDef?.dropChance ?? 0;
  if (!dropType) {
    return;
  }

  if ((gameRandom() & 0xff) < dropChance) {
    return;
  }

  const pickup = spawnPickupThing(level, dropType, source.x, source.y);
  if (pickup) {
    things.push(pickup);
  }
}
