import { FLAT_MASK, SCREENHEIGHT, SCREENWIDTH, SBARHEIGHT } from '../core/renderConstants.js';
import { ViewBuffer } from './ViewBuffer.js';
import { PatchRenderer } from './PatchRenderer.js';

/** Area above the status bar (matches vanilla screens[1] usage). */
const MAP_HEIGHT = SCREENHEIGHT - SBARHEIGHT;

/**
 * Tiled flat + BRDR_* bevel around the 3D window (r_draw.c — R_FillBackScreen / R_DrawViewBorder).
 */
export class ViewBorder {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {import('./TextureManager.js').TextureManager} textures
   */
  constructor(wad, textures) {
    this.wad = wad;
    this.textures = textures;
    this.borderBuffer = new ViewBuffer(SCREENWIDTH, MAP_HEIGHT);
    this.borderPatches = new PatchRenderer(this.borderBuffer);
    /** @type {string|null} */
    this.layoutKey = null;
  }

  /**
   * @param {{ scaledViewWidth: number, viewHeight: number }} layout
   */
  ensure(layout) {
    const key = `${layout.scaledViewWidth},${layout.viewHeight}`;
    if (this.layoutKey === key) {
      return;
    }
    this.fillBackScreen(layout);
    this.layoutKey = key;
  }

  /**
   * @param {{ scaledViewWidth: number, viewHeight: number }} layout
   */
  fillBackScreen(layout) {
    const { scaledViewWidth, viewHeight } = layout;
    const pixels = this.borderBuffer.pixels;

    let flat = null;
    try {
      flat = this.textures.getFlat(this.textures.flatIndexForName('FLOOR7_2'));
    } catch {
      try {
        flat = this.textures.getFlat(this.textures.flatIndexForName('GRNROCK'));
      } catch {
        // Non-standard WAD without border flats.
      }
    }

    if (flat) {
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const flatRow = (y & FLAT_MASK) << 6;
        const destRow = y * SCREENWIDTH;
        for (let x = 0; x < SCREENWIDTH; x++) {
          pixels[destRow + x] = flat[flatRow + (x & FLAT_MASK)];
        }
      }
    } else {
      pixels.fill(0x25);
    }

    const viewWindowX = (SCREENWIDTH - scaledViewWidth) >> 1;
    const viewWindowY = (MAP_HEIGHT - viewHeight) >> 1;

    const drawPatchByName = (name, x, y) => {
      try {
        const data = this.wad.readLumpByName(name);
        const parsed = PatchRenderer.parsePatch(data);
        this.borderPatches.drawPatch(x, y, parsed.header, parsed.data);
      } catch {
        // Missing border lumps in non-standard WADs.
      }
    };

    for (let x = 0; x < scaledViewWidth; x += 8) {
      drawPatchByName('brdr_t', viewWindowX + x, viewWindowY - 8);
      drawPatchByName('brdr_b', viewWindowX + x, viewWindowY + viewHeight);
    }
    for (let y = 0; y < viewHeight; y += 8) {
      drawPatchByName('brdr_l', viewWindowX - 8, viewWindowY + y);
      drawPatchByName('brdr_r', viewWindowX + scaledViewWidth, viewWindowY + y);
    }

    drawPatchByName('brdr_tl', viewWindowX - 8, viewWindowY - 8);
    drawPatchByName('brdr_tr', viewWindowX + scaledViewWidth, viewWindowY - 8);
    drawPatchByName('brdr_bl', viewWindowX - 8, viewWindowY + viewHeight);
    drawPatchByName('brdr_br', viewWindowX + scaledViewWidth, viewWindowY + viewHeight);
  }

  /**
   * Copy prebuilt border regions into the play screen (R_DrawViewBorder).
   * @param {Uint8Array} pixels
   * @param {{ scaledViewWidth: number, viewHeight: number }} layout
   */
  draw(pixels, layout) {
    if (layout.scaledViewWidth >= SCREENWIDTH) {
      return;
    }

    this.ensure(layout);

    const { scaledViewWidth, viewHeight } = layout;
    const top = (MAP_HEIGHT - viewHeight) >> 1;
    const side = (SCREENWIDTH - scaledViewWidth) >> 1;
    const bottom = top + viewHeight;
    const border = this.borderBuffer.pixels;

    for (let y = 0; y < top; y++) {
      pixels.set(border.subarray(y * SCREENWIDTH, (y + 1) * SCREENWIDTH), y * SCREENWIDTH);
    }

    if (bottom < MAP_HEIGHT) {
      for (let y = bottom; y < MAP_HEIGHT; y++) {
        pixels.set(border.subarray(y * SCREENWIDTH, (y + 1) * SCREENWIDTH), y * SCREENWIDTH);
      }
    }

    for (let y = top; y < bottom; y++) {
      const row = y * SCREENWIDTH;
      for (let x = 0; x < side; x++) {
        pixels[row + x] = border[row + x];
      }
      for (let x = side + scaledViewWidth; x < SCREENWIDTH; x++) {
        pixels[row + x] = border[row + x];
      }
    }
  }
}
