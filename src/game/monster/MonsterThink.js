import { ANG90, fineAngleIndex } from '../../core/angles.js';
import { FRACUNIT } from '../../core/renderConstants.js';
import { gameRandom } from '../GameRandom.js';
import { MF_JUSTATTACKED, MF_SHOOTABLE, MF_SKULLFLY, MF_SOLID, MF_AMBUSH } from '../mobjFlags.js';
import { MISSILERANGE } from '../weapons/weaponConstants.js';
import { damageMobj, registerEnterMobjState, setMobjState } from './MobjCombat.js';
import {
  checkMeleeRange,
  checkMissileRange,
  DI_NODIR,
  enemyMove,
  newChaseDir,
} from './EnemyMove.js';
import { approxDistance, lookForPlayer, lookForPlayers, checkSight } from './Sight.js';
import { pointToAngle2 } from '../../math/viewMath.js';
import { createTrigTables } from '../../math/tables.js';
import { fixedMul } from '../../math/fixed.js';
import {
  playActiveSound,
  playDeathSound,
  playPainSound,
  playSeeSound,
} from './MonsterSfx.js';
import { radiusAttack } from './RadiusAttack.js';
import { evDoFloor, FloorMoveType } from '../spec/FloorMovers.js';

const tables = createTrigTables();
const SKULLSPEED = 20 * FRACUNIT;

/**
 * @typedef {Object} MonsterContext
 * @property {import('../Player.js').Player} player
 * @property {(import('../Player.js').Player|null)[]} [players]
 * @property {import('../MapCollision.js').MapCollision} collision
 * @property {import('../Hitscan.js').Hitscan} hitscan
 * @property {import('./MissileManager.js').MissileManager} missiles
 * @property {import('../MapThingSpawner.js').MapThingMobj[]} things
 * @property {import('../../audio/SoundSystem.js').SoundSystem|null} [sound]
 * @property {string} [mapName]
 * @property {import('../spec/Doors.js').SpecContext|null} [specCtx]
 * @property {() => void} [onExitLevel]
 */

/** @param {MonsterContext} ctx @param {boolean} allaround */
function tryLookForPlayers(actor, ctx, allaround) {
  if (ctx.players?.length) {
    return lookForPlayers(actor, ctx.players, ctx.collision, allaround);
  }
  return lookForPlayer(actor, ctx.player, ctx.collision, allaround);
}

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

  if (!tryLookForPlayers(actor, ctx, false)) {
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
    if (tryLookForPlayers(actor, ctx, true)) {
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
    damageMobj(actor.target, actor, actor, damage, ctx.player, ctx.collision.dropCtx, ctx);
    return;
  }

  ctx.missiles.spawn('troopshot', actor, actor.target);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aSPosAttack(actor, ctx) {
  if (!actor.target) {
    return;
  }

  ctx.sound?.start('shotgn');
  aFaceTarget(actor);
  const bangle = actor.angle;
  const slope = ctx.collision.aimLineAttack(actor, bangle, MISSILERANGE);
  for (let i = 0; i < 3; i++) {
    const angle = (bangle + ((gameRandom() - gameRandom()) << 20)) >>> 0;
    const damage = ((gameRandom() % 5) + 1) * 3;
    ctx.hitscan.lineAttack(actor, angle, MISSILERANGE, slope, damage);
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aSargAttack(actor, ctx) {
  if (!actor.target) {
    return;
  }

  aFaceTarget(actor);
  if (checkMeleeRange(actor, ctx.collision)) {
    const damage = ((gameRandom() % 10) + 1) * 4;
    damageMobj(actor.target, actor, actor, damage, ctx.player, ctx.collision.dropCtx, ctx);
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aHeadAttack(actor, ctx) {
  if (!actor.target) {
    return;
  }

  aFaceTarget(actor);
  if (checkMeleeRange(actor, ctx.collision)) {
    const damage = (gameRandom() % 6 + 1) * 10;
    damageMobj(actor.target, actor, actor, damage, ctx.player, ctx.collision.dropCtx, ctx);
    return;
  }

  ctx.missiles.spawn('headshot', actor, actor.target);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aCyberAttack(actor, ctx) {
  if (!actor.target) {
    return;
  }

  aFaceTarget(actor);
  ctx.missiles.spawn('rocket', actor, actor.target);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aBruisAttack(actor, ctx) {
  if (!actor.target) {
    return;
  }

  if (checkMeleeRange(actor, ctx.collision)) {
    ctx.sound?.start('claw');
    const damage = (gameRandom() % 8 + 1) * 10;
    damageMobj(actor.target, actor, actor, damage, ctx.player, ctx.collision.dropCtx, ctx);
    return;
  }

  ctx.missiles.spawn('bruisershot', actor, actor.target);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aSkullAttack(actor, ctx) {
  if (!actor.target) {
    return;
  }

  const dest = actor.target;
  actor.flags |= MF_SKULLFLY;
  ctx.sound?.start(actor.monsterDef.attackSound ?? 'sklatk');
  aFaceTarget(actor);
  const idx = fineAngleIndex(actor.angle);
  actor.momx = fixedMul(SKULLSPEED, tables.finecosine[idx]);
  actor.momy = fixedMul(SKULLSPEED, tables.finesine[idx]);
  let dist = approxDistance(dest.x - actor.x, dest.y - actor.y);
  dist = Math.max(1, (dist / SKULLSPEED) | 0);
  actor.momz = ((dest.z + (dest.height >> 1) - actor.z) / dist) | 0;
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aSpidRefire(actor, ctx) {
  aFaceTarget(actor);
  if (gameRandom() < 10) {
    return;
  }
  if (!actor.target || actor.target.health <= 0 || !checkSight(actor, actor.target, ctx.collision)) {
    if (actor.monsterDef.seeState) {
      enterState(actor, actor.monsterDef.seeState, ctx);
    }
  }
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aHoof(actor, ctx) {
  ctx.sound?.start('hoof');
  aChase(actor, ctx);
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aMetal(actor, ctx) {
  ctx.sound?.start('metal');
  aChase(actor, ctx);
}

/**
 * @param {string|undefined} mapName
 * @returns {{ episode: number, map: number }|null}
 */
function parseEpisodeMap(mapName) {
  if (!mapName) {
    return null;
  }
  const m = /^E(\d)M(\d+)$/i.exec(mapName);
  if (!m) {
    return null;
  }
  return { episode: Number(m[1]), map: Number(m[2]) };
}

/**
 * @param {import('../MapThingSpawner.js').MapThingMobj} actor
 * @param {MonsterContext} ctx
 */
function aBossDeath(actor, ctx) {
  const parsed = parseEpisodeMap(ctx.mapName);
  if (!parsed) {
    return;
  }

  const { episode, map } = parsed;
  const type = actor.monsterType;
  let ok = false;
  if (episode === 1 && map === 8 && type === 'bruiser') {
    ok = true;
  } else if (episode === 2 && map === 8 && type === 'cyborg') {
    ok = true;
  } else if (episode === 3 && map === 8 && type === 'spider') {
    ok = true;
  } else if (episode === 4 && map === 6 && type === 'cyborg') {
    ok = true;
  } else if (episode === 4 && map === 8 && type === 'spider') {
    ok = true;
  }
  if (!ok) {
    return;
  }

  const players = ctx.players?.length ? ctx.players : [ctx.player];
  if (!players.some((p) => p && p.health > 0)) {
    return;
  }

  for (const other of ctx.things) {
    if (other !== actor && other.monsterType === type && (other.health ?? 0) > 0) {
      return;
    }
  }

  if (episode === 1 || (episode === 4 && map === 8)) {
    if (ctx.specCtx) {
      evDoFloor(ctx.specCtx, { tag: 666 }, FloorMoveType.lowerToLowest);
    }
    return;
  }

  ctx.onExitLevel?.();
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
  radiusAttack(actor, actor.target ?? null, 128, ctx.things, ctx.collision, ctx.player, ctx);
}

const ACTIONS = {
  A_Look: aLook,
  A_Chase: aChase,
  A_FaceTarget: aFaceTarget,
  A_PosAttack: aPosAttack,
  A_SPosAttack: aSPosAttack,
  A_TroopAttack: aTroopAttack,
  A_SargAttack: aSargAttack,
  A_HeadAttack: aHeadAttack,
  A_CyberAttack: aCyberAttack,
  A_BruisAttack: aBruisAttack,
  A_SkullAttack: aSkullAttack,
  A_SpidRefire: aSpidRefire,
  A_Hoof: aHoof,
  A_Metal: aMetal,
  A_BossDeath: aBossDeath,
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
    // Finite terminal frames remove the mobj (barrel / lost soul).
    // Corpse frames use tics: -1 and must remain.
    if (state.tics >= 0) {
      actor.removed = true;
    } else {
      actor.stateTics = -1;
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

    if (thing.momx || thing.momy) {
      ctx.collision.xyMovement(thing, null);
    }

    if (thing.z !== thing.floorz || thing.momz) {
      ctx.collision.mobjZMovement(thing);
    }

    tickMonsterState(thing, ctx);
  }
}

registerEnterMobjState(enterState);
