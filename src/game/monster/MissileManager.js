import { fineAngleIndex } from '../../core/angles.js';
import { FRACUNIT } from '../../core/renderConstants.js';
import { fixedMul } from '../../math/fixed.js';
import { createTrigTables } from '../../math/tables.js';
import { pointToAngle2 } from '../../math/viewMath.js';
import { gameRandom } from '../GameRandom.js';
import { MF_MISSILE } from '../mobjFlags.js';
import { MISSILE_ARCHETYPES } from './missileInfo.js';
import { radiusAttack } from './RadiusAttack.js';
import { approxDistance } from './Sight.js';
import { damageMobj } from './MobjCombat.js';
import { MISSILERANGE } from '../weapons/weaponConstants.js';

const tables = createTrigTables();

/**
 * @typedef {Object} MissileMobj
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} angle
 * @property {number} radius
 * @property {number} height
 * @property {number} flags
 * @property {string} sprite
 * @property {number} frame
 * @property {boolean} fullbright
 * @property {string} missileKind
 * @property {import('./missileInfo.js').MissileArchetype} missileDef
 * @property {string} state
 * @property {number} stateTics
 * @property {number} momx
 * @property {number} momy
 * @property {number} momz
 * @property {number} missileDamage
 * @property {object|null} target
 * @property {boolean} removed
 * @property {import('../Level.js').LevelSubsector|null} subsector
 * @property {number} floorz
 * @property {number} ceilingz
 */

/**
 * Flying projectiles (p_mobj.c — P_SpawnMissile, P_ExplodeMissile).
 */
export class MissileManager {
  /**
   * @param {import('../Level.js').Level} level
   * @param {import('../MapCollision.js').MapCollision} collision
   * @param {import('../../audio/SoundSystem.js').SoundSystem|null} [sound]
   * @param {import('../MapThingSpawner.js').MapThingMobj[]} [things]
   * @param {import('../Player.js').Player|null} [player]
   */
  constructor(level, collision, sound = null, things = [], player = null) {
    this.level = level;
    this.collision = collision;
    this.sound = sound;
    this.things = things;
    this.player = player;
    /** @type {MissileMobj[]} */
    this.missiles = [];
    collision.missiles = this.missiles;
    collision.onMissileExplode = (mo) => this.explodeMissile(mo);
  }

  /**
   * @param {string} kind
   * @param {import('../MapThingSpawner.js').MapThingMobj|import('../Mobj.js').Mobj} source
   * @param {import('../Mobj.js').Mobj} dest
   */
  spawn(kind, source, dest) {
    const def = MISSILE_ARCHETYPES[kind];
    if (!def) {
      return null;
    }

    const spawnZ = source.z + 4 * 8 * FRACUNIT;
    const subsector = this.level.findSubsector(source.x, source.y);
    const angle = pointToAngle2(source.x, source.y, dest.x, dest.y, tables.tantoangle);
    const idx = fineAngleIndex(angle);

    /** @type {MissileMobj} */
    const mo = {
      x: source.x,
      y: source.y,
      z: spawnZ,
      angle,
      radius: def.radius,
      height: def.height,
      flags: def.flags | MF_MISSILE,
      sprite: def.states[def.spawnState].sprite,
      frame: def.states[def.spawnState].frame,
      fullbright: true,
      missileKind: kind,
      missileDef: def,
      state: def.spawnState,
      stateTics: def.states[def.spawnState].tics,
      momx: fixedMul(def.speed, tables.finecosine[idx]),
      momy: fixedMul(def.speed, tables.finesine[idx]),
      momz: 0,
      missileDamage: def.damage,
      target: source,
      removed: false,
      subsector,
      floorz: subsector.sector.floorHeight,
      ceilingz: subsector.sector.ceilingHeight,
    };

    let dist = approxDistance(dest.x - source.x, dest.y - source.y);
    // p_mobj.c: dist = P_AproxDistance(...) / speed (both fixed_t, integer tics)
    dist = Math.max(1, (dist / def.speed) | 0);
    // Vanilla uses dest->z - source->z (feet), not spawn height
    mo.momz = ((dest.z - source.z) / dist) | 0;

    mo.stateTics -= gameRandom() & 3;
    if (mo.stateTics < 1) {
      mo.stateTics = 1;
    }

    mo.x += mo.momx >> 1;
    mo.y += mo.momy >> 1;
    mo.z += mo.momz >> 1;
    mo.subsector = this.level.findSubsector(mo.x, mo.y);

    if (def.spawnSound) {
      this.sound?.start(def.spawnSound);
    }

    if (!this.collision.tryMove(mo, mo.x, mo.y)) {
      this.explodeMissile(mo);
      if (mo.removed) {
        return null;
      }
    }

    this.missiles.push(mo);
    return mo;
  }

  /**
   * Player-fired projectile (p_mobj.c — P_SpawnPlayerMissile).
   * @param {import('../Mobj.js').Mobj} source
   * @param {string} kind
   */
  spawnPlayerMissile(source, kind) {
    const def = MISSILE_ARCHETYPES[kind];
    if (!def) {
      return null;
    }

    let angle = source.angle >>> 0;
    let slope = this.collision.aimLineAttack(source, angle, MISSILERANGE);
    if (!slope) {
      angle = (angle + (1 << 26)) >>> 0;
      slope = this.collision.aimLineAttack(source, angle, MISSILERANGE);
      if (!slope) {
        angle = (source.angle - (1 << 26)) >>> 0;
        slope = this.collision.aimLineAttack(source, angle, MISSILERANGE);
        if (!slope) {
          angle = source.angle >>> 0;
          slope = 0;
        }
      }
    }

    const spawnZ = source.z + 4 * 8 * FRACUNIT;
    const subsector = this.level.findSubsector(source.x, source.y);
    const idx = fineAngleIndex(angle);

    /** @type {MissileMobj} */
    const mo = {
      x: source.x,
      y: source.y,
      z: spawnZ,
      angle,
      radius: def.radius,
      height: def.height,
      flags: def.flags | MF_MISSILE,
      sprite: def.states[def.spawnState].sprite,
      frame: def.states[def.spawnState].frame,
      fullbright: true,
      missileKind: kind,
      missileDef: def,
      state: def.spawnState,
      stateTics: def.states[def.spawnState].tics,
      momx: fixedMul(def.speed, tables.finecosine[idx]),
      momy: fixedMul(def.speed, tables.finesine[idx]),
      momz: fixedMul(def.speed, slope),
      missileDamage: def.damage,
      target: source,
      removed: false,
      subsector,
      floorz: subsector.sector.floorHeight,
      ceilingz: subsector.sector.ceilingHeight,
    };

    mo.stateTics -= gameRandom() & 3;
    if (mo.stateTics < 1) {
      mo.stateTics = 1;
    }

    if (def.spawnSound) {
      this.sound?.start(def.spawnSound);
    }

    if (!this.collision.tryMove(mo, mo.x, mo.y)) {
      this.explodeMissile(mo);
      if (mo.removed) {
        return null;
      }
    }

    this.missiles.push(mo);
    return mo;
  }

  /** @param {MissileMobj} mo */
  explodeMissile(mo) {
    if (mo.removed) {
      return;
    }

    mo.momx = 0;
    mo.momy = 0;
    mo.momz = 0;
    mo.flags &= ~MF_MISSILE;

    const def = mo.missileDef;
    const death = def.states[def.deathState];
    mo.state = def.deathState;
    mo.sprite = death.sprite;
    mo.frame = death.frame;
    mo.fullbright = death.fullbright ?? true;
    mo.stateTics = death.tics - (gameRandom() & 3);
    if (mo.stateTics < 1) {
      mo.stateTics = 1;
    }

    if (def.deathSound) {
      this.sound?.start(def.deathSound);
    }

    if (this.player && def.hitType === 'radius' && def.radiusDamage) {
      radiusAttack(
        mo,
        mo.target,
        def.radiusDamage,
        this.things,
        this.collision,
        this.player,
      );
    } else if (this.player && def.hitType === 'bfg' && mo.target) {
      this.bfgSpray(mo);
    }
  }

  /** @param {MissileMobj} mo */
  bfgSpray(mo) {
    const source = mo.target;
    if (!source || !this.player) {
      return;
    }

    const ANG90 = 0x40000000;
    for (let i = 0; i < 40; i++) {
      const an = (source.angle - (ANG90 >> 1) + Math.floor((ANG90 / 40) * i)) >>> 0;
      const idx = fineAngleIndex(an);
      const x2 = source.x + ((MISSILERANGE >> 16) * tables.finecosine[idx]) | 0;
      const y2 = source.y + ((MISSILERANGE >> 16) * tables.finesine[idx]) | 0;
      const shootZ = source.z + (source.height >> 1) + 8 * FRACUNIT;

      let hitThing = null;
      this.collision.shootTraverse(source.x, source.y, x2, y2, shootZ, 0, MISSILERANGE, {
        shootThing: source,
        aimMode: true,
        onAimThing: (thing) => {
          hitThing = thing;
        },
      });

      if (!hitThing) {
        continue;
      }

      let damage = 0;
      for (let j = 0; j < 15; j++) {
        damage += (gameRandom() & 7) + 1;
      }
      damageMobj(
        hitThing,
        source,
        source,
        damage,
        this.player,
        this.collision.dropCtx,
      );
    }
  }

  /** @param {import('../Player.js').Player} player */
  tick(player) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const mo = this.missiles[i];
      if (mo.removed) {
        this.missiles.splice(i, 1);
        continue;
      }

      if (mo.momx || mo.momy) {
        this.collision.xyMovement(mo, null);
        if (mo.removed) {
          this.missiles.splice(i, 1);
          continue;
        }
      }

      this.collision.missileZMovement(mo);
      if (mo.removed) {
        this.missiles.splice(i, 1);
        continue;
      }

      if (mo.stateTics === -1) {
        continue;
      }

      mo.stateTics--;
      if (mo.stateTics > 0) {
        continue;
      }

      const state = mo.missileDef.states[mo.state];
      if (!state?.next) {
        mo.removed = true;
        this.missiles.splice(i, 1);
        continue;
      }

      const next = mo.missileDef.states[state.next];
      mo.state = state.next;
      mo.sprite = next.sprite;
      mo.frame = next.frame;
      mo.fullbright = next.fullbright ?? true;
      mo.stateTics = next.tics;
    }
  }
}
