import { BT_CHANGE, BT_WEAPONMASK, BT_WEAPONSHIFT } from '../core/inputButtons.js';

/**
 * Weapon selection from ticcmd (p_user.c — P_PlayerThink).
 * @param {import('./Player.js').Player} player
 */
export function thinkWeaponChange(player) {
  const cmd = player.cmd;
  if (!(cmd.buttons & BT_CHANGE)) {
    return;
  }

  const newweapon = (cmd.buttons & BT_WEAPONMASK) >> BT_WEAPONSHIFT;
  if (player.weaponowned[newweapon] && newweapon !== player.readyweapon) {
    player.pendingweapon = newweapon;
  }
}
