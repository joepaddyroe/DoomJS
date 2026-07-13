import { ANG90 } from '../../core/angles.js';
import { gameRandom } from '../GameRandom.js';
import { MF_JUSTATTACKED, MF_SHOOTABLE, MF_SOLID, MF_AMBUSH } from '../mobjFlags.js';
import { MISSILERANGE } from '../weapons/weaponConstants.js';
import { damageMobj, setMobjState } from './MobjCombat.js';
import {
  checkMeleeRange,
  checkMissileRange,
  DI_NODIR,
  enemyMove,
  newChaseDir,
} from './EnemyMove.js';
import { lookForPlayer, checkSight } from './Sight.js';
import { pointToAngle2 } from '../../math/viewMath.js';
import { createTrigTables } from '../../math/tables.js';
import {
  playActiveSound,
  playDeathSound,
  playPainSound,
  playSeeSound,
} from './MonsterSfx.js';
import { radiusAttack } from './RadiusAttack.js';

const tables = createTrigTables();

/**
 * @typedef {Object} MonsterContext
 * @property {import('../Player.js').Player} player
 * @property {import('../MapCollision.js').MapCollision} collision
 * @property {import('../Hitscan.js').Hitscan} hitscan
 * @property {import('./MissileManager.js').MissileManager} missiles
 * @property {import('../MapThingSpawner.js').MapThingMobj[]} things
 * @property {import('../../audio/SoundSystem.js').SoundSystem|null} [sound]
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

  const soundTarg = actor.subsector?.sector?.soundtarget;
  if (soundTarg && (soundTarg.flags & MF_SHOOTABLE)) {
    actor.target = soundTarg;
    if (!(actor.flags & MF_AMBUSH) || checkSight(actor, soundTarg, ctx.collision)) {
      playSeeSound(actor.monsterDef.seeSound, ctx.sound);
      if (actor.monsterDef.seeState) {
        enterState(actor, actor.monsterDef.seeState, ctx);
      }
      return;
    }
  }

  if (!lookForPlayer(actor, ctx.player, ctx.collision, false)) {
    return;
  }

  playSeeSound(actor.monsterDef.seeSound, ctx.sound);
  if (actor.monsterDef.seeState) {
    enterState(actor, actor.monsterDef.seeState, ctx);
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

  if (arch.activeSound && gameRandom() < 3) {
    playActiveSound(arch.activeSound, ctx.sound);
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 */
function aFaceTarget(actor) {
  if (!actor.target) {
    return;
  }
  actor.flags &= ~MF_AMBUSH;
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
  ctx.sound?.start('pistol');
  let angle = actor.angle;
  const slope = ctx.collision.aimLineAttack(actor, angle, MISSILERANGE);
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
    ctx.sound?.start(actor.monsterDef.attackSound ?? 'claw');
    const damage = (gameRandom() % 8 + 1) * 3;
    damageMobj(actor.target, actor, actor, damage, ctx.player, ctx.collision.dropCtx);
    return;
  }

  ctx.missiles.spawn('troopshot', actor, actor.target);
}

/** @param {import('../MapThingSpawner.js').MapThingMobj} actor */
function aFall(actor) {
  actor.flags &= ~MF_SOLID;
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aPain(actor, ctx) {
  playPainSound(actor.monsterDef.painSound, ctx.sound);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aScream(actor, ctx) {
  playDeathSound(actor.monsterDef.deathSound, ctx.sound);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aXScream(actor, ctx) {
  ctx.sound?.start('slop');
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aExplode(actor, ctx) {
  radiusAttack(actor, actor.target ?? null, 128, ctx.things, ctx.collision, ctx.player);
}

const ACTIONS = {
  A_Look: aLook,
  A_Chase: aChase,
  A_FaceTarget: aFaceTarget,
  A_PosAttack: aPosAttack,
  A_TroopAttack: aTroopAttack,
  A_Pain: aPain,
  A_Scream: aScream,
  A_XScream: aXScream,
  A_Fall: aFall,
  A_Explode: aExplode,
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
