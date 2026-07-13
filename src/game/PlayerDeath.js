import { TICRATE } from '../core/gameConstants.js';
import { FRACUNIT } from '../core/renderConstants.js';

/** Tics before the game-over prompt appears. */
export const DEATH_DELAY = TICRATE * 2;

/**
 * Begin player death (p_mobj.c — P_KillMobj / P_PlayerDie subset).
 * @param {import('./Player.js').Player} player
 * @param {import('../audio/SoundSystem.js').SoundSystem|null} [sound]
 */
export function startPlayerDeath(player, sound) {
  if (player.dead) {
    return;
  }

  player.dead = true;
  player.deathTics = 0;
  player.mo.health = 0;
  player.health = 0;
  player.mo.momx = 0;
  player.mo.momy = 0;
  player.viewheight = (player.viewheight * 2) / 3;
  player.deltaviewheight = player.viewheight / 22;
  sound?.start('pldeth');
}

/**
 * @param {import('./Player.js').Player} player
 * @returns {boolean}
 */
export function tickPlayerDeath(player) {
  if (!player.dead) {
    return false;
  }

  player.deathTics++;

  if (player.viewheight > 7 * FRACUNIT) {
    player.viewheight += player.deltaviewheight;
    if (player.viewheight < 7 * FRACUNIT) {
      player.viewheight = 7 * FRACUNIT;
    }
  }

  player.viewz = player.mo.z + player.viewheight;
  return player.deathTics >= DEATH_DELAY;
}
