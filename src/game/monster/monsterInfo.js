import { FRACUNIT } from '../../core/renderConstants.js';
import { MF_COUNTKILL, MF_NOBLOOD, MF_SHOOTABLE, MF_SOLID } from '../mobjFlags.js';
import { BARREL_STATES, POSS_STATES, TROO_STATES } from './monsterStates.js';

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

/** Map editor type → monster archetype id. */
export const MONSTER_MAP_TYPES = {
  3004: 'possessed',
  3001: 'troop',
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

/** Shared dimensions for E1M1 monsters (info.c mobjinfo). */
export const MONSTER_RADIUS = 20 * FRACUNIT;
export const MONSTER_HEIGHT = 56 * FRACUNIT;
export const BARREL_RADIUS = 10 * FRACUNIT;
export const BARREL_HEIGHT = 42 * FRACUNIT;
