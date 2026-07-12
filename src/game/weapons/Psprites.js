import { FRACUNIT } from '../../core/renderConstants.js';
import { BT_ATTACK } from '../../core/inputButtons.js';
import { createTrigTables } from '../../math/tables.js';
import { FINEANGLES, FINEMASK } from '../../core/angles.js';
import {
  AM_CLIP,
  AM_NOAMMO,
  LOWERSPEED,
  NUM_PSPRITES,
  PS_FLASH,
  PS_WEAPON,
  RAISESPEED,
  S_NULL,
  WEAPONBOTTOM,
  WEAPONTOP,
  WEAPON_INFO,
  WEAPON_STATES,
  WP_NOCHANGE,
  WP_PISTOL,
} from './weaponConstants.js';

/**
 * @typedef {Object} Psprite
 * @property {number|null} state State index or null when inactive
 * @property {number} tics
 * @property {number} sx
 * @property {number} sy
 */

/** @returns {Psprite} */
export function createPsprite() {
  return {
    state: null,
    tics: 0,
    sx: FRACUNIT,
    sy: WEAPONTOP,
  };
}

/**
 * Player weapon sprites (p_pspr.c).
 */
export class Psprites {
  /**
   * @param {import('../Hitscan.js').Hitscan} hitscan
   */
  constructor(hitscan) {
    this.hitscan = hitscan;
    this.tables = createTrigTables();
  }

  /** @param {import('../Player.js').Player} player */
  setup(player) {
    for (let i = 0; i < NUM_PSPRITES; i++) {
      player.psprites[i].state = null;
    }
    player.pendingweapon = player.readyweapon;
    this.bringUpWeapon(player);
  }

  /** @param {import('../Player.js').Player} player */
  think(player) {
    this.movePsprites(player);
  }

  /** @param {import('../Player.js').Player} player */
  movePsprites(player) {
    for (let i = 0; i < NUM_PSPRITES; i++) {
      const psp = player.psprites[i];
      if (psp.state === null) {
        continue;
      }

      if (psp.tics !== -1) {
        psp.tics--;
        if (psp.tics <= 0) {
          const state = WEAPON_STATES[psp.state];
          this.setPsprite(player, i, state.nextState);
        }
      }
    }

    player.psprites[PS_FLASH].sx = player.psprites[PS_WEAPON].sx;
    player.psprites[PS_FLASH].sy = player.psprites[PS_WEAPON].sy;
  }

  /**
   * @param {import('../Player.js').Player} player
   * @param {number} position
   * @param {number} stnum
   */
  setPsprite(player, position, stnum) {
    const psp = player.psprites[position];

    while (true) {
      if (!stnum) {
        psp.state = null;
        break;
      }

      const state = WEAPON_STATES[stnum];
      psp.state = stnum;
      psp.tics = state.tics;

      if (state.action) {
        this.runAction(player, psp, state.action);
        if (psp.state === null) {
          break;
        }
      }

      if (psp.tics) {
        break;
      }

      stnum = WEAPON_STATES[psp.state].nextState;
    }
  }

  /**
   * @param {import('../Player.js').Player} player
   * @param {import('./weaponConstants.js').Psprite} psp
   * @param {string} action
   */
  runAction(player, psp, action) {
    switch (action) {
      case 'WeaponReady':
        this.weaponReady(player, psp);
        break;
      case 'Lower':
        this.lower(player, psp);
        break;
      case 'Raise':
        this.raise(player, psp);
        break;
      case 'FirePistol':
        this.firePistol(player, psp);
        break;
      case 'ReFire':
        this.reFire(player, psp);
        break;
      case 'Light0':
        player.extralight = 0;
        break;
      case 'Light1':
        player.extralight = 1;
        break;
      default:
        break;
    }
  }

  /** @param {import('../Player.js').Player} player */
  bringUpWeapon(player) {
    if (player.pendingweapon === WP_NOCHANGE) {
      player.pendingweapon = player.readyweapon;
    }

    const newstate = WEAPON_INFO[player.pendingweapon].upstate;
    player.pendingweapon = WP_NOCHANGE;
    player.psprites[PS_WEAPON].sy = WEAPONBOTTOM;
    this.setPsprite(player, PS_WEAPON, newstate);
  }

  /** @param {import('../Player.js').Player} player */
  checkAmmo(player) {
    const info = WEAPON_INFO[player.readyweapon];
    if (info.ammo === AM_NOAMMO || player.ammo[info.ammo] >= 1) {
      return true;
    }

    player.pendingweapon = WP_PISTOL;
    if (player.readyweapon !== WP_PISTOL) {
      this.setPsprite(player, PS_WEAPON, WEAPON_INFO[player.readyweapon].downstate);
    }
    return false;
  }

  /** @param {import('../Player.js').Player} player */
  fireWeapon(player) {
    if (!this.checkAmmo(player)) {
      return;
    }

    const newstate = WEAPON_INFO[player.readyweapon].atkstate;
    this.setPsprite(player, PS_WEAPON, newstate);
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  weaponReady(player, psp) {
    if (player.pendingweapon !== WP_NOCHANGE) {
      const newstate = WEAPON_INFO[player.readyweapon].downstate;
      this.setPsprite(player, PS_WEAPON, newstate);
      return;
    }

    if (player.cmd.buttons & BT_ATTACK) {
      if (!player.attackdown) {
        player.attackdown = true;
        this.fireWeapon(player);
        return;
      }
    } else {
      player.attackdown = false;
    }

    const bob = player.bob;
    const angle = (128 * player.leveltime) & FINEMASK;
    psp.sx = FRACUNIT + ((bob * this.tables.finecosine[angle]) / FRACUNIT) | 0;
    const angle2 = (128 * player.leveltime + FINEANGLES / 2) & FINEMASK;
    psp.sy = WEAPONTOP + ((bob * this.tables.finesine[angle2]) / FRACUNIT) | 0;
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  lower(player, psp) {
    psp.sy += LOWERSPEED;
    if (psp.sy < WEAPONBOTTOM) {
      return;
    }

    psp.sy = WEAPONBOTTOM;
    player.readyweapon = player.pendingweapon;
    this.bringUpWeapon(player);
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  raise(player, psp) {
    psp.sy -= RAISESPEED;
    if (psp.sy > WEAPONTOP) {
      return;
    }

    psp.sy = WEAPONTOP;
    const newstate = WEAPON_INFO[player.readyweapon].readystate;
    this.setPsprite(player, PS_WEAPON, newstate);
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  firePistol(player, psp) {
    const info = WEAPON_INFO[player.readyweapon];
    player.ammo[info.ammo]--;
    this.setPsprite(player, PS_FLASH, info.flashstate);
    this.hitscan.bulletSlopeFor(player.mo);
    this.hitscan.gunShot(player.mo, !player.refire);
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  reFire(player, psp) {
    if ((player.cmd.buttons & BT_ATTACK)
      && player.pendingweapon === WP_NOCHANGE
      && player.health > 0) {
      player.refire++;
      this.fireWeapon(player);
    } else {
      player.refire = 0;
      this.checkAmmo(player);
    }
  }
}
