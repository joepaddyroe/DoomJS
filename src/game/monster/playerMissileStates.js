/**
 * Player projectile animation states (info.c — S_ROCKET*, S_PLASBALL*, S_BFG*).
 * @typedef {{ sprite: string, frame: number, tics: number, next: string|null, fullbright?: boolean }} MissileState
 */

/** @type {Record<string, MissileState>} */
export const ROCKET_STATES = {
  FLY1: { sprite: 'MISL', frame: 0, tics: 1, next: 'FLY1', fullbright: true },
  X1: { sprite: 'MISL', frame: 1, tics: 8, next: 'X2', fullbright: true },
  X2: { sprite: 'MISL', frame: 2, tics: 6, next: 'X3', fullbright: true },
  X3: { sprite: 'MISL', frame: 3, tics: 4, next: null, fullbright: true },
};

/** @type {Record<string, MissileState>} */
export const PLASMA_STATES = {
  FLY1: { sprite: 'PLSB', frame: 0, tics: 4, next: 'FLY2', fullbright: true },
  FLY2: { sprite: 'PLSB', frame: 1, tics: 4, next: 'FLY1', fullbright: true },
  X1: { sprite: 'PLSE', frame: 0, tics: 6, next: 'X2', fullbright: true },
  X2: { sprite: 'PLSE', frame: 1, tics: 6, next: 'X3', fullbright: true },
  X3: { sprite: 'PLSE', frame: 2, tics: 6, next: null, fullbright: true },
};

/** @type {Record<string, MissileState>} */
export const BFG_STATES = {
  FLY1: { sprite: 'BFS1', frame: 0, tics: 4, next: 'FLY2', fullbright: true },
  FLY2: { sprite: 'BFS1', frame: 1, tics: 4, next: 'FLY1', fullbright: true },
  X1: { sprite: 'BFE1', frame: 0, tics: 8, next: 'X2', fullbright: true },
  X2: { sprite: 'BFE1', frame: 1, tics: 8, next: 'X3', fullbright: true },
  X3: { sprite: 'BFE1', frame: 2, tics: 8, next: 'X4', fullbright: true },
  X4: { sprite: 'BFE1', frame: 3, tics: 8, next: 'X5', fullbright: true },
  X5: { sprite: 'BFE1', frame: 4, tics: 8, next: 'X6', fullbright: true },
  X6: { sprite: 'BFE1', frame: 5, tics: 8, next: null, fullbright: true },
};
