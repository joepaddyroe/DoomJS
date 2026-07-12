import { VIEWHEIGHT } from '../core/gameConstants.js';
import { createPlayerMobj } from './Mobj.js';

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
    this.viewheight = VIEWHEIGHT;
    this.viewheightBase = VIEWHEIGHT;
    this.deltaviewheight = 0;
    this.viewz = mo.z + VIEWHEIGHT;
    this.reactiontime = 0;
  }

  /** @returns {{ x: number, y: number, z: number, angle: number }} */
  view() {
    return {
      x: this.mo.x,
      y: this.mo.y,
      z: this.viewz,
      angle: this.mo.angle,
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
