import { RenderContext } from './RenderContext.js';
import { BspTraverser } from './BspTraverser.js';
import { WallDrawer } from './WallDrawer.js';
import { PlaneDrawer } from './PlaneDrawer.js';

/**
 * Orchestrates the BSP rendering pipeline (r_main.c — R_RenderPlayerView).
 */
export class BspRenderer {
  /**
   * @param {import('../game/Level.js').Level} level
   * @param {import('./TextureManager.js').TextureManager} textures
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} softwareRenderer
   * @param {Uint8Array} colormaps
   */
  constructor(level, textures, softwareRenderer, colormaps) {
    this.ctx = new RenderContext(level, textures, softwareRenderer, colormaps);
    this.planes = new PlaneDrawer(this.ctx);
    this.bsp = new BspTraverser(this.ctx, null, this.planes);
    this.walls = new WallDrawer(this.ctx, this.planes, this.bsp);
    this.bsp.walls = this.walls;
  }

  /**
   * @param {{ x: number, y: number, z: number, angle: number, extralight?: number }} view
   */
  renderView(view) {
    this.ctx.softwareRenderer.clear(0);
    this.ctx.setView(view);
    this.ctx.extralight = view.extralight ?? 0;
    this.ctx.beginFrame();
    this.planes.clearPlanes();

    const root = this.ctx.level.nodes.length > 0
      ? this.ctx.level.nodes.length - 1
      : -1;
    this.bsp.renderNode(root);
    this.planes.drawPlanes();
  }
}
