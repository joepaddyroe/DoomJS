import { ANG90 } from '../../core/angles.js';
import { MELEERANGE } from '../../core/gameConstants.js';
import { gameRandom } from '../GameRandom.js';
import { MF_JUSTATTACKED, MF_SHOOTABLE, MF_SOLID } from '../mobjFlags.js';
import { MISSILERANGE } from '../weapons/weaponConstants.js';
import { damageMobj, setMobjState } from './MobjCombat.js';
import {
  checkMeleeRange,
  checkMissileRange,
  DI_NODIR,
  enemyMove,
  newChaseDir,
} from './EnemyMove.js';
import { lookForPlayer, checkSight, approxDistance } from './Sight.js';
import { pointToAngle2 } from '../../math/viewMath.js';
import { createTrigTables } from '../../math/tables.js';

const tables = createTrigTables();

/**
 * @typedef {Object} MonsterContext
 * @property {import('../Player.js').Player} player
 * @property {import('../MapCollision.js').MapCollision} collision
 * @property {import('../Hitscan.js').Hitscan} hitscan
 */

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {string} stateName
 * @param {MonsterContext} ctx
 */
function enterState(actor, stateName, ctx) {
  setMobjState(actor, stateName);
  const state = actor.monsterDef.states[stateName];
  if (state?.action) {
    const fn = ACTIONS[state.action];
    if (fn) {
      fn(actor, ctx);
    }
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aLook(actor, ctx) {
  actor.threshold = 0;

  if (actor.target
    && actor.target.health > 0
    && (actor.target.flags & MF_SHOOTABLE)
    && checkSight(actor, actor.target, ctx.collision)) {
    enterState(actor, actor.monsterDef.seeState, ctx);
    return;
  }

  const mo = ctx.player.mo;
  const dist = approxDistance(mo.x - actor.x, mo.y - actor.y);
  const allaround = dist < MELEERANGE * 4;

  if (lookForPlayer(actor, ctx.player, ctx.collision, allaround)) {
    const arch = actor.monsterDef;
    if (arch.seeState) {
      enterState(actor, arch.seeState, ctx);
    }
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aChase(actor, ctx) {
  if (actor.reactiontime > 0) {
    actor.reactiontime--;
  }

  if (actor.threshold > 0) {
    if (!actor.target || actor.target.health <= 0) {
      actor.threshold = 0;
    } else {
      actor.threshold--;
    }
  }

  if (actor.movedir < 8) {
    actor.angle &= (7 << 29);
    const delta = (actor.angle - (actor.movedir << 29)) | 0;
    if (delta > 0) {
      actor.angle = (actor.angle - ANG90 / 2) >>> 0;
    } else if (delta < 0) {
      actor.angle = (actor.angle + ANG90 / 2) >>> 0;
    }
  }

  if (!actor.target || !(actor.target.flags & MF_SHOOTABLE)) {
    if (lookForPlayer(actor, ctx.player, ctx.collision, true)) {
      return;
    }
    enterState(actor, actor.monsterDef.spawnState, ctx);
    return;
  }

  if (actor.flags & MF_JUSTATTACKED) {
    actor.flags &= ~MF_JUSTATTACKED;
    newChaseDir(actor, ctx.collision);
    return;
  }

  const arch = actor.monsterDef;

  if (arch.meleeState && checkMeleeRange(actor, ctx.collision)) {
    enterState(actor, arch.meleeState, ctx);
    return;
  }

  if (arch.missileState && actor.movecount === 0) {
    if (checkMissileRange(actor, ctx.collision)) {
      enterState(actor, arch.missileState, ctx);
      actor.flags |= MF_JUSTATTACKED;
      return;
    }
  }

  if (--actor.movecount < 0 || !enemyMove(actor, ctx.collision)) {
    newChaseDir(actor, ctx.collision);
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 */
function aFaceTarget(actor) {
  if (!actor.target) {
    return;
  }
  actor.angle = pointToAngle2(
    actor.x,
    actor.y,
    actor.target.x,
    actor.target.y,
    tables.tantoangle,
  );
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aPosAttack(actor, ctx) {
  if (!actor.target) {
    return;
  }

  aFaceTarget(actor);
  let angle = actor.angle;
  const slope = 0;
  angle = (angle + ((gameRandom() - gameRandom()) << 20)) >>> 0;
  const damage = ((gameRandom() % 5) + 1) * 3;
  ctx.hitscan.lineAttack(actor, angle, MISSILERANGE, slope, damage);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aTroopAttack(actor, ctx) {
  if (!actor.target) {
    return;
  }

  aFaceTarget(actor);
  if (checkMeleeRange(actor, ctx.collision)) {
    const damage = (gameRandom() % 8 + 1) * 3;
    damageMobj(actor.target, actor, actor, damage, ctx.player);
  }
}

/** @param {import('../MapThingSpawner.js').MapThingMobj} actor */
function aFall(actor) {
  actor.flags &= ~MF_SOLID;
}

const ACTIONS = {
  A_Look: aLook,
  A_Chase: aChase,
  A_FaceTarget: aFaceTarget,
  A_PosAttack: aPosAttack,
  A_TroopAttack: aTroopAttack,
  A_Pain: () => {},
  A_Scream: () => {},
  A_Fall: aFall,
};

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function tickMonsterState(actor, ctx) {
  if (actor.pendingState) {
    const next = actor.pendingState;
    actor.pendingState = null;
    enterState(actor, next, ctx);
  }

  if (!actor.stateEntered) {
    actor.stateEntered = true;
    enterState(actor, actor.state, ctx);
    return;
  }

  if (actor.stateTics === -1) {
    return;
  }

  actor.stateTics--;
  if (actor.stateTics > 0) {
    return;
  }

  const state = actor.monsterDef.states[actor.state];
  if (!state?.next) {
    actor.stateTics = -1;
    if (actor.monsterType === 'barrel' && actor.state === 'BEXP5') {
      actor.removed = true;
    }
    return;
  }

  enterState(actor, state.next, ctx);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj[]} things
 * @param {MonsterContext} ctx
 */
export function tickMonsters(things, ctx) {
  for (const thing of things) {
    if (!thing.monsterType) {
      continue;
    }
    if (thing.removed) {
      continue;
    }

    tickMonsterState(thing, ctx);

    if (thing.momx || thing.momy) {
      ctx.collision.xyMovement(thing, null);
    }
  }
}
