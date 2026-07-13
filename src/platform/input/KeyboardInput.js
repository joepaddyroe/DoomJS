import {
  ANGLETURN,
  FORWARDMOVE,
  SIDEMOVE,
} from '../../core/gameConstants.js';
import { BT_ATTACK, BT_USE, weaponChangeButtons } from '../../core/inputButtons.js';
import { createTicCmd } from '../../game/TicCmd.js';

/**
 * Keyboard to ticcmd mapping (g_game.c — G_BuildTiccmd).
 */
export class KeyboardInput {
  constructor() {
    /** @type {Set<string>} */
    this.keys = new Set();
    /** @type {Set<string>} */
    this.justPressed = new Set();
    this.speed = 1;
    this.turnSpeed = 1;
    this.enabled = false;

    this._onKeyDown = (event) => {
      if (!this.enabled) {
        return;
      }
      if (!this.keys.has(event.code)) {
        this.justPressed.add(event.code);
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

  /** Clear one-shot key presses at the end of each tic. */
  endFrame() {
    this.justPressed.clear();
  }

  /** @param {string} code */
  consumeJustPressed(code) {
    if (!this.enabled || !this.justPressed.has(code)) {
      return false;
    }
    this.justPressed.delete(code);
    return true;
  }

  /** @param {string} code */
  _isGameKey(code) {
    return code.startsWith('Arrow')
      || code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD'
      || code === 'ControlLeft' || code === 'ControlRight'
      || code === 'Space'
      || code === 'KeyE' || code === 'Enter'
      || code === 'KeyR'
      || (code >= 'Digit1' && code <= 'Digit7');
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
    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('Space')) {
      cmd.buttons |= BT_ATTACK;
    }
    if (this.keys.has('KeyE') || this.keys.has('Enter')) {
      cmd.buttons |= BT_USE;
    }

    for (let weapon = 0; weapon < 7; weapon++) {
      if (this.keys.has(`Digit${weapon + 1}`)) {
        cmd.buttons |= weaponChangeButtons(weapon);
        break;
      }
    }

    return cmd;
  }
}
