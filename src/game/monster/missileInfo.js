import { FRACUNIT } from '../../core/renderConstants.js';
import { MF_DROPOFF, MF_MISSILE, MF_NOGRAVITY } from '../mobjFlags.js';
import { BRUISERSHOT_STATES, HEADSHOT_STATES, TROOPSHOT_STATES } from './missileStates.js';
import { BFG_STATES, PLASMA_STATES, ROCKET_STATES } from './playerMissileStates.js';

/**
 * @typedef {Object} MissileArchetype
 * @property {string} id
 * @property {Record<string, import('./missileStates.js').MissileState>} states
 * @property {string} spawnState
 * @property {string} deathState
 * @property {number} speed
 * @property {number} radius
 * @property {number} height
 * @property {number} damage
 * @property {number} flags
 * @property {string|null} spawnSound
 * @property {string|null} deathSound
 * @property {'direct'|'radius'|'bfg'} [hitType]
 * @property {number} [radiusDamage]
 */

/** @type {Record<string, MissileArchetype>} */
export const MISSILE_ARCHETYPES = {
  troopshot: {
    id: 'troopshot',
    states: TROOPSHOT_STATES,
    spawnState: 'FLY1',
    deathState: 'X1',
    speed: 10 * FRACUNIT,
    radius: 6 * FRACUNIT,
    height: 8 * FRACUNIT,
    damage: 3,
    flags: MF_MISSILE | MF_DROPOFF | MF_NOGRAVITY,
    spawnSound: 'firsht',
    deathSound: 'firxpl',
    hitType: 'direct',
  },
  headshot: {
    id: 'headshot',
    states: HEADSHOT_STATES,
    spawnState: 'FLY1',
    deathState: 'X1',
    speed: 10 * FRACUNIT,
    radius: 6 * FRACUNIT,
    height: 8 * FRACUNIT,
    damage: 5,
    flags: MF_MISSILE | MF_DROPOFF | MF_NOGRAVITY,
    spawnSound: 'firsht',
    deathSound: 'firxpl',
    hitType: 'direct',
  },
  bruisershot: {
    id: 'bruisershot',
    states: BRUISERSHOT_STATES,
    spawnState: 'FLY1',
    deathState: 'X1',
    speed: 15 * FRACUNIT,
    radius: 6 * FRACUNIT,
    height: 8 * FRACUNIT,
    damage: 8,
    flags: MF_MISSILE | MF_DROPOFF | MF_NOGRAVITY,
    spawnSound: 'firsht',
    deathSound: 'firxpl',
    hitType: 'direct',
  },
  rocket: {
    id: 'rocket',
    states: ROCKET_STATES,
    spawnState: 'FLY1',
    deathState: 'X1',
    speed: 20 * FRACUNIT,
    radius: 11 * FRACUNIT,
    height: 8 * FRACUNIT,
    damage: 20,
    flags: MF_MISSILE | MF_DROPOFF | MF_NOGRAVITY,
    spawnSound: 'rlaunc',
    deathSound: 'barexp',
    hitType: 'radius',
    radiusDamage: 128,
  },
  plasma: {
    id: 'plasma',
    states: PLASMA_STATES,
    spawnState: 'FLY1',
    deathState: 'X1',
    speed: 25 * FRACUNIT,
    radius: 13 * FRACUNIT,
    height: 8 * FRACUNIT,
    damage: 5,
    flags: MF_MISSILE | MF_DROPOFF | MF_NOGRAVITY,
    spawnSound: 'plasma',
    deathSound: 'firxpl',
    hitType: 'direct',
  },
  bfg: {
    id: 'bfg',
    states: BFG_STATES,
    spawnState: 'FLY1',
    deathState: 'X1',
    speed: 25 * FRACUNIT,
    radius: 13 * FRACUNIT,
    height: 8 * FRACUNIT,
    damage: 100,
    flags: MF_MISSILE | MF_DROPOFF | MF_NOGRAVITY,
    spawnSound: null,
    deathSound: 'rxplod',
    hitType: 'bfg',
  },
};
