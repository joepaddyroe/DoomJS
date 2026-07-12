import {
  ANGLETURN,
  FORWARDMOVE,
  SIDEMOVE,
} from '../../core/gameConstants.js';
import { createTicCmd } from '../../game/TicCmd.js';

/**
 * Keyboard to ticcmd mapping (g_game.c — G_BuildTiccmd).
 */
export class KeyboardInput {
  constructor() {
    /** @type {Set<string>} */
    this.keys = new Set();
    this.speed = 1;
    this.turnSpeed = 1;
    this.enabled = false;

    this._onKeyDown = (event) => {
      if (!this.enabled) {
        return;
      }
      this.keys.add(event.code);
      if (this._isGameKey(event.code)) {
        event.preventDefault();
      }
    };

    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
      if (this._isGameKey(event.code)) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /** @param {boolean} enabled */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
    }
  }

  /** @param {string} code */
  _isGameKey(code) {
    return code.startsWith('Arrow')
      || code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD';
  }

  /** @returns {import('../../game/TicCmd.js').TicCmd} */
  buildTicCmd() {
    const cmd = createTicCmd();
    if (!this.enabled) {
      return cmd;
    }

    const forwardSpeed = FORWARDMOVE[this.speed];
    const sideSpeed = SIDEMOVE[this.speed];
    const turnSpeed = ANGLETURN[this.turnSpeed];

    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) {
      cmd.forwardmove += forwardSpeed;
    }
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) {
      cmd.forwardmove -= forwardSpeed;
    }
    if (this.keys.has('KeyA')) {
      cmd.sidemove -= sideSpeed;
    }
    if (this.keys.has('KeyD')) {
      cmd.sidemove += sideSpeed;
    }
    if (this.keys.has('ArrowLeft')) {
      cmd.angleturn += turnSpeed;
    }
    if (this.keys.has('ArrowRight')) {
      cmd.angleturn -= turnSpeed;
    }

    return cmd;
  }
}
