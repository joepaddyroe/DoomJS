import { SCREENWIDTH, SCREENHEIGHT } from '../core/renderConstants.js';
import { createTrigTables } from '../math/tables.js';
import { fineAngleIndex } from '../core/angles.js';
import { ViewSetup } from './ViewSetup.js';
import { ClipSegList, createDrawSeg, createVisPlane, MAX_DRAW_SEGS } from './ClipSegList.js';

/**
 * Shared per-frame rendering state passed through the BSP pipeline.
 */
export class RenderContext {
  /**
   * @param {import('../game/Level.js').Level} level
   * @param {import('./TextureManager.js').TextureManager} textures
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} softwareRenderer
   * @param {Uint8Array} colormaps
   */
  constructor(level, textures, softwareRenderer, colormaps) {
    this.level = level;
    this.textures = textures;
    this.softwareRenderer = softwareRenderer;
    this.colormaps = colormaps;
    this.tables = createTrigTables();

    this.viewWidth = softwareRenderer.viewWidth;
    this.viewHeight = softwareRenderer.viewHeight;
    this.viewSetup = new ViewSetup(this.tables, colormaps, this.viewWidth, this.viewHeight);

    this.clipSegs = new ClipSegList(this.viewWidth);
    this.floorClip = new Int16Array(this.viewWidth);
    this.ceilingClip = new Int16Array(this.viewWidth);

    this.drawSegs = Array.from({ length: MAX_DRAW_SEGS }, createDrawSeg);
    this.drawSegCount = 0;

    this.visPlanes = Array.from({ length: 128 }, createVisPlane);
    this.visPlaneCount = 0;

    this.viewX = 0;
    this.viewY = 0;
    this.viewZ = 0;
    this.viewAngle = 0;
    this.viewSin = 0;
    this.viewCos = 0;
    this.extralight = 0;
  }

  /** @param {{ x: number, y: number, z: number, angle: number }} view */
  setView(view) {
    this.viewX = view.x;
    this.viewY = view.y;
    this.viewZ = view.z;
    this.viewAngle = view.angle >>> 0;
    const idx = fineAngleIndex(this.viewAngle);
    this.viewSin = this.tables.finesine[idx];
    this.viewCos = this.tables.finecosine[idx];
  }

  beginFrame() {
    this.clipSegs.clear();
    this.drawSegCount = 0;
    this.visPlaneCount = 0;

    for (let i = 0; i < this.viewWidth; i++) {
      this.floorClip[i] = this.viewHeight;
      this.ceilingClip[i] = -1;
    }
  }
}
