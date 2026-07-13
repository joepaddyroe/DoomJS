import {
  FORWARDMOVE,
  SIDEMOVE,
} from '../../core/gameConstants.js';
import { BT_ATTACK, BT_USE, weaponChangeButtons } from '../../core/inputButtons.js';
import { createTicCmd } from '../../game/TicCmd.js';

/**
 * Keyboard + mouse button input (g_game.c — G_BuildTiccmd).
 */
export class KeyboardInput {
  constructor() {
    /** @type {Set<string>} */
    this.keys = new Set();
    /** @type {Set<string>} */
    this.justPressed = new Set();
    this.speed = 1;
    this.enabled = false;
    this.mouseAttack = false;
    this.mouseUse = false;
    this.pendingActivate = false;
    /** @type {(() => boolean)|null} */
    this.combatEnabled = null;
    /** @type {HTMLCanvasElement|null} */
    this.canvas = null;
    /** @type {import('./MouseLook.js').MouseLook|null} */
    this.mouseLook = null;

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

    this._onMouseDown = (event) => {
      if (!this.canvas || event.target !== this.canvas) {
        return;
      }
      if (event.button === 0) {
        this.pendingActivate = true;
        if (this.combatEnabled?.()) {
          this.mouseAttack = true;
        }
      } else if (event.button === 2) {
        event.preventDefault();
        this.mouseUse = true;
      }
      this.mouseLook?.handlePress(event);
    };

    this._onMouseUp = (event) => {
      if (event.button === 0) {
        this.mouseAttack = false;
      } else if (event.button === 2) {
        this.mouseUse = false;
      }
    };

    this._onContextMenu = (event) => {
      if (this.canvas && event.target === this.canvas) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('contextmenu', this._onContextMenu);
  }

  /**
   * @param {HTMLCanvasElement} canvas
   */
  attachCanvas(canvas) {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this._onMouseDown);
    }
    this.canvas = canvas;
    canvas.addEventListener('mousedown', this._onMouseDown);
  }

  /** @param {() => boolean} fn */
  setCombatEnabled(fn) {
    this.combatEnabled = fn;
  }

  /** @param {import('./MouseLook.js').MouseLook} mouseLook */
  setMouseLook(mouseLook) {
    this.mouseLook = mouseLook;
  }

  /** @param {boolean} enabled */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.mouseAttack = false;
      this.mouseUse = false;
    }
  }

  clearMouseButtons() {
    this.mouseAttack = false;
    this.mouseUse = false;
  }

  /** Clear one-shot key presses at the end of each tic. */
  endFrame() {
    this.justPressed.clear();
  }

  /** @returns {string|null} First key or canvas click this frame, or null. */
  consumeAnyKey() {
    if (!this.enabled) {
      return null;
    }
    if (this.pendingActivate) {
      this.pendingActivate = false;
      return 'Mouse0';
    }
    if (this.justPressed.size === 0) {
      return null;
    }
    const code = this.justPressed.values().next().value;
    this.justPressed.delete(code);
    return code;
  }

  /**
   * Menu hotkey letter/digit for the current frame.
   * @returns {string|null}
   */
  consumeMenuHotkey() {
    if (!this.enabled) {
      return null;
    }

    for (const code of this.justPressed) {
      if (code.startsWith('Key') && code.length === 4) {
        this.justPressed.delete(code);
        return code.slice(3).toLowerCase();
      }
      if (code.startsWith('Digit') && code.length === 6) {
        this.justPressed.delete(code);
        return code.slice(5);
      }
    }
    return null;
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
      || code === 'Escape' || code === 'Backspace'
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

    if (this.keys.has('KeyW')) {
      cmd.forwardmove += forwardSpeed;
    }
    if (this.keys.has('KeyS')) {
      cmd.forwardmove -= forwardSpeed;
    }
    if (this.keys.has('KeyA')) {
      cmd.sidemove -= sideSpeed;
    }
    if (this.keys.has('KeyD')) {
      cmd.sidemove += sideSpeed;
    }

    cmd.angleturn += this.mouseLook?.consumeTurnDelta() ?? 0;

    const attack = this.keys.has('ControlLeft')
      || this.keys.has('ControlRight')
      || this.keys.has('Space')
      || this.mouseAttack;
    if (attack) {
      cmd.buttons |= BT_ATTACK;
    }

    const use = this.keys.has('KeyE')
      || this.keys.has('Enter')
      || this.mouseUse;
    if (use) {
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
