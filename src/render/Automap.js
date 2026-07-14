import { FRACBITS, FRACUNIT, SCREENHEIGHT, SCREENWIDTH, SBARHEIGHT } from '../core/renderConstants.js';
import { fineAngleIndex } from '../core/angles.js';
import { ML_TWOSIDED } from '../game/mapFormat.js';
import { PLAYER_RADIUS } from '../core/gameConstants.js';
import { pw_allmap } from '../game/PlayerPowers.js';
import { fixedDiv, fixedMul, fixedToInt } from '../math/fixed.js';
import { createTrigTables } from '../math/tables.js';

const trigTables = createTrigTables();

/** am_map.c palette indices (PLAYPAL index = 256 - N for macros below). */
const COLOR_BG = 0; // BLACK
const COLOR_WALL = 0xb0; // REDS = 256 - 5*16
const COLOR_TS_WALL = 0x60; // GRAYS = 6*16
const COLOR_THING = 0x70; // GREENS = 7*16
const COLOR_PLAYER = 0xd1; // WHITE = 256 - 47 — local player arrow

/** am_map.c — (8*PLAYERRADIUS)/7 arrow template in map fixed units, pointing +X. */
const PLAYER_ARROW_R = ((8 * PLAYER_RADIUS) / 7) | 0;

/** @type {{ ax: number, ay: number, bx: number, by: number }[]} */
const PLAYER_ARROW_LINES = [
  { ax: (-PLAYER_ARROW_R + (PLAYER_ARROW_R / 8)) | 0, ay: 0, bx: PLAYER_ARROW_R, by: 0 },
  { ax: PLAYER_ARROW_R, ay: 0, bx: (PLAYER_ARROW_R - (PLAYER_ARROW_R / 2)) | 0, by: (PLAYER_ARROW_R / 4) | 0 },
  { ax: PLAYER_ARROW_R, ay: 0, bx: (PLAYER_ARROW_R - (PLAYER_ARROW_R / 2)) | 0, by: (-PLAYER_ARROW_R / 4) | 0 },
  { ax: (-PLAYER_ARROW_R + (PLAYER_ARROW_R / 8)) | 0, ay: 0, bx: (-PLAYER_ARROW_R - (PLAYER_ARROW_R / 8)) | 0, by: (PLAYER_ARROW_R / 4) | 0 },
  { ax: (-PLAYER_ARROW_R + (PLAYER_ARROW_R / 8)) | 0, ay: 0, bx: (-PLAYER_ARROW_R - (PLAYER_ARROW_R / 8)) | 0, by: (-PLAYER_ARROW_R / 4) | 0 },
  { ax: (-PLAYER_ARROW_R + ((3 * PLAYER_ARROW_R) / 8)) | 0, ay: 0, bx: (-PLAYER_ARROW_R + (PLAYER_ARROW_R / 8)) | 0, by: (PLAYER_ARROW_R / 4) | 0 },
  { ax: (-PLAYER_ARROW_R + ((3 * PLAYER_ARROW_R) / 8)) | 0, ay: 0, bx: (-PLAYER_ARROW_R + (PLAYER_ARROW_R / 8)) | 0, by: (-PLAYER_ARROW_R / 4) | 0 },
];

/**
 * In-game automap (am_map.c — AM_Drawer subset).
 */
export class Automap {
  constructor() {
    /** @type {Set<number>} */
    this.visitedSectors = new Set();
    /** Map-to-screen scale (am_map.c — scale_mtof). */
    this.scale = (FRACUNIT * 0.2) | 0;
    /** @type {string|null} */
    this.scaleKey = null;
  }

  reset() {
    this.visitedSectors.clear();
    this.scaleKey = null;
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

    this.ensureScale(level, mapHeight);

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
    this.drawLineCharacter(
      pixels,
      mapHeight,
      PLAYER_ARROW_LINES,
      angle,
      COLOR_PLAYER,
      px,
      py,
      originX,
      originY,
    );
  }

  /**
   * am_map.c — AM_drawLineCharacter + CYMTOF (rotate in map space, then project).
   * @param {Uint8Array} pixels
   * @param {number} mapHeight
   * @param {{ ax: number, ay: number, bx: number, by: number }[]} lines
   * @param {number} angle
   * @param {number} color
   * @param {number} wx
   * @param {number} wy
   * @param {number} originX
   * @param {number} originY
   */
  drawLineCharacter(pixels, mapHeight, lines, angle, color, wx, wy, originX, originY) {
    for (const line of lines) {
      let ax = line.ax;
      let ay = line.ay;
      let bx = line.bx;
      let by = line.by;

      if (angle) {
        ({ x: ax, y: ay } = Automap.rotateMapOffset(ax, ay, angle));
        ({ x: bx, y: by } = Automap.rotateMapOffset(bx, by, angle));
      }

      const x1 = this.toMapX(wx + ax, originX);
      const y1 = this.toMapY(wy + ay, originY, mapHeight);
      const x2 = this.toMapX(wx + bx, originX);
      const y2 = this.toMapY(wy + by, originY, mapHeight);
      Automap.drawLine(pixels, x1, y1, x2, y2, color, SCREENWIDTH, mapHeight);
    }
  }

  /**
   * am_map.c — AM_rotate (uses original x when updating y).
   * @param {number} x
   * @param {number} y
   * @param {number} angle
   */
  static rotateMapOffset(x, y, angle) {
    const idx = fineAngleIndex(angle >>> 0);
    const cos = trigTables.finecosine[idx];
    const sin = trigTables.finesine[idx];
    const rx = fixedMul(x, cos) - fixedMul(y, sin);
    const ry = fixedMul(x, sin) + fixedMul(y, cos);
    return { x: rx, y: ry };
  }

  /** @param {number} worldX @param {number} originX */
  toMapX(worldX, originX) {
    const offset = fixedToInt(fixedMul(worldX - originX, this.scale));
    return ((SCREENWIDTH >> 1) + offset) | 0;
  }

  /** @param {number} worldY @param {number} originY @param {number} mapHeight */
  toMapY(worldY, originY, mapHeight) {
    const offset = fixedToInt(fixedMul(worldY - originY, this.scale));
    return ((mapHeight >> 1) - offset) | 0;
  }

  /**
   * Fit scale so the whole level fits on screen (am_map.c — AM_findMinMaxBoundaries).
   * @param {import('../game/Level.js').Level} level
   * @param {number} mapHeight
   */
  ensureScale(level, mapHeight) {
    const key = `${level.vertices.length},${mapHeight}`;
    if (this.scaleKey === key) {
      return;
    }
    this.scaleKey = key;

    let minX = level.vertices[0]?.x ?? 0;
    let minY = level.vertices[0]?.y ?? 0;
    let maxX = minX;
    let maxY = minY;

    for (const vertex of level.vertices) {
      if (vertex.x < minX) {
        minX = vertex.x;
      } else if (vertex.x > maxX) {
        maxX = vertex.x;
      }
      if (vertex.y < minY) {
        minY = vertex.y;
      } else if (vertex.y > maxY) {
        maxY = vertex.y;
      }
    }

    const maxW = Math.max(maxX - minX, PLAYER_RADIUS * 4);
    const maxH = Math.max(maxY - minY, PLAYER_RADIUS * 4);
    const scaleW = fixedDiv(SCREENWIDTH << FRACBITS, maxW);
    const scaleH = fixedDiv(mapHeight << FRACBITS, maxH);
    this.scale = scaleW < scaleH ? scaleW : scaleH;
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
