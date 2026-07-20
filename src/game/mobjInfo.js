import { FRACUNIT } from '../core/renderConstants.js';
import { MF_COUNTITEM, MF_SOLID, MF_SPECIAL } from './mobjFlags.js';
import {
  BARON_HEIGHT,
  BARON_RADIUS,
  BARREL_HEIGHT,
  BARREL_RADIUS,
  CACO_RADIUS,
  CYBER_HEIGHT,
  CYBER_RADIUS,
  DEMON_RADIUS,
  MONSTER_HEIGHT,
  MONSTER_RADIUS,
  SKULL_RADIUS,
  SPIDER_HEIGHT,
  SPIDER_RADIUS,
} from './monster/monsterInfo.js';

/**
 * Map thing definition by editor type / doomednum (info.c — mobjinfo_t subset).
 * @typedef {Object} MobjDef
 * @property {string} sprite Four-letter sprite prefix
 * @property {number} [frame=0]
 * @property {boolean} [fullbright=false]
 * @property {number} flags
 * @property {number} radius
 * @property {number} height
 * @property {string|null} [pickup]
 */

/** @type {Record<number, MobjDef>} */
export const MOBJ_BY_TYPE = {
  // Pickups — weapons
  2001: { sprite: 'SHOT', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'weapon_shotgun' },
  2002: { sprite: 'MGUN', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'weapon_chaingun' },
  2003: { sprite: 'LAUN', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'weapon_launcher' },
  2005: { sprite: 'CSAW', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'weapon_chainsaw' },
  2006: { sprite: 'PLAS', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'weapon_plasma' },
  2010: { sprite: 'BFUG', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'weapon_bfg' },

  // Pickups — ammo
  2007: { sprite: 'CLIP', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'clip' },
  2008: { sprite: 'SHEL', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'shell' },
  2046: { sprite: 'BROK', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'rocketbox' },
  2047: { sprite: 'AMMO', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'clipbox' },
  2048: { sprite: 'AMMO', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'clipbox' },
  2049: { sprite: 'SBOX', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'shellbox' },
  8: { sprite: 'BPAK', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'backpack' },

  // Pickups — health / armor / bonuses
  2011: { sprite: 'STIM', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'stim' },
  2012: { sprite: 'MEDI', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'medi' },
  2013: { sprite: 'SOUL', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'soul' },
  2014: { sprite: 'BON1', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'bonus_health' },
  2015: { sprite: 'BON2', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'bonus_armor' },
  2018: { sprite: 'ARM1', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'armor_green' },
  2019: { sprite: 'ARM2', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'armor_blue' },
  2022: { sprite: 'PINV', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'invuln' },
  2023: { sprite: 'PSTR', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'berserk' },
  2024: { sprite: 'PINS', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'invis' },
  2025: { sprite: 'SUIT', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'suit' },
  2026: { sprite: 'PMAP', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'automap' },
  2045: { sprite: 'PVIS', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'liteamp' },
  83: { sprite: 'MEGA', flags: MF_SPECIAL | MF_COUNTITEM, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'megasphere' },

  // Keys (info.c — MT_MISC4–9)
  5: { sprite: 'BKEY', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'key_blue' },
  6: { sprite: 'YKEY', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'key_yellow' },
  13: { sprite: 'RKEY', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'key_red' },
  40: { sprite: 'BSKU', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'skull_blue' },
  39: { sprite: 'YSKU', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'skull_yellow' },
  38: { sprite: 'RSKU', flags: MF_SPECIAL, radius: 20 * FRACUNIT, height: 16 * FRACUNIT, pickup: 'skull_red' },

  // Decorations (E1M1 and common)
  10: { sprite: 'PLAY', frame: 22, flags: 0, radius: 20 * FRACUNIT, height: 16 * FRACUNIT },
  12: { sprite: 'PLAY', frame: 22, flags: 0, radius: 20 * FRACUNIT, height: 16 * FRACUNIT },
  15: { sprite: 'PLAY', frame: 13, flags: 0, radius: 20 * FRACUNIT, height: 16 * FRACUNIT },
  24: { sprite: 'POL5', frame: 0, flags: 0, radius: 20 * FRACUNIT, height: 16 * FRACUNIT },
  30: { sprite: 'COL1', flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  31: { sprite: 'COL3', flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  35: { sprite: 'CBRA', fullbright: true, flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  36: { sprite: 'COL6', flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  41: { sprite: 'CEYE', flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  42: { sprite: 'FSKU', flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  43: { sprite: 'TRE1', flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  44: { sprite: 'TBLU', fullbright: true, flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  45: { sprite: 'TGRN', fullbright: true, flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  46: { sprite: 'TRED', fullbright: true, flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  48: { sprite: 'ELEC', flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  55: { sprite: 'SMBT', fullbright: true, flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },
  2028: { sprite: 'COLU', fullbright: true, flags: MF_SOLID, radius: 16 * FRACUNIT, height: 16 * FRACUNIT },

  // Monsters (info.c doomednums — Doom 1)
  3004: { sprite: 'POSS', flags: 0, radius: MONSTER_RADIUS, height: MONSTER_HEIGHT, monster: true },
  9: { sprite: 'SPOS', flags: 0, radius: MONSTER_RADIUS, height: MONSTER_HEIGHT, monster: true },
  3001: { sprite: 'TROO', flags: 0, radius: MONSTER_RADIUS, height: MONSTER_HEIGHT, monster: true },
  3002: { sprite: 'SARG', flags: 0, radius: DEMON_RADIUS, height: MONSTER_HEIGHT, monster: true },
  58: { sprite: 'SARG', flags: 0, radius: DEMON_RADIUS, height: MONSTER_HEIGHT, monster: true },
  3005: { sprite: 'HEAD', flags: 0, radius: CACO_RADIUS, height: MONSTER_HEIGHT, monster: true },
  3003: { sprite: 'BOSS', flags: 0, radius: BARON_RADIUS, height: BARON_HEIGHT, monster: true },
  3006: { sprite: 'SKUL', flags: 0, radius: SKULL_RADIUS, height: MONSTER_HEIGHT, monster: true },
  7: { sprite: 'SPID', flags: 0, radius: SPIDER_RADIUS, height: SPIDER_HEIGHT, monster: true },
  16: { sprite: 'CYBR', flags: 0, radius: CYBER_RADIUS, height: CYBER_HEIGHT, monster: true },
  2035: { sprite: 'BAR1', flags: 0, radius: BARREL_RADIUS, height: BARREL_HEIGHT, monster: true },
};

/**
 * @param {number} type
 * @returns {MobjDef|null}
 */
export function mobjDefForType(type) {
  return MOBJ_BY_TYPE[type] ?? null;
}
