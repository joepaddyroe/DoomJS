/** Default menu mouse sensitivity (m_menu.c). */
export const DEFAULT_MOUSE_SENSITIVITY = 5;

/** Prior fixed sensitivity was 4; default menu setting is 4× stronger. */
const MOUSE_SENSITIVITY_BASE = 16;

/**
 * Map options menu mouse sensitivity (0–9) to angleturn units per pixel.
 * @param {number} menuValue
 * @returns {number}
 */
export function sensitivityFromMenuSetting(menuValue) {
  const clamped = Math.max(0, Math.min(9, menuValue));
  return ((clamped + 1) / (DEFAULT_MOUSE_SENSITIVITY + 1)) * MOUSE_SENSITIVITY_BASE;
}

/**
 * Mouse capture/lock and look (title screen + in-level).
 */
export class MouseLook {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => boolean} canCapture When true, click captures/locks the pointer.
   * @param {() => boolean} canLook When true, mouse movement turns the view.
   * @param {() => number} [getSensitivity] angleturn units per pixel
   */
  constructor(canvas, canCapture, canLook, getSensitivity = () => sensitivityFromMenuSetting(DEFAULT_MOUSE_SENSITIVITY)) {
    this.canvas = canvas;
    this.canCapture = canCapture;
    this.canLook = canLook;
    this.getSensitivity = getSensitivity;
    this.pendingDeltaX = 0;
    this.locked = false;
    this.capturePointerId = null;
    this.lastClientX = null;

    this._onMouseMove = (event) => {
      if (!this.canLook()) {
        return;
      }

      if (this.locked) {
        if (event.movementX !== 0) {
          this.pendingDeltaX += event.movementX;
        }
        return;
      }

      if (this.capturePointerId !== null && this.lastClientX !== null) {
        const delta = event.clientX - this.lastClientX;
        if (delta !== 0) {
          this.pendingDeltaX += delta;
        }
        this.lastClientX = event.clientX;
      }
    };

    this._onPointerLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) {
        this._endCapture();
      }
      this._syncCursorClass();
      if (!this.locked) {
        this.pendingDeltaX = 0;
      }
    };

    this._onLostPointerCapture = () => {
      if (!this.locked) {
        this.capturePointerId = null;
        this.lastClientX = null;
        this._syncCursorClass();
      }
    };

    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('lostpointercapture', this._onLostPointerCapture);
  }

  /** Called from KeyboardInput on canvas mousedown. */
  handlePress(event) {
    if (!this.canCapture()) {
      return;
    }

    this.canvas.focus();
    this._beginCapture(event);
    this.requestLock();
  }

  /** @param {MouseEvent|PointerEvent} event */
  _beginCapture(event) {
    if (this.locked || this.capturePointerId !== null) {
      return;
    }

    const pointerId = event.pointerId ?? 1;
    try {
      this.canvas.setPointerCapture(pointerId);
      this.capturePointerId = pointerId;
      this.lastClientX = event.clientX;
      this._syncCursorClass();
    } catch {
      this.capturePointerId = -1;
      this.lastClientX = event.clientX;
      this._syncCursorClass();
    }
  }

  _endCapture() {
    if (this.capturePointerId === null) {
      return;
    }

    if (this.capturePointerId !== -1) {
      try {
        if (this.canvas.hasPointerCapture(this.capturePointerId)) {
          this.canvas.releasePointerCapture(this.capturePointerId);
        }
      } catch {
        // Already released.
      }
    }

    this.capturePointerId = null;
    this.lastClientX = null;
    this._syncCursorClass();
  }

  _syncCursorClass() {
    const captured = this.locked || this.capturePointerId !== null;
    this.canvas.classList.toggle('mouse-captured', captured);
  }

  leaveCapture() {
    this._endCapture();
    this.release();
  }

  requestLock() {
    if (this.locked || document.pointerLockElement === this.canvas) {
      return;
    }

    this.canvas.requestPointerLock().catch(() => {
      // Pointer lock blocked — capture fallback still works.
    });
  }

  release() {
    this.pendingDeltaX = 0;
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  /**
   * @returns {number}
   */
  consumeTurnDelta() {
    if (!this.canLook() || this.pendingDeltaX === 0) {
      return 0;
    }

    const delta = this.pendingDeltaX;
    this.pendingDeltaX = 0;
    return -Math.round(delta * this.getSensitivity());
  }
}
