import { fineAngleIndex } from '../../core/angles.js';
import { FRACUNIT } from '../../core/renderConstants.js';
import { gameRandom } from '../GameRandom.js';
import { tryDropItem } from '../ItemDrop.js';
import {
  MF_CORPSE,
  MF_DROPOFF,
  MF_FLOAT,
  MF_JUSTHIT,
  MF_SHOOTABLE,
  MF_SKULLFLY,
  MF_SOLID,
} from '../mobjFlags.js';
import { fixedMul } from '../../math/fixed.js';
import { createTrigTables } from '../../math/tables.js';
import { pointToAngle2 } from '../../math/viewMath.js';
import { MONSTER_ARCHETYPES } from './monsterInfo.js';

const tables = createTrigTables();

/** @type {((target: import('../MapThingSpawner.js').MapThingMobj, stateName: string, ctx: object) => void)|null} */
let enterMobjState = null;

/**
 * Register death/pain state entry with action functions (MonsterThink).
 * @param {typeof enterMobjState} fn
 */
export function registerEnterMobjState(fn) {
  enterMobjState = fn;
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} mobj
 * @param {string} stateName
 */
export function setMobjState(mobj, stateName) {
  const arch = MONSTER_ARCHETYPES[mobj.monsterType];
  if (!arch) {
    return;
  }

  const state = arch.states[stateName];
  if (!state) {
    return;
  }

  mobj.state = stateName;
  mobj.sprite = state.sprite;
  mobj.frame = state.frame;
  mobj.fullbright = state.fullbright ?? false;
  mobj.stateTics = state.tics;
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} target
 * @param {import('../Mobj.js').Mobj|null} source
 * @param {object|null} [deathCtx]
 */
export function killMobj(target, source, deathCtx = null) {
  const arch = MONSTER_ARCHETYPES[target.monsterType];
  if (!arch) {
    return;
  }

  target.flags &= ~(MF_SHOOTABLE | MF_FLOAT | MF_SKULLFLY);
  target.flags |= MF_CORPSE | MF_DROPOFF;
  target.flags &= ~MF_SOLID;
  if (target.monsterType !== 'barrel') {
    target.height = (target.height / 4) | 0;
  }

  const stateName = target.health < -arch.spawnhealth && arch.xdeathState
    ? arch.xdeathState
    : arch.deathState;

  target.pendingState = null;

  if (enterMobjState && deathCtx) {
    enterMobjState(target, stateName, deathCtx);
  } else {
    setMobjState(target, stateName);
  }
  target.stateEntered = true;

  target.stateTics -= gameRandom() & 3;
  if (target.stateTics < 1) {
    target.stateTics = 1;
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} target
 * @param {import('../Mobj.js').Mobj|null} inflictor
 * @param {import('../Mobj.js').Mobj|null} source
 * @param {number} damage
 * @param {import('../Player.js').Player} player
 * @param {{ level: import('../Level.js').Level, things: import('../MapThingSpawner.js').MapThingMobj[] }|null} [dropCtx]
 * @param {object|null} [deathCtx]
 */
export function damageMobj(target, inflictor, source, damage, player, dropCtx = null, deathCtx = null) {
  if (!(target.flags & MF_SHOOTABLE)) {
    return;
  }
  if (target.health <= 0) {
    return;
  }

  if (target.playerObject) {
    // Always damage the player owning the hit mobj (not the caller’s “local player”
    // context — that breaks net when you shoot another player).
    const victim = target.playerObject;
    let actual = damage;
    if (victim.armortype) {
      let saved = victim.armortype === 1 ? (damage / 3) | 0 : (damage / 2) | 0;
      if (victim.armorpoints <= saved) {
        saved = victim.armorpoints;
        victim.armortype = 0;
      }
      victim.armorpoints -= saved;
      actual -= saved;
    }
    victim.health -= actual;
    if (victim.health < 0) {
      victim.health = 0;
    }
    victim.mo.health = victim.health;
    victim.damagecount += actual;
    if (victim.damagecount > 100) {
      victim.damagecount = 100;
    }
    if (source && source !== victim.mo) {
      victim.attacker = source;
    }
    return;
  }

  if (inflictor && !(target.flags & (1 << 6))) {
    const ang = pointToAngle2(
      inflictor.x,
      inflictor.y,
      target.x,
      target.y,
      tables.tantoangle,
    );
    const thrust = ((damage * (FRACUNIT >> 3) * 100) / target.mass) | 0;
    const idx = fineAngleIndex(ang);
    target.momx += fixedMul(thrust, tables.finecosine[idx]);
    target.momy += fixedMul(thrust, tables.finesine[idx]);
  }

  target.health -= damage;
  if (target.health <= 0) {
    killMobj(target, source, deathCtx);
    if (dropCtx) {
      tryDropItem(target, dropCtx.level, dropCtx.things);
    }
    return;
  }

  const arch = MONSTER_ARCHETYPES[target.monsterType];
  if (!arch) {
    return;
  }

  if (gameRandom() < arch.painchance && arch.painState) {
    target.flags |= MF_JUSTHIT;
    target.pendingState = arch.painState;
  } else if (arch.seeState) {
    target.pendingState = arch.seeState;
  }

  target.reactiontime = 0;

  if (source && source !== target.playerObject?.mo) {
    target.target = source;
    target.threshold = 0;
  }
}
