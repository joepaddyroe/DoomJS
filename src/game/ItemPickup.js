import {
  CARD_BLUE,
  CARD_BLUE_SKULL,
  CARD_RED,
  CARD_RED_SKULL,
  CARD_YELLOW,
  CARD_YELLOW_SKULL,
} from './PlayerCards.js';
import { FRACUNIT } from '../core/renderConstants.js';
import {
  AM_CELL,
  AM_CLIP,
  AM_MISL,
  AM_SHELL,
  MAX_AMMO,
  WP_FIST,
  WP_PISTOL,
  WP_SHOTGUN,
} from './weapons/weaponConstants.js';

/** Clip loads per ammo type (p_inter.c). */
const CLIP_AMMO = [10, 4, 20, 1];

const MAX_HEALTH = 100;
const MAX_BONUS_HEALTH = 200;

/** Extended weapon slots beyond currently switchable weapons. */
const WP_CHAINGUN = 3;
const WP_LAUNCHER = 4;
const WP_PLASMA = 5;
const WP_BFG = 6;
const WP_CHAINSAW = 7;

const WEAPON_PICKUPS = {
  weapon_shotgun: { weapon: WP_SHOTGUN, ammo: AM_SHELL, clips: 2 },
  weapon_chaingun: { weapon: WP_CHAINGUN, ammo: AM_CLIP, clips: 2 },
  weapon_launcher: { weapon: WP_LAUNCHER, ammo: AM_MISL, clips: 2 },
  weapon_plasma: { weapon: WP_PLASMA, ammo: AM_CELL, clips: 2 },
  weapon_bfg: { weapon: WP_BFG, ammo: AM_CELL, clips: 2 },
  weapon_chainsaw: { weapon: WP_CHAINSAW, ammo: null, clips: 0 },
};

/**
 * Item pickup logic (p_inter.c — P_GiveAmmo, P_GiveWeapon, P_TouchSpecialThing).
 */
export class ItemPickup {
  /**
   * @param {import('../audio/SoundSystem.js').SoundSystem|null} sound
   */
  constructor(sound = null) {
    this.sound = sound;
  }

  /**
   * @param {import('./Player.js').Player} player
   * @param {import('./MapThingSpawner.js').MapThingMobj} special
   * @returns {boolean} true if the thing was consumed
   */
  touchSpecial(player, special) {
    const mo = player.mo;
    const delta = special.z - mo.z;
    if (delta > mo.height || delta < -8 * FRACUNIT) {
      return false;
    }
    if (player.health <= 0) {
      return false;
    }
    if (!special.pickup) {
      return false;
    }

    const consumed = this.applyPickup(player, special.pickup);
    if (!consumed) {
      return false;
    }

    special.removed = true;
    this.playPickupSound(special.pickup);
    return true;
  }

  /**
   * @param {import('./Player.js').Player} player
   * @param {string} kind
   * @returns {boolean}
   */
  applyPickup(player, kind) {
    switch (kind) {
      case 'clip':
        return this.giveAmmo(player, AM_CLIP, 1);
      case 'clipbox':
        return this.giveAmmo(player, AM_CLIP, 5);
      case 'shell':
        return this.giveAmmo(player, AM_SHELL, 1);
      case 'shellbox':
        return this.giveAmmo(player, AM_SHELL, 5);
      case 'rocketbox':
        return this.giveAmmo(player, AM_MISL, 5);
      case 'stim':
        return this.giveBody(player, 10);
      case 'medi':
        return this.giveBody(player, 25);
      case 'soul':
        return this.giveBody(player, 100, MAX_BONUS_HEALTH);
      case 'bonus_health':
        return this.giveBonusHealth(player);
      case 'bonus_armor':
        return this.giveBonusArmor(player);
      case 'armor_green':
        return this.giveArmor(player, 1);
      case 'armor_blue':
        return this.giveArmor(player, 2);
      case 'key_blue':
        return this.giveCard(player, CARD_BLUE);
      case 'key_yellow':
        return this.giveCard(player, CARD_YELLOW);
      case 'key_red':
        return this.giveCard(player, CARD_RED);
      case 'skull_blue':
        return this.giveCard(player, CARD_BLUE_SKULL);
      case 'skull_yellow':
        return this.giveCard(player, CARD_YELLOW_SKULL);
      case 'skull_red':
        return this.giveCard(player, CARD_RED_SKULL);
      case 'megasphere':
        player.health = MAX_BONUS_HEALTH;
        player.mo.health = player.health;
        this.giveArmor(player, 2);
        return true;
      case 'backpack':
        return this.giveBackpack(player);
      case 'weapon_shotgun':
      case 'weapon_chaingun':
      case 'weapon_launcher':
      case 'weapon_plasma':
      case 'weapon_bfg':
      case 'weapon_chainsaw':
        return this.giveWeapon(player, kind);
      case 'invuln':
      case 'berserk':
      case 'invis':
      case 'suit':
      case 'automap':
      case 'liteamp':
        return true;
      default:
        return false;
    }
  }

  /** @param {import('./Player.js').Player} player @param {number} card */
  giveCard(player, card) {
    if (player.cards[card]) {
      return false;
    }
    player.cards[card] = true;
    player.bonuscount += 2;
    return true;
  }

  /**
   * @param {import('./Player.js').Player} player
   * @param {number} ammo
   * @param {number} clipLoads
   */
  giveAmmo(player, ammo, clipLoads) {
    if (player.ammo[ammo] >= player.maxammo[ammo]) {
      return false;
    }

    const oldAmmo = player.ammo[ammo];
    const amount = clipLoads * CLIP_AMMO[ammo];
    player.ammo[ammo] = Math.min(player.maxammo[ammo], player.ammo[ammo] + amount);

    if (oldAmmo === 0) {
      if (ammo === AM_CLIP) {
        if (player.readyweapon === WP_FIST || player.pendingweapon === WP_FIST) {
          if (player.weaponowned[WP_CHAINGUN]) {
            player.pendingweapon = WP_CHAINGUN;
          } else if (player.weaponowned[WP_PISTOL]) {
            player.pendingweapon = WP_PISTOL;
          }
        }
      } else if (ammo === AM_SHELL
        && (player.readyweapon === WP_FIST || player.readyweapon === WP_PISTOL)
        && player.weaponowned[WP_SHOTGUN]) {
        player.pendingweapon = WP_SHOTGUN;
      }
    } else if (ammo === AM_CLIP
      && player.readyweapon === WP_PISTOL
      && player.ammo[AM_CLIP] > 0
      && player.pendingweapon === WP_FIST) {
      player.pendingweapon = WP_PISTOL;
    }

    return true;
  }

  /**
   * @param {import('./Player.js').Player} player
   * @param {number} amount
   * @param {number} [cap=MAX_HEALTH]
   */
  giveBody(player, amount, cap = MAX_HEALTH) {
    if (player.health >= cap) {
      return false;
    }
    player.health = Math.min(cap, player.health + amount);
    player.mo.health = player.health;
    return true;
  }

  /** @param {import('./Player.js').Player} player */
  giveBonusHealth(player) {
    if (player.health >= MAX_BONUS_HEALTH) {
      return false;
    }
    player.health++;
    player.mo.health = player.health;
    return true;
  }

  /** @param {import('./Player.js').Player} player */
  giveBonusArmor(player) {
    if (player.armorpoints >= MAX_BONUS_HEALTH) {
      return false;
    }
    player.armorpoints++;
    if (!player.armortype) {
      player.armortype = 1;
    }
    return true;
  }

  /**
   * @param {import('./Player.js').Player} player
   * @param {number} type
   */
  giveArmor(player, type) {
    const hits = type * 100;
    if (player.armorpoints >= hits) {
      return false;
    }
    player.armortype = type;
    player.armorpoints = hits;
    return true;
  }

  /** @param {import('./Player.js').Player} player */
  giveBackpack(player) {
    if (!player.backpack) {
      for (let i = 0; i < player.maxammo.length; i++) {
        player.maxammo[i] *= 2;
      }
      player.backpack = true;
    }

    let gave = false;
    for (let i = 0; i < player.ammo.length; i++) {
      if (this.giveAmmo(player, i, 1)) {
        gave = true;
      }
    }
    return gave;
  }

  /**
   * @param {import('./Player.js').Player} player
   * @param {string} kind
   */
  giveWeapon(player, kind) {
    const info = WEAPON_PICKUPS[kind];
    if (!info) {
      return false;
    }

    let gaveAmmo = false;
    let gaveWeapon = false;

    if (info.ammo !== null) {
      gaveAmmo = this.giveAmmo(player, info.ammo, info.clips);
    }

    if (!player.weaponowned[info.weapon]) {
      player.weaponowned[info.weapon] = true;
      player.bonuscount += 2;
      if (info.weapon === WP_SHOTGUN) {
        player.pendingweapon = WP_SHOTGUN;
      }
      gaveWeapon = true;
    }

    return gaveWeapon || gaveAmmo;
  }

  /** @param {string} kind */
  playPickupSound(kind) {
    if (!this.sound) {
      return;
    }

    const isWeapon = kind.startsWith('weapon_');
    const isPower = ['invuln', 'berserk', 'invis', 'suit', 'automap', 'liteamp', 'soul', 'megasphere'].includes(kind);
    if (isWeapon) {
      this.sound.start('wpnup');
    } else {
      this.sound.start('itemup');
    }
    if (isPower && !isWeapon) {
      // Powerups use the same pickup sting for now.
    }
  }
}

export { MAX_AMMO };
