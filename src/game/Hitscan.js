import { fineAngleIndex } from '../core/angles.js';
import { MELEERANGE } from '../core/gameConstants.js';
import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { MISSILERANGE } from './weapons/weaponConstants.js';
import { gameRandom } from './GameRandom.js';
import { createTrigTables } from '../math/tables.js';
import { damageMobj } from './monster/MobjCombat.js';

/**
 * Hitscan shooting (p_map.c — P_LineAttack, p_pspr.c — P_GunShot).
 */
export class Hitscan {
  /**
   * @param {import('./MapCollision.js').MapCollision} collision
   * @param {import('../render/BillboardRenderer.js').PuffManager} puffs
   * @param {import('./Player.js').Player|null} [player]
   */
  constructor(collision, puffs, player = null) {
    this.collision = collision;
    this.puffs = puffs;
    this.player = player;
    this.tables = createTrigTables();
    this.bulletSlope = 0;
    /** @type {import('./monster/MonsterThink.js').MonsterContext|null} */
    this.monsterDeathCtx = null;
  }

  /** @param {import('./Mobj.js').Mobj|import('./MapThingSpawner.js').MapThingMobj} mo */
  bulletSlopeFor(mo) {
    if (mo.playerObject && this.player) {
      let angle = mo.angle >>> 0;
      this.bulletSlope = this.collision.aimLineAttack(mo, angle, MISSILERANGE);
      if (this.bulletSlope) {
        return this.bulletSlope;
      }

      angle = (angle + (1 << 26)) >>> 0;
      this.bulletSlope = this.collision.aimLineAttack(mo, angle, MISSILERANGE);
      if (this.bulletSlope) {
        return this.bulletSlope;
      }

      angle = (mo.angle - (1 << 26)) >>> 0;
      this.bulletSlope = this.collision.aimLineAttack(mo, angle, MISSILERANGE);
    } else {
      this.bulletSlope = 0;
    }
    return this.bulletSlope;
  }

  /** @param {import('./Mobj.js').Mobj|import('./MapThingSpawner.js').MapThingMobj} mo */
  punchAttack(mo) {
    const damage = 2 * ((gameRandom() % 10) + 1);
    this.lineAttack(mo, mo.angle >>> 0, MELEERANGE, 0, damage);
  }

  /**
   * @param {import('./Mobj.js').Mobj|import('./MapThingSpawner.js').MapThingMobj} mo
   * @param {boolean} accurate
   */
  gunShot(mo, accurate) {
    let damage = 5 * (gameRandom() % 3 + 1);
    let angle = mo.angle >>> 0;

    if (!accurate) {
      angle = (angle + ((gameRandom() - gameRandom()) << 18)) >>> 0;
    }

    this.lineAttack(mo, angle, MISSILERANGE, this.bulletSlope, damage);
    return damage;
  }

  /** @param {import('./Mobj.js').Mobj} mo */
  fireShotgun(mo) {
    for (let i = 0; i < 7; i++) {
      this.gunShot(mo, false);
    }
  }

  /**
   * @param {import('./Mobj.js').Mobj|import('./MapThingSpawner.js').MapThingMobj} mo
   * @param {number} angle
   * @param {number} distance
   * @param {number} slope
   * @param {number} damage
   * @returns {{ x: number, y: number, thing: object }|null}
   */
  lineAttack(mo, angle, distance, slope, damage) {
    const idx = fineAngleIndex(angle);
    const x2 = mo.x + ((distance >> FRACBITS) * this.tables.finecosine[idx]) | 0;
    const y2 = mo.y + ((distance >> FRACBITS) * this.tables.finesine[idx]) | 0;
    const shootZ = mo.z + (mo.height >> 1) + 8 * FRACUNIT;

    /** @type {{ x: number, y: number, thing: object }|null} */
    let thingHit = null;

    const hit = this.collision.shootTraverse(
      mo.x,
      mo.y,
      x2,
      y2,
      shootZ,
      slope,
      distance,
      {
        shootThing: mo,
        damage,
        onThingHit: (thing, x, y, z) => {
          if (this.player) {
            damageMobj(
              thing,
              mo,
              mo,
              damage,
              this.player,
              this.collision.dropCtx,
              this.monsterDeathCtx,
            );
          }
          this.puffs.spawn(x, y, z);
          thingHit = { x, y, thing };
        },
      },
    );

    if (hit.hit && hit.thing === undefined
      && hit.x !== undefined && hit.y !== undefined && hit.z !== undefined) {
      this.puffs.spawn(hit.x, hit.y, hit.z);
    }

    return thingHit;
  }
}
