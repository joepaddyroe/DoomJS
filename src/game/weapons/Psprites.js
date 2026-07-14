import { FRACUNIT } from '../../core/renderConstants.js';
import { BT_ATTACK } from '../../core/inputButtons.js';
import { ANG90, ANG180, FINEANGLES, FINEMASK } from '../../core/angles.js';
import { MELEERANGE } from '../../core/gameConstants.js';
import { createTrigTables } from '../../math/tables.js';
import { gameRandom } from '../GameRandom.js';
import { noiseAlert } from '../monster/NoiseAlert.js';
import { pointToAngle2 } from '../../math/viewMath.js';
import {
  AM_CELL,
  AM_CLIP,
  AM_MISL,
  AM_NOAMMO,
  AM_SHELL,
  BFGCELLS,
  LOWERSPEED,
  NUM_PSPRITES,
  PS_FLASH,
  PS_WEAPON,
  RAISESPEED,
  S_CHAIN1,
  S_NULL,
  WEAPONBOTTOM,
  WEAPONTOP,
  WEAPON_INFO,
  WEAPON_STATES,
  WP_BFG,
  WP_CHAINGUN,
  WP_CHAINSAW,
  WP_FIST,
  WP_MISSILE,
  WP_NOCHANGE,
  WP_PISTOL,
  WP_PLASMA,
  WP_SHOTGUN,
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
   * @param {import('../audio/SoundSystem.js').SoundSystem|null} [sound]
   * @param {import('../Level.js').Level|null} [level]
   * @param {import('../monster/MissileManager.js').MissileManager|null} [missiles]
   */
  constructor(hitscan, sound = null, level = null, missiles = null) {
    this.hitscan = hitscan;
    this.sound = sound;
    this.level = level;
    this.missiles = missiles;
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
      case 'FireShotgun':
        this.fireShotgun(player, psp);
        break;
      case 'FireCGun':
        this.fireCGun(player, psp);
        break;
      case 'GunFlash':
        this.gunFlash(player);
        break;
      case 'FireMissile':
        this.fireMissile(player);
        break;
      case 'FirePlasma':
        this.firePlasma(player, psp);
        break;
      case 'FireBFG':
        this.fireBFG(player);
        break;
      case 'BFGsound':
        this.sound?.start('bfg');
        break;
      case 'Saw':
        this.saw(player);
        break;
      case 'FirePunch':
        this.firePunch(player, psp);
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
      case 'Light2':
        player.extralight = 2;
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

    const info = WEAPON_INFO[player.pendingweapon];
    if (!info) {
      return;
    }

    const newstate = info.upstate;
    player.pendingweapon = WP_NOCHANGE;
    player.psprites[PS_WEAPON].sy = WEAPONBOTTOM;
    this.setPsprite(player, PS_WEAPON, newstate);
  }

  /** @param {import('../Player.js').Player} player */
  checkAmmo(player) {
    const info = WEAPON_INFO[player.readyweapon];
    if (!info) {
      return false;
    }

    let count = 1;
    if (player.readyweapon === WP_BFG) {
      count = BFGCELLS;
    }

    if (info.ammo === AM_NOAMMO || player.ammo[info.ammo] >= count) {
      return true;
    }

    if (player.weaponowned[WP_PLASMA] && player.ammo[AM_CELL] > 0) {
      player.pendingweapon = WP_PLASMA;
    } else if (player.weaponowned[WP_CHAINGUN] && player.ammo[AM_CLIP] > 0) {
      player.pendingweapon = WP_CHAINGUN;
    } else if (player.weaponowned[WP_SHOTGUN] && player.ammo[AM_SHELL] > 0) {
      player.pendingweapon = WP_SHOTGUN;
    } else if (player.ammo[AM_CLIP] > 0) {
      player.pendingweapon = WP_PISTOL;
    } else if (player.weaponowned[WP_CHAINSAW]) {
      player.pendingweapon = WP_CHAINSAW;
    } else if (player.weaponowned[WP_MISSILE] && player.ammo[AM_MISL] > 0) {
      player.pendingweapon = WP_MISSILE;
    } else if (player.weaponowned[WP_BFG] && player.ammo[AM_CELL] > BFGCELLS) {
      player.pendingweapon = WP_BFG;
    } else {
      player.pendingweapon = WP_FIST;
    }

    if (player.readyweapon !== player.pendingweapon) {
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
    if (this.level) {
      noiseAlert(this.level, player.mo, player.mo);
    }
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

    // p_pspr.c — A_Lower: dead players keep the weapon off screen
    if (player.dead || player.health <= 0) {
      this.setPsprite(player, PS_WEAPON, S_NULL);
      return;
    }

    if (player.pendingweapon === WP_NOCHANGE) {
      player.pendingweapon = player.readyweapon;
    }

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
  firePunch(player, psp) {
    this.hitscan.punchAttack(player.mo);
    this.sound?.start('punch');
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  firePistol(player, psp) {
    const info = WEAPON_INFO[player.readyweapon];
    player.ammo[info.ammo]--;
    this.setPsprite(player, PS_FLASH, info.flashstate);
    this.hitscan.bulletSlopeFor(player.mo);
    this.hitscan.gunShot(player.mo, !player.refire);
    this.sound?.start('pistol');
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  fireShotgun(player, psp) {
    const info = WEAPON_INFO[player.readyweapon];
    player.ammo[info.ammo]--;
    this.setPsprite(player, PS_FLASH, info.flashstate);
    this.hitscan.bulletSlopeFor(player.mo);
    this.hitscan.fireShotgun(player.mo);
    this.sound?.start('shotgn');
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  fireCGun(player, psp) {
    this.sound?.start('pistol');

    const info = WEAPON_INFO[player.readyweapon];
    if (!player.ammo[info.ammo]) {
      return;
    }

    player.ammo[info.ammo]--;
    const flashOffset = (psp.state ?? S_CHAIN1) - S_CHAIN1;
    this.setPsprite(player, PS_FLASH, info.flashstate + flashOffset);
    this.hitscan.bulletSlopeFor(player.mo);
    this.hitscan.gunShot(player.mo, !player.refire);
  }

  /** @param {import('../Player.js').Player} player */
  gunFlash(player) {
    const info = WEAPON_INFO[player.readyweapon];
    this.setPsprite(player, PS_FLASH, info.flashstate);
  }

  /** @param {import('../Player.js').Player} player */
  fireMissile(player) {
    const info = WEAPON_INFO[player.readyweapon];
    player.ammo[info.ammo]--;
    this.missiles?.spawnPlayerMissile(player.mo, 'rocket');
  }

  /** @param {import('../Player.js').Player} player @param {Psprite} psp */
  firePlasma(player, psp) {
    const info = WEAPON_INFO[player.readyweapon];
    player.ammo[info.ammo]--;
    this.setPsprite(
      player,
      PS_FLASH,
      info.flashstate + (gameRandom() & 1),
    );
    this.missiles?.spawnPlayerMissile(player.mo, 'plasma');
  }

  /** @param {import('../Player.js').Player} player */
  fireBFG(player) {
    const info = WEAPON_INFO[player.readyweapon];
    player.ammo[info.ammo] -= BFGCELLS;
    this.missiles?.spawnPlayerMissile(player.mo, 'bfg');
  }

  /** @param {import('../Player.js').Player} player */
  saw(player) {
    const damage = 2 * ((gameRandom() % 10) + 1);
    let angle = player.mo.angle >>> 0;
    angle = (angle + ((gameRandom() - gameRandom()) << 18)) >>> 0;

    const mo = player.mo;
    const slope = this.hitscan.collision.aimLineAttack(mo, angle, MELEERANGE + FRACUNIT);
    const hit = this.hitscan.lineAttack(mo, angle, MELEERANGE + FRACUNIT, slope, damage);

    if (!hit) {
      this.sound?.start('sawful');
      return;
    }

    this.sound?.start('sawhit');

    const targetAngle = pointToAngle2(mo.x, mo.y, hit.x, hit.y, this.tables.tantoangle);
    let delta = (targetAngle - mo.angle) >>> 0;
    if (delta > ANG180) {
      if (targetAngle - mo.angle < -(ANG90 / 20)) {
        mo.angle = (targetAngle + ANG90 / 21) >>> 0;
      } else {
        mo.angle = (mo.angle - ANG90 / 20) >>> 0;
      }
    } else if (targetAngle - mo.angle > ANG90 / 20) {
      mo.angle = (targetAngle - ANG90 / 21) >>> 0;
    } else {
      mo.angle = (mo.angle + ANG90 / 20) >>> 0;
    }
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
