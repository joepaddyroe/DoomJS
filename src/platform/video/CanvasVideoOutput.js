import { SCREENWIDTH, SCREENHEIGHT } from '../../core/renderConstants.js';

/** Default integer upscale for the 320×200 software buffer (nearest-neighbor). */
export const DEFAULT_PIXEL_SCALE = 2;

/**
 * Presents the indexed software framebuffer at native 320×200 resolution
 * with optional integer pixel scaling — no bilinear stretch.
 *
 * Doom's software renderer always draws at SCREENWIDTH × SCREENHEIGHT (320×200).
 * We blit 1:1 to an offscreen buffer, then scale by an integer factor with
 * imageSmoothingEnabled disabled so each game pixel is a crisp square block.
 */
export class CanvasVideoOutput {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} [gameWidth=SCREENWIDTH]
   * @param {number} [gameHeight=SCREENHEIGHT]
   * @param {number} [pixelScale=DEFAULT_PIXEL_SCALE]
   */
  constructor(canvas, gameWidth = SCREENWIDTH, gameHeight = SCREENHEIGHT, pixelScale = DEFAULT_PIXEL_SCALE) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
    this.pixelScale = Math.max(1, pixelScale | 0);

    this.imageData = new ImageData(gameWidth, gameHeight);
    this.rgbBuffer = this.imageData.data;

    /** @type {Uint8ClampedArray|null} */
    this.paletteRgb = null;

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = gameWidth;
    this.offscreen.height = gameHeight;
    this.offscreenCtx = this.offscreen.getContext('2d', { alpha: false });
    this.offscreenCtx.imageSmoothingEnabled = false;

    this.ctx.imageSmoothingEnabled = false;

    this.applyCanvasSize();
  }

  /**
   * @param {number} scale Integer pixel scale (1 = 320×200, 2 = 640×400, …).
   */
  setPixelScale(scale) {
    this.pixelScale = Math.max(1, scale | 0);
    this.applyCanvasSize();
  }

  applyCanvasSize() {
    const w = this.gameWidth * this.pixelScale;
    const h = this.gameHeight * this.pixelScale;

    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  /**
   * @param {Uint8ClampedArray|Uint8Array} rgb Flat RGB buffer, 768 bytes (256 × 3).
   */
  setPalette(rgb) {
    this.paletteRgb = rgb instanceof Uint8ClampedArray ? rgb : new Uint8ClampedArray(rgb);
  }

  /**
   * Neutral gray-brown ramp for renderer testing until PLAYPAL is loaded.
   * @returns {Uint8ClampedArray}
   */
  static createDemoPalette() {
    const palette = new Uint8ClampedArray(256 * 3);

    for (let i = 0; i < 256; i++) {
      const base = i * 3;
      if (i === 0) {
        palette[base] = 0;
        palette[base + 1] = 0;
        palette[base + 2] = 0;
        continue;
      }

      const shade = i / 255;
      palette[base] = Math.min(255, Math.floor(24 + shade * 200));
      palette[base + 1] = Math.min(255, Math.floor(24 + shade * 180));
      palette[base + 2] = Math.min(255, Math.floor(20 + shade * 140));
    }

    return palette;
  }

  /**
   * Convert indexed pixels to RGB and blit with integer nearest-neighbor scale.
   * @param {Uint8Array} indexedPixels gameWidth × gameHeight palette indices
   */
  present(indexedPixels) {
    if (!this.paletteRgb) {
      this.setPalette(CanvasVideoOutput.createDemoPalette());
    }

    const rgb = this.rgbBuffer;
    const palette = this.paletteRgb;

    for (let i = 0, px = 0; i < indexedPixels.length; i++, px += 4) {
      const color = indexedPixels[i] * 3;
      rgb[px] = palette[color];
      rgb[px + 1] = palette[color + 1];
      rgb[px + 2] = palette[color + 2];
      rgb[px + 3] = 255;
    }

    this.offscreenCtx.putImageData(this.imageData, 0, 0);

    const destW = this.gameWidth * this.pixelScale;
    const destH = this.gameHeight * this.pixelScale;

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, destW, destH);
    this.ctx.drawImage(this.offscreen, 0, 0, destW, destH);
  }
}
