import { ANGLETOFINESHIFT } from '../core/angles.js';
import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { MISSILERANGE } from './weapons/weaponConstants.js';
import { gameRandom } from './GameRandom.js';
import { createTrigTables } from '../math/tables.js';

/**
 * Hitscan shooting (p_map.c — P_LineAttack, p_pspr.c — P_GunShot).
 */
export class Hitscan {
  /**
   * @param {import('../MapCollision.js').MapCollision} collision
   */
  constructor(collision) {
    this.collision = collision;
    this.tables = createTrigTables();
    this.bulletSlope = 0;
  }

  /** @param {import('../Mobj.js').Mobj} mo */
  bulletSlopeFor(mo) {
    this.bulletSlope = 0;
    return this.bulletSlope;
  }

  /**
   * @param {import('../Mobj.js').Mobj} mo
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

  /**
   * @param {import('../Mobj.js').Mobj} mo
   * @param {number} angle
   * @param {number} distance
   * @param {number} slope
   * @param {number} damage
   */
  lineAttack(mo, angle, distance, slope, damage) {
    const idx = (angle >>> 0) >> ANGLETOFINESHIFT;
    const x2 = mo.x + ((distance >> FRACBITS) * this.tables.finecosine[idx]) | 0;
    const y2 = mo.y + ((distance >> FRACBITS) * this.tables.finesine[idx]) | 0;
    const shootZ = mo.z + (mo.height >> 1) + 8 * FRACUNIT;

    this.collision.shootTraverse(mo.x, mo.y, x2, y2, shootZ, slope, damage);
  }
}
