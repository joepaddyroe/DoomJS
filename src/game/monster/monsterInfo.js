import { FRACUNIT } from '../../core/renderConstants.js';
import {
  MF_COUNTKILL,
  MF_FLOAT,
  MF_NOBLOOD,
  MF_NOGRAVITY,
  MF_SHADOW,
  MF_SHOOTABLE,
  MF_SOLID,
} from '../mobjFlags.js';
import {
  BARREL_STATES,
  BOSS_STATES,
  CYBER_STATES,
  HEAD_STATES,
  POSS_STATES,
  SARG_STATES,
  SKULL_STATES,
  SPID_STATES,
  SPOS_STATES,
  TROO_STATES,
} from './monsterStates.js';

/**
 * @typedef {Object} MonsterArchetype
 * @property {string} id
 * @property {Record<string, import('./monsterStates.js').MonsterState>} states
 * @property {string} spawnState
 * @property {string|null} seeState
 * @property {string|null} painState
 * @property {string|null} meleeState
 * @property {string|null} missileState
 * @property {string} deathState
 * @property {string|null} xdeathState
 * @property {number} spawnhealth
 * @property {number} speed
 * @property {number} mass
 * @property {number} painchance
 * @property {number} reactiontime
 * @property {number} flags
 * @property {number} [damage] Melee / skull slam multiplier (info.c)
 * @property {string|null} seeSound
 * @property {string|null} painSound
 * @property {string|null} deathSound
 * @property {string|null} activeSound
 * @property {string|null} attackSound
 * @property {'clip' | 'shotgun'|null} [dropItem]
 * @property {number} [dropChance]
 */

/** @type {Record<string, MonsterArchetype>} */
export const MONSTER_ARCHETYPES = {
  possessed: {
    id: 'possessed',
    states: POSS_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: null,
    missileState: 'ATK1',
    deathState: 'DIE1',
    xdeathState: 'XDIE1',
    spawnhealth: 20,
    speed: 8,
    mass: 100,
    painchance: 200,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL,
    seeSound: 'posit1',
    painSound: 'popain',
    deathSound: 'podth1',
    activeSound: 'posact',
    attackSound: null,
    dropItem: 'clip',
    dropChance: 20,
  },
  shotguy: {
    id: 'shotguy',
    states: SPOS_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: null,
    missileState: 'ATK1',
    deathState: 'DIE1',
    xdeathState: 'XDIE1',
    spawnhealth: 30,
    speed: 8,
    mass: 100,
    painchance: 170,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL,
    seeSound: 'posit2',
    painSound: 'popain',
    deathSound: 'podth2',
    activeSound: 'posact',
    attackSound: null,
    dropItem: 'shotgun',
    dropChance: 0,
  },
  troop: {
    id: 'troop',
    states: TROO_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: 'ATK1',
    missileState: 'ATK1',
    deathState: 'DIE1',
    xdeathState: 'XDIE1',
    spawnhealth: 60,
    speed: 8,
    mass: 100,
    painchance: 200,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL,
    seeSound: 'bgsit1',
    painSound: 'popain',
    deathSound: 'bgdth1',
    activeSound: 'bgact',
    attackSound: 'claw',
    dropItem: 'clip',
    dropChance: 60,
  },
  sergeant: {
    id: 'sergeant',
    states: SARG_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: 'ATK1',
    missileState: null,
    deathState: 'DIE1',
    xdeathState: null,
    spawnhealth: 150,
    speed: 10,
    mass: 400,
    painchance: 180,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL,
    seeSound: 'sgtsit',
    painSound: 'dmpain',
    deathSound: 'sgtdth',
    activeSound: 'dmact',
    attackSound: 'sgtatk',
  },
  shadows: {
    id: 'shadows',
    states: SARG_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: 'ATK1',
    missileState: null,
    deathState: 'DIE1',
    xdeathState: null,
    spawnhealth: 150,
    speed: 10,
    mass: 400,
    painchance: 180,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_SHADOW | MF_COUNTKILL,
    seeSound: 'sgtsit',
    painSound: 'dmpain',
    deathSound: 'sgtdth',
    activeSound: 'dmact',
    attackSound: 'sgtatk',
  },
  head: {
    id: 'head',
    states: HEAD_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: null,
    missileState: 'ATK1',
    deathState: 'DIE1',
    xdeathState: null,
    spawnhealth: 400,
    speed: 8,
    mass: 400,
    painchance: 128,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_FLOAT | MF_NOGRAVITY | MF_COUNTKILL,
    seeSound: 'cacsit',
    painSound: 'dmpain',
    deathSound: 'cacdth',
    activeSound: 'dmact',
    attackSound: null,
  },
  bruiser: {
    id: 'bruiser',
    states: BOSS_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: 'ATK1',
    missileState: 'ATK1',
    deathState: 'DIE1',
    xdeathState: null,
    spawnhealth: 1000,
    speed: 8,
    mass: 1000,
    painchance: 50,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL,
    seeSound: 'brssit',
    painSound: 'dmpain',
    deathSound: 'brsdth',
    activeSound: 'dmact',
    attackSound: null,
  },
  skull: {
    id: 'skull',
    states: SKULL_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: null,
    missileState: 'ATK1',
    deathState: 'DIE1',
    xdeathState: null,
    spawnhealth: 100,
    speed: 8,
    mass: 50,
    painchance: 256,
    reactiontime: 8,
    damage: 3,
    flags: MF_SOLID | MF_SHOOTABLE | MF_FLOAT | MF_NOGRAVITY,
    seeSound: null,
    painSound: 'dmpain',
    deathSound: 'firxpl',
    activeSound: 'dmact',
    attackSound: 'sklatk',
  },
  spider: {
    id: 'spider',
    states: SPID_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: null,
    missileState: 'ATK1',
    deathState: 'DIE1',
    xdeathState: null,
    spawnhealth: 3000,
    speed: 12,
    mass: 1000,
    painchance: 40,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL,
    seeSound: 'spisit',
    painSound: 'dmpain',
    deathSound: 'spidth',
    activeSound: 'dmact',
    attackSound: 'shotgn',
  },
  cyborg: {
    id: 'cyborg',
    states: CYBER_STATES,
    spawnState: 'STND',
    seeState: 'RUN1',
    painState: 'PAIN',
    meleeState: null,
    missileState: 'ATK1',
    deathState: 'DIE1',
    xdeathState: null,
    spawnhealth: 4000,
    speed: 16,
    mass: 1000,
    painchance: 20,
    reactiontime: 8,
    flags: MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL,
    seeSound: 'cybsit',
    painSound: 'dmpain',
    deathSound: 'cybdth',
    activeSound: 'dmact',
    attackSound: null,
  },
  barrel: {
    id: 'barrel',
    states: BARREL_STATES,
    spawnState: 'IDLE1',
    seeState: null,
    painState: null,
    meleeState: null,
    missileState: null,
    deathState: 'BEXP1',
    xdeathState: null,
    spawnhealth: 20,
    speed: 0,
    mass: 100,
    painchance: 0,
    reactiontime: 0,
    flags: MF_SOLID | MF_SHOOTABLE | MF_NOBLOOD,
    seeSound: null,
    painSound: null,
    deathSound: 'barexp',
    activeSound: null,
    attackSound: null,
  },
};

/** Map editor type → monster archetype id (info.c doomednum). */
export const MONSTER_MAP_TYPES = {
  3004: 'possessed',
  9: 'shotguy',
  3001: 'troop',
  3002: 'sergeant',
  58: 'shadows',
  3005: 'head',
  3003: 'bruiser',
  3006: 'skull',
  7: 'spider',
  16: 'cyborg',
  2035: 'barrel',
};

/**
 * @param {number} type
 * @returns {MonsterArchetype|null}
 */
export function monsterArchetypeForType(type) {
  const id = MONSTER_MAP_TYPES[type];
  return id ? MONSTER_ARCHETYPES[id] : null;
}

/**
 * @param {string} archetypeId
 * @param {string} stateName
 * @returns {import('./monsterStates.js').MonsterState|null}
 */
export function monsterStateFor(archetypeId, stateName) {
  const arch = MONSTER_ARCHETYPES[archetypeId];
  return arch?.states[stateName] ?? null;
}

/** Shared dimensions for humanoid monsters (info.c mobjinfo). */
export const MONSTER_RADIUS = 20 * FRACUNIT;
export const MONSTER_HEIGHT = 56 * FRACUNIT;
export const BARREL_RADIUS = 10 * FRACUNIT;
export const BARREL_HEIGHT = 42 * FRACUNIT;
export const DEMON_RADIUS = 30 * FRACUNIT;
export const CACO_RADIUS = 31 * FRACUNIT;
export const BARON_RADIUS = 24 * FRACUNIT;
export const BARON_HEIGHT = 64 * FRACUNIT;
export const SKULL_RADIUS = 16 * FRACUNIT;
export const SPIDER_RADIUS = 128 * FRACUNIT;
export const SPIDER_HEIGHT = 100 * FRACUNIT;
export const CYBER_RADIUS = 40 * FRACUNIT;
export const CYBER_HEIGHT = 110 * FRACUNIT;
