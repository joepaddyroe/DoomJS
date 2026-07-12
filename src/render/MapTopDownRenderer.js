import { SCREENWIDTH, SCREENHEIGHT } from '../core/renderConstants.js';

/**
 * Top-down automap-style view using real sector flats and PLAYPAL from the WAD.
 */
export class MapTopDownRenderer {
  /**
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {import('../wad/GameAssets.js').GameAssets} assets
   */
  constructor(renderer, assets) {
    this.renderer = renderer;
    this.assets = assets;
  }

  /**
   * @param {import('./MapLoader.js').DoomMap} map
   */
  render(map) {
    const pixels = this.renderer.pixels;
    pixels.fill(0x1d);

    const bounds = MapTopDownRenderer.computeBounds(map.vertices);
    const transform = MapTopDownRenderer.createTransform(bounds, 8);

    for (const line of map.lines) {
      if (line.sideFront < 0) {
        continue;
      }

      const sector = map.sectors[map.sides[line.sideFront].sectorIndex];
      const flat = this.assets.getFlat(this.assets.flatIndexForName(sector.floorPic));
      const colormap = this.assets.colormapForLight(sector.lightLevel);
      const color = colormap[flat[32 * 64 + 32] ?? 0];

      const v1 = map.vertices[line.v1];
      const v2 = map.vertices[line.v2];
      const p1 = transform.toScreen(v1.x, v1.y);
      const p2 = transform.toScreen(v2.x, v2.y);
      MapTopDownRenderer.drawLine(pixels, p1.x, p1.y, p2.x, p2.y, color);
    }

    const player = map.things.find((thing) => thing.type >= 1 && thing.type <= 4);
    if (player) {
      const p = transform.toScreen(player.x, player.y);
      MapTopDownRenderer.fillRect(pixels, p.x - 2, p.y - 2, 5, 5, 0x52);
    }
  }

  /**
   * @param {import('./MapLoader.js').MapVertex[]} vertices
   */
  static computeBounds(vertices) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const vertex of vertices) {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
   * @param {number} padding
   */
  static createTransform(bounds, padding) {
    const width = SCREENWIDTH - padding * 2;
    const height = SCREENHEIGHT - padding * 2;
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(width / spanX, height / spanY);

    return {
      toScreen(x, y) {
        return {
          x: Math.round(padding + (x - bounds.minX) * scale),
          y: Math.round(SCREENHEIGHT - padding - (y - bounds.minY) * scale),
        };
      },
    };
  }

  /**
   * @param {Uint8Array} pixels
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {number} color
   */
  static drawLine(pixels, x0, y0, x1, y1, color) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      MapTopDownRenderer.plot(pixels, x0, y0, color);
      MapTopDownRenderer.plot(pixels, x0 + 1, y0, color);
      MapTopDownRenderer.plot(pixels, x0, y0 + 1, color);

      if (x0 === x1 && y0 === y1) {
        break;
      }

      const e2 = err * 2;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /**
   * @param {Uint8Array} pixels
   * @param {number} x
   * @param {number} y
   * @param {number} color
   */
  static plot(pixels, x, y, color) {
    if (x >= 0 && x < SCREENWIDTH && y >= 0 && y < SCREENHEIGHT) {
      pixels[y * SCREENWIDTH + x] = color;
    }
  }

  /**
   * @param {Uint8Array} pixels
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} color
   */
  static fillRect(pixels, x, y, w, h, color) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        MapTopDownRenderer.plot(pixels, col, row, color);
      }
    }
  }
}
