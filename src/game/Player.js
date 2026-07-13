import { VIEWHEIGHT } from '../core/gameConstants.js';
import { createPlayerMobj } from './Mobj.js';
import { createTicCmd } from './TicCmd.js';
import { createPsprite } from './weapons/Psprites.js';
import {
  AM_CLIP,
  MAX_AMMO,
  NUM_AMMO,
  NUM_PSPRITES,
  WP_FIST,
  WP_NOCHANGE,
  WP_PISTOL,
} from './weapons/weaponConstants.js';

/**
 * Local player state (player_t subset from p_user.c).
 */
export class Player {
  /**
   * @param {import('./MapLoader.js').MapThing} thing
   * @param {import('./Level.js').Level} level
   */
  static fromStart(thing, level) {
    const mo = createPlayerMobj(thing, level);
    return new Player(mo);
  }

  /** @param {import('./Mobj.js').Mobj} mo */
  constructor(mo) {
    this.mo = mo;
    mo.playerObject = this;
    this.viewheight = VIEWHEIGHT;
    this.viewheightBase = VIEWHEIGHT;
    this.deltaviewheight = 0;
    this.viewz = mo.z + VIEWHEIGHT;
    this.reactiontime = 0;

    this.damagecount = 0;
    this.bonuscount = 0;
    /** @type {import('./Mobj.js').Mobj|null} */
    this.attacker = null;
    /** @type {boolean[]} */
    this.cards = new Array(6).fill(false);

    this.refire = 0;
    this.attacking = false;
    this.extralight = 0;
    this.bob = 0;
    this.leveltime = 0;

    this.cmd = createTicCmd();
    this.psprites = Array.from({ length: NUM_PSPRITES }, () => createPsprite());

    this.resetStartInventory();
  }

  /** g_game.c — G_PlayerReborn default loadout at map start / respawn. */
  resetStartInventory() {
    this.health = 100;
    this.mo.health = 100;
    this.armorpoints = 0;
    this.armortype = 0;
    this.backpack = false;
    this.maxammo = [...MAX_AMMO];
    this.readyweapon = WP_PISTOL;
    this.pendingweapon = WP_NOCHANGE;
    this.weaponowned = new Array(8).fill(false);
    this.weaponowned[WP_FIST] = true;
    this.weaponowned[WP_PISTOL] = true;
    this.ammo = new Array(NUM_AMMO).fill(0);
    this.ammo[AM_CLIP] = 50;
    this.dead = false;
    this.deathTics = 0;
    this.usedown = false;
    this.attackdown = false;
  }

  /** @returns {{ x: number, y: number, z: number, angle: number, extralight: number }} */
  view() {
    return {
      x: this.mo.x,
      y: this.mo.y,
      z: this.viewz,
      angle: this.mo.angle,
      extralight: this.extralight,
    };
  }

  /** Map coords for debug overlay. */
  mapPosition() {
    return {
      x: this.mo.x / (1 << 16),
      y: this.mo.y / (1 << 16),
      angle: this.mo.angle,
    };
  }
}
