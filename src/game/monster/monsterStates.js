/**
 * Monster state tables (info.c — S_POSS_*, S_TROO_*, S_BAR*, S_BEXP*).
 * @typedef {{ sprite: string, frame: number, tics: number, action: string|null, next: string|null, fullbright?: boolean }} MonsterState
 */

/** @type {Record<string, MonsterState>} */
export const POSS_STATES = {
  STND: { sprite: 'POSS', frame: 0, tics: 10, action: 'A_Look', next: 'STND2' },
  STND2: { sprite: 'POSS', frame: 1, tics: 10, action: 'A_Look', next: 'STND' },
  RUN1: { sprite: 'POSS', frame: 0, tics: 4, action: 'A_Chase', next: 'RUN2' },
  RUN2: { sprite: 'POSS', frame: 0, tics: 4, action: 'A_Chase', next: 'RUN3' },
  RUN3: { sprite: 'POSS', frame: 1, tics: 4, action: 'A_Chase', next: 'RUN4' },
  RUN4: { sprite: 'POSS', frame: 1, tics: 4, action: 'A_Chase', next: 'RUN5' },
  RUN5: { sprite: 'POSS', frame: 2, tics: 4, action: 'A_Chase', next: 'RUN6' },
  RUN6: { sprite: 'POSS', frame: 2, tics: 4, action: 'A_Chase', next: 'RUN7' },
  RUN7: { sprite: 'POSS', frame: 3, tics: 4, action: 'A_Chase', next: 'RUN8' },
  RUN8: { sprite: 'POSS', frame: 3, tics: 4, action: 'A_Chase', next: 'RUN1' },
  ATK1: { sprite: 'POSS', frame: 4, tics: 10, action: 'A_FaceTarget', next: 'ATK2' },
  ATK2: { sprite: 'POSS', frame: 5, tics: 8, action: 'A_PosAttack', next: 'ATK3' },
  ATK3: { sprite: 'POSS', frame: 4, tics: 8, action: null, next: 'RUN1' },
  PAIN: { sprite: 'POSS', frame: 6, tics: 3, action: null, next: 'PAIN2' },
  PAIN2: { sprite: 'POSS', frame: 6, tics: 3, action: 'A_Pain', next: 'RUN1' },
  DIE1: { sprite: 'POSS', frame: 7, tics: 5, action: null, next: 'DIE2' },
  DIE2: { sprite: 'POSS', frame: 8, tics: 5, action: 'A_Scream', next: 'DIE3' },
  DIE3: { sprite: 'POSS', frame: 9, tics: 5, action: 'A_Fall', next: 'DIE4' },
  DIE4: { sprite: 'POSS', frame: 10, tics: 5, action: null, next: 'DIE5' },
  DIE5: { sprite: 'POSS', frame: 11, tics: -1, action: null, next: null },
  XDIE1: { sprite: 'POSS', frame: 12, tics: 5, action: null, next: 'XDIE2' },
  XDIE2: { sprite: 'POSS', frame: 13, tics: 5, action: 'A_XScream', next: 'XDIE3' },
  XDIE3: { sprite: 'POSS', frame: 14, tics: 5, action: 'A_Fall', next: 'XDIE4' },
  XDIE4: { sprite: 'POSS', frame: 15, tics: 5, action: null, next: 'XDIE5' },
  XDIE5: { sprite: 'POSS', frame: 16, tics: 5, action: null, next: 'XDIE6' },
  XDIE6: { sprite: 'POSS', frame: 17, tics: 5, action: null, next: 'XDIE7' },
  XDIE7: { sprite: 'POSS', frame: 18, tics: 5, action: null, next: 'XDIE8' },
  XDIE8: { sprite: 'POSS', frame: 19, tics: 5, action: null, next: 'XDIE9' },
  XDIE9: { sprite: 'POSS', frame: 20, tics: -1, action: null, next: null },
};

/** @type {Record<string, MonsterState>} */
export const TROO_STATES = {
  STND: { sprite: 'TROO', frame: 0, tics: 10, action: 'A_Look', next: 'STND2' },
  STND2: { sprite: 'TROO', frame: 1, tics: 10, action: 'A_Look', next: 'STND' },
  RUN1: { sprite: 'TROO', frame: 0, tics: 3, action: 'A_Chase', next: 'RUN2' },
  RUN2: { sprite: 'TROO', frame: 0, tics: 3, action: 'A_Chase', next: 'RUN3' },
  RUN3: { sprite: 'TROO', frame: 1, tics: 3, action: 'A_Chase', next: 'RUN4' },
  RUN4: { sprite: 'TROO', frame: 1, tics: 3, action: 'A_Chase', next: 'RUN5' },
  RUN5: { sprite: 'TROO', frame: 2, tics: 3, action: 'A_Chase', next: 'RUN6' },
  RUN6: { sprite: 'TROO', frame: 2, tics: 3, action: 'A_Chase', next: 'RUN7' },
  RUN7: { sprite: 'TROO', frame: 3, tics: 3, action: 'A_Chase', next: 'RUN8' },
  RUN8: { sprite: 'TROO', frame: 3, tics: 3, action: 'A_Chase', next: 'RUN1' },
  ATK1: { sprite: 'TROO', frame: 4, tics: 8, action: 'A_FaceTarget', next: 'ATK2' },
  ATK2: { sprite: 'TROO', frame: 5, tics: 8, action: 'A_FaceTarget', next: 'ATK3' },
  ATK3: { sprite: 'TROO', frame: 6, tics: 6, action: 'A_TroopAttack', next: 'RUN1' },
  PAIN: { sprite: 'TROO', frame: 7, tics: 2, action: null, next: 'PAIN2' },
  PAIN2: { sprite: 'TROO', frame: 7, tics: 2, action: 'A_Pain', next: 'RUN1' },
  DIE1: { sprite: 'TROO', frame: 8, tics: 8, action: null, next: 'DIE2' },
  DIE2: { sprite: 'TROO', frame: 9, tics: 8, action: 'A_Scream', next: 'DIE3' },
  DIE3: { sprite: 'TROO', frame: 10, tics: 6, action: null, next: 'DIE4' },
  DIE4: { sprite: 'TROO', frame: 11, tics: 6, action: 'A_Fall', next: 'DIE5' },
  DIE5: { sprite: 'TROO', frame: 12, tics: -1, action: null, next: null },
  XDIE1: { sprite: 'TROO', frame: 13, tics: 5, action: null, next: 'XDIE2' },
  XDIE2: { sprite: 'TROO', frame: 14, tics: 5, action: 'A_XScream', next: 'XDIE3' },
  XDIE3: { sprite: 'TROO', frame: 15, tics: 5, action: null, next: 'XDIE4' },
  XDIE4: { sprite: 'TROO', frame: 16, tics: 5, action: 'A_Fall', next: 'XDIE5' },
  XDIE5: { sprite: 'TROO', frame: 17, tics: 5, action: null, next: 'XDIE6' },
  XDIE6: { sprite: 'TROO', frame: 18, tics: 5, action: null, next: 'XDIE7' },
  XDIE7: { sprite: 'TROO', frame: 19, tics: 5, action: null, next: 'XDIE8' },
  XDIE8: { sprite: 'TROO', frame: 20, tics: -1, action: null, next: null },
};

/** @type {Record<string, MonsterState>} */
export const BARREL_STATES = {
  IDLE1: { sprite: 'BAR1', frame: 0, tics: 6, action: null, next: 'IDLE2' },
  IDLE2: { sprite: 'BAR1', frame: 1, tics: 6, action: null, next: 'IDLE1' },
  BEXP1: { sprite: 'BEXP', frame: 0, tics: 5, action: null, next: 'BEXP2', fullbright: true },
  BEXP2: { sprite: 'BEXP', frame: 1, tics: 5, action: 'A_Scream', next: 'BEXP3', fullbright: true },
  BEXP3: { sprite: 'BEXP', frame: 2, tics: 5, action: null, next: 'BEXP4', fullbright: true },
  BEXP4: { sprite: 'BEXP', frame: 3, tics: 10, action: 'A_Explode', next: 'BEXP5', fullbright: true },
  BEXP5: { sprite: 'BEXP', frame: 4, tics: 10, action: null, next: null, fullbright: true },
};
