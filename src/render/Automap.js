import { FRACBITS, FRACUNIT, SCREENHEIGHT, SCREENWIDTH, SBARHEIGHT } from '../core/renderConstants.js';
import { fineAngleIndex } from '../core/angles.js';
import { ML_TWOSIDED } from '../game/mapFormat.js';
import { PLAYER_RADIUS } from '../core/gameConstants.js';
import { pw_allmap } from '../game/PlayerPowers.js';
import { createTrigTables } from '../math/tables.js';

const trigTables = createTrigTables();

/** am_map.c palette indices */
const COLOR_BG = 0;
const COLOR_WALL = 0xb0;
const COLOR_TS_WALL = 0x60;
const COLOR_THING = 0x70;
const COLOR_PLAYER = 0xcf;

/**
 * In-game automap (am_map.c — AM_Drawer subset).
 */
export class Automap {
  constructor() {
    /** @type {Set<number>} */
    this.visitedSectors = new Set();
    this.scale = (FRACUNIT * 0.2) | 0;
  }

  reset() {
    this.visitedSectors.clear();
  }

  /** @param {import('../game/Player.js').Player} player */
  seedPlayer(player) {
    this.notePlayerSector(player);
  }

  /** @param {import('../game/Player.js').Player} player */
  notePlayerSector(player) {
    const index = player.mo.subsector?.sector?.index;
    if (typeof index === 'number') {
      this.visitedSectors.add(index);
    }
  }

  /**
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {import('../game/Level.js').Level} level
   * @param {import('../game/Player.js').Player} player
   * @param {import('../game/MapThingSpawner.js').MapThingMobj[]} things
   * @param {number} [mapHeight=SCREENHEIGHT - SBARHEIGHT]
   */
  draw(renderer, level, player, things, mapHeight = SCREENHEIGHT - SBARHEIGHT) {
    const pixels = renderer.pixels;
    pixels.fill(COLOR_BG, 0, SCREENWIDTH * mapHeight);

    const hasAllMap = player.powers[pw_allmap] > 0;
    const mo = player.mo;
    const originX = mo.x;
    const originY = mo.y;

    for (const line of level.lines) {
      if (!line.sideFront) {
        continue;
      }

      const frontIndex = line.frontSector?.index;
      const backIndex = line.backSector?.index;
      const visible = hasAllMap
        || (typeof frontIndex === 'number' && this.visitedSectors.has(frontIndex))
        || (typeof backIndex === 'number' && this.visitedSectors.has(backIndex));

      if (!visible) {
        continue;
      }

      const color = (line.flags & ML_TWOSIDED) && line.backSector
        ? COLOR_TS_WALL
        : COLOR_WALL;

      const x1 = this.toMapX(line.v1.x, originX);
      const y1 = this.toMapY(line.v1.y, originY, mapHeight);
      const x2 = this.toMapX(line.v2.x, originX);
      const y2 = this.toMapY(line.v2.y, originY, mapHeight);
      Automap.drawLine(pixels, x1, y1, x2, y2, color, SCREENWIDTH, mapHeight);
    }

    if (hasAllMap) {
      for (const thing of things) {
        if (thing.removed || thing === mo) {
          continue;
        }
        const tx = this.toMapX(thing.x, originX);
        const ty = this.toMapY(thing.y, originY, mapHeight);
        Automap.fillSquare(pixels, tx - 1, ty - 1, 3, COLOR_THING, SCREENWIDTH, mapHeight);
      }
    }

    this.drawPlayerArrow(pixels, mapHeight, mo.x, mo.y, mo.angle, originX, originY);
  }

  /** @param {Uint8Array} pixels @param {number} mapHeight @param {number} px @param {number} py @param {number} angle */
  drawPlayerArrow(pixels, mapHeight, px, py, angle, originX, originY) {
    const cx = this.toMapX(px, originX);
    const cy = this.toMapY(py, originY, mapHeight);
    const r = (PLAYER_RADIUS * this.scale) >> FRACBITS;
    const idx = fineAngleIndex(angle >>> 0);
    const cos = trigTables.finecosine[idx] / FRACUNIT;
    const sin = trigTables.finesine[idx] / FRACUNIT;

    const tipX = cx + (cos * r * 2) | 0;
    const tipY = cy - (sin * r * 2) | 0;
    const leftX = cx + (cos * -r + sin * r * 0.6) | 0;
    const leftY = cy - (sin * -r + cos * r * 0.6) | 0;
    const rightX = cx + (cos * -r - sin * r * 0.6) | 0;
    const rightY = cy - (sin * -r - cos * r * 0.6) | 0;

    Automap.drawLine(pixels, cx, cy, tipX, tipY, COLOR_PLAYER, SCREENWIDTH, mapHeight);
    Automap.drawLine(pixels, tipX, tipY, leftX, leftY, COLOR_PLAYER, SCREENWIDTH, mapHeight);
    Automap.drawLine(pixels, tipX, tipY, rightX, rightY, COLOR_PLAYER, SCREENWIDTH, mapHeight);
  }

  /** @param {number} worldX @param {number} originX */
  toMapX(worldX, originX) {
    return ((SCREENWIDTH >> 1) + (((worldX - originX) * this.scale) >> FRACBITS)) | 0;
  }

  /** @param {number} worldY @param {number} originY @param {number} mapHeight */
  toMapY(worldY, originY, mapHeight) {
    return ((mapHeight >> 1) - (((worldY - originY) * this.scale) >> FRACBITS)) | 0;
  }

  /**
   * @param {Uint8Array} pixels
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @param {number} color
   * @param {number} width
   * @param {number} height
   */
  static drawLine(pixels, x0, y0, x1, y1, color, width, height) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      Automap.plot(pixels, x0, y0, color, width, height);
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

  /** @param {Uint8Array} pixels @param {number} x @param {number} y @param {number} size */
  static fillSquare(pixels, x, y, size, color, width, height) {
    for (let row = y; row < y + size; row++) {
      for (let col = x; col < x + size; col++) {
        Automap.plot(pixels, col, row, color, width, height);
      }
    }
  }

  static plot(pixels, x, y, color, width, height) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      pixels[y * width + x] = color;
    }
  }
}
