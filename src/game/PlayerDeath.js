import { ANG180, ANG90 } from '../core/angles.js';
import { FRACUNIT } from '../core/renderConstants.js';
import { BT_USE } from '../core/inputButtons.js';
import { pointToAngle2 } from '../math/viewMath.js';
import { createTrigTables } from '../math/tables.js';
import { PS_WEAPON, S_NULL, WEAPON_INFO } from './weapons/weaponConstants.js';

/** p_user.c — ANG5 */
const ANG5 = (ANG90 / 18) >>> 0;

const tables = createTrigTables();

/**
 * Begin player death (p_inter.c + p_pspr.c — P_DropWeapon).
 * @param {import('./Player.js').Player} player
 * @param {import('./weapons/Psprites.js').Psprites} psprites
 * @param {import('../audio/SoundSystem.js').SoundSystem|null} [sound]
 */
export function startPlayerDeath(player, psprites, sound) {
  if (player.dead) {
    return;
  }

  player.dead = true;
  player.deathTics = 0;
  player.mo.health = 0;
  player.health = 0;
  player.mo.momx = 0;
  player.mo.momy = 0;

  const downstate = WEAPON_INFO[player.readyweapon]?.downstate;
  if (downstate !== undefined && downstate !== S_NULL) {
    psprites.setPsprite(player, PS_WEAPON, downstate);
  }

  sound?.start('pldeth');
}

/**
 * Fall on your face; press use to respawn (p_user.c — P_DeathThink).
 * @param {import('./Player.js').Player} player
 * @param {import('./TicCmd.js').TicCmd} cmd
 * @param {import('./weapons/Psprites.js').Psprites} psprites
 * @returns {boolean} True when the player pressed use (G_DoReborn / reload level).
 */
export function tickPlayerDeath(player, cmd, psprites) {
  if (!player.dead) {
    return false;
  }

  player.deathTics++;
  psprites.think(player);

  if (player.viewheight > 6 * FRACUNIT) {
    player.viewheight -= FRACUNIT;
  }
  if (player.viewheight < 6 * FRACUNIT) {
    player.viewheight = 6 * FRACUNIT;
  }
  player.deltaviewheight = 0;
  player.viewz = player.mo.z + player.viewheight;

  if (player.attacker && player.attacker !== player.mo) {
    const angle = pointToAngle2(
      player.mo.x,
      player.mo.y,
      player.attacker.x,
      player.attacker.y,
      tables.tantoangle,
    );
    const delta = (angle - player.mo.angle) >>> 0;

    if (delta < ANG5 || delta > (0xffffffff - ANG5)) {
      player.mo.angle = angle;
      if (player.damagecount > 0) {
        player.damagecount--;
      }
    } else if (delta < ANG180) {
      player.mo.angle = (player.mo.angle + ANG5) >>> 0;
    } else {
      player.mo.angle = (player.mo.angle - ANG5) >>> 0;
    }
  } else if (player.damagecount > 0) {
    player.damagecount--;
  }

  return (cmd.buttons & BT_USE) !== 0;
}
