import { BT_CHANGE, BT_USE, BT_WEAPONMASK, BT_WEAPONSHIFT } from '../core/inputButtons.js';
import { useLines } from './spec/UseLines.js';

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

/**
 * Use key — doors and switches (p_user.c / p_map.c).
 * @param {import('./Player.js').Player} player
 * @param {import('./spec/Doors.js').DoorContext} doorCtx
 * @param {import('./MapCollision.js').MapCollision} collision
 */
export function thinkUse(player, doorCtx, collision) {
  const cmd = player.cmd;

  if (cmd.buttons & BT_USE) {
    if (!player.usedown) {
      useLines(collision, player, doorCtx);
      player.usedown = true;
    }
  } else {
    player.usedown = false;
  }
}
