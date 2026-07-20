/**
 * Projectile animation states (info.c — S_TBALL*, S_TBALLX*).
 * @typedef {{ sprite: string, frame: number, tics: number, next: string|null, fullbright?: boolean }} MissileState
 */

/** @type {Record<string, MissileState>} */
export const TROOPSHOT_STATES = {
  FLY1: { sprite: 'BAL1', frame: 0, tics: 4, next: 'FLY2', fullbright: true },
  FLY2: { sprite: 'BAL1', frame: 1, tics: 4, next: 'FLY1', fullbright: true },
  X1: { sprite: 'BAL1', frame: 2, tics: 6, next: 'X2', fullbright: true },
  X2: { sprite: 'BAL1', frame: 3, tics: 6, next: 'X3', fullbright: true },
  X3: { sprite: 'BAL1', frame: 4, tics: 6, next: null, fullbright: true },
};
export const HEADSHOT_STATES = {
  FLY1: { sprite: 'BAL2', frame: 0, tics: 4, next: 'FLY2', fullbright: true },
  FLY2: { sprite: 'BAL2', frame: 1, tics: 4, next: 'FLY1', fullbright: true },
  X1: { sprite: 'BAL2', frame: 2, tics: 6, next: 'X2', fullbright: true },
  X2: { sprite: 'BAL2', frame: 3, tics: 6, next: 'X3', fullbright: true },
  X3: { sprite: 'BAL2', frame: 4, tics: 6, next: null, fullbright: true },
};

export const BRUISERSHOT_STATES = {
  FLY1: { sprite: 'BAL7', frame: 0, tics: 4, next: 'FLY2', fullbright: true },
  FLY2: { sprite: 'BAL7', frame: 1, tics: 4, next: 'FLY1', fullbright: true },
  X1: { sprite: 'BAL7', frame: 2, tics: 6, next: 'X2', fullbright: true },
  X2: { sprite: 'BAL7', frame: 3, tics: 6, next: 'X3', fullbright: true },
  X3: { sprite: 'BAL7', frame: 4, tics: 6, next: null, fullbright: true },
};
