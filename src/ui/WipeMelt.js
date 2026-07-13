import { SCREENHEIGHT, SCREENWIDTH } from '../core/renderConstants.js';

/**
 * Weird screen melt wipe (f_wipe.c — wipe_Melt), adapted for DoomJS's single
 * indexed framebuffer. Uses column-wise y positions and blends from start→end.
 */
export class WipeMelt {
  /**
   * @param {Uint8Array} startPixels SCREENWIDTH×SCREENHEIGHT snapshot
   * @param {Uint8Array} endPixels SCREENWIDTH×SCREENHEIGHT snapshot
   * @param {number} [width=SCREENWIDTH]
   * @param {number} [height=SCREENHEIGHT]
   */
  constructor(startPixels, endPixels, width = SCREENWIDTH, height = SCREENHEIGHT) {
    this.width = width;
    this.height = height;
    this.start = startPixels;
    this.end = endPixels;
    this.work = new Uint8Array(startPixels); // current mixed frame

    /** @type {Int16Array} */
    this.y = new Int16Array(width);
    this.done = false;

    // init like f_wipe.c: y[0] = -(rand%16), neighbors differ by -1..1 and clamp.
    this.y[0] = -((Math.random() * 16) | 0);
    for (let i = 1; i < width; i++) {
      const r = ((Math.random() * 3) | 0) - 1;
      let v = this.y[i - 1] + r;
      if (v > 0) v = 0;
      if (v === -16) v = -15;
      this.y[i] = v;
    }
  }

  /**
   * Advance the wipe by a number of 35Hz ticks.
   * @param {number} [ticks=1]
   */
  tick(ticks = 1) {
    if (this.done) {
      return;
    }
    for (let t = 0; t < ticks; t++) {
      let allDone = true;
      for (let x = 0; x < this.width; x++) {
        let y = this.y[x];
        if (y < 0) {
          this.y[x] = y + 1;
          allDone = false;
          continue;
        }
        if (y >= this.height) {
          continue;
        }

        // dy: faster after first 16 rows, like f_wipe.c.
        let dy = y < 16 ? y + 1 : 8;
        if (y + dy > this.height) {
          dy = this.height - y;
        }

        // Copy dy rows from end into work at current melt front.
        for (let row = 0; row < dy; row++) {
          const yy = y + row;
          this.work[yy * this.width + x] = this.end[yy * this.width + x];
        }

        y += dy;
        this.y[x] = y;

        // Below the melt front, show the start screen (until it melts down).
        for (let yy = y; yy < this.height; yy++) {
          this.work[yy * this.width + x] = this.start[yy * this.width + x];
        }

        allDone = false;
      }
      this.done = allDone;
      if (this.done) {
        this.work.set(this.end);
        return;
      }
    }
  }

  /**
   * Draw the current wipe frame into the destination framebuffer.
   * @param {Uint8Array} destPixels
   */
  draw(destPixels) {
    destPixels.set(this.work);
  }
}

