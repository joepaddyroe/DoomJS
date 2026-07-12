import { fineAngleIndex } from '../../core/angles.js';
import { FRACUNIT } from '../../core/renderConstants.js';
import { fixedMul } from '../../math/fixed.js';
import { createTrigTables } from '../../math/tables.js';
import { pointToAngle2 } from '../../math/viewMath.js';
import { gameRandom } from '../GameRandom.js';
import { MF_MISSILE } from '../mobjFlags.js';
import { MISSILE_ARCHETYPES } from './missileInfo.js';
import { approxDistance } from './Sight.js';

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
   */
  constructor(level, collision) {
    this.level = level;
    this.collision = collision;
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
