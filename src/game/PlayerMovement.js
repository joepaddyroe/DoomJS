import { ANG90, fineAngleIndex } from '../core/angles.js';
import { THRUST_SCALE } from '../core/gameConstants.js';
import { fixedMul } from '../math/fixed.js';
import { createTrigTables } from '../math/tables.js';

/**
 * Player movement (p_user.c — P_Thrust, P_MovePlayer, P_CalcHeight).
 */
export class PlayerMovement {
  static tables = createTrigTables();

  /**
   * @param {import('./Player.js').Player} player
   * @param {number} angle
   * @param {number} move
   */
  static thrust(player, angle, move) {
    const idx = fineAngleIndex(angle);
    player.mo.momx += fixedMul(move, this.tables.finecosine[idx]);
    player.mo.momy += fixedMul(move, this.tables.finesine[idx]);
  }

  /**
   * @param {import('./Player.js').Player} player
   * @param {import('./TicCmd.js').TicCmd} cmd
   */
  static move(player, cmd) {
    const mo = player.mo;
    mo.angle = (mo.angle + (cmd.angleturn << 16)) >>> 0;

    const onground = mo.z <= mo.floorz;
    if (cmd.forwardmove && onground) {
      this.thrust(player, mo.angle, cmd.forwardmove * THRUST_SCALE);
    }
    if (cmd.sidemove && onground) {
      this.thrust(player, (mo.angle - ANG90) >>> 0, cmd.sidemove * THRUST_SCALE);
    }
  }

  /** @param {import('./Player.js').Player} player */
  static calcHeight(player) {
    const mo = player.mo;
    const onground = mo.z <= mo.floorz;

    if (!onground) {
      player.viewz = mo.z + player.viewheight;
      if (player.viewz > mo.ceilingz - 4 * (1 << 16)) {
        player.viewz = mo.ceilingz - 4 * (1 << 16);
      }
      return;
    }

    player.viewheight += player.deltaviewheight;
    if (player.viewheight > player.viewheightBase) {
      player.viewheight = player.viewheightBase;
      player.deltaviewheight = 0;
    } else if (player.viewheight < player.viewheightBase / 2) {
      player.viewheight = player.viewheightBase / 2;
      if (player.deltaviewheight <= 0) {
        player.deltaviewheight = 1;
      }
    }

    if (player.deltaviewheight) {
      player.deltaviewheight += 1 << 14;
      if (!player.deltaviewheight) {
        player.deltaviewheight = 1;
      }
    }

    player.viewz = mo.z + player.viewheight;
    if (player.viewz > mo.ceilingz - 4 * (1 << 16)) {
      player.viewz = mo.ceilingz - 4 * (1 << 16);
    }
  }
}
