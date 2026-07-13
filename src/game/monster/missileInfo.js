import { FRACUNIT } from '../../core/renderConstants.js';
import { MF_DROPOFF, MF_MISSILE, MF_NOGRAVITY } from '../mobjFlags.js';
import { TROOPSHOT_STATES } from './missileStates.js';

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
  },
};
