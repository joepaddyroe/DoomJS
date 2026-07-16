import { MAP_LUMP } from './mapFormat.js';
import { Blockmap } from './Blockmap.js';

/**
 * @typedef {Object} MapVertex
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} MapSector
 * @property {number} floorHeight
 * @property {number} ceilingHeight
 * @property {string} floorPic
 * @property {string} ceilingPic
 * @property {number} lightLevel
 * @property {number} special
 * @property {number} tag
 */

/**
 * @typedef {Object} MapSide
 * @property {number} textureOffset
 * @property {number} rowOffset
 * @property {string} topTexture
 * @property {string} bottomTexture
 * @property {string} midTexture
 * @property {number} sectorIndex
 */

/**
 * @typedef {Object} MapLine
 * @property {number} v1
 * @property {number} v2
 * @property {number} flags
 * @property {number} special
 * @property {number} tag
 * @property {number} sideFront
 * @property {number} sideBack
 */

/**
 * @typedef {Object} MapSeg
 * @property {number} v1
 * @property {number} v2
 * @property {number} angle
 * @property {number} lineIndex
 * @property {number} side
 * @property {number} offset
 */

/**
 * @typedef {Object} MapSubsector
 * @property {number} numSegs
 * @property {number} firstSeg
 */

/**
 * @typedef {Object} MapThing
 * @property {number} x
 * @property {number} y
 * @property {number} angle
 * @property {number} type
 * @property {number} options
 */

/**
 * @typedef {Object} MapNode
 * @property {number} x
 * @property {number} y
 * @property {number} dx
 * @property {number} dy
 * @property {number[][]} bbox
 * @property {number[]} children
 */

/**
 * @typedef {Object} DoomMap
 * @property {string} name
 * @property {MapVertex[]} vertices
 * @property {MapLine[]} lines
 * @property {MapSide[]} sides
 * @property {MapSector[]} sectors
 * @property {MapSeg[]} segs
 * @property {MapSubsector[]} subsectors
 * @property {MapNode[]} nodes
 * @property {MapThing[]} things
 * @property {import('./Blockmap.js').Blockmap} blockmap
 */

/**
 * Loads map geometry from WAD lumps (p_setup.c).
 */
export class MapLoader {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {string} mapName e.g. E1M1 or MAP01
   * @returns {DoomMap}
   */
  static load(wad, mapName) {
    const base = wad.requireIndex(mapName);
    const name = mapName.toUpperCase();

    const blockmapLump = wad.readLump(base + MAP_LUMP.BLOCKMAP);
    const blockmap = Blockmap.fromLump(blockmapLump);

    return {
      name,
      vertices: MapLoader.loadVertexes(wad.readLump(base + MAP_LUMP.VERTEXES)),
      lines: MapLoader.loadLineDefs(wad.readLump(base + MAP_LUMP.LINEDEFS)),
      sides: MapLoader.loadSideDefs(wad.readLump(base + MAP_LUMP.SIDEDEFS)),
      sectors: MapLoader.loadSectors(wad.readLump(base + MAP_LUMP.SECTORS)),
      segs: MapLoader.loadSegs(wad.readLump(base + MAP_LUMP.SEGS)),
      subsectors: MapLoader.loadSubsectors(wad.readLump(base + MAP_LUMP.SSECTORS)),
      nodes: MapLoader.loadNodes(wad.readLump(base + MAP_LUMP.NODES)),
      things: MapLoader.loadThings(wad.readLump(base + MAP_LUMP.THINGS)),
      blockmap,
    };
  }

  /**
   * @param {Uint8Array} data
   * @returns {MapVertex[]}
   */
  static loadVertexes(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 4;
    const vertices = new Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 4;
      vertices[i] = {
        x: view.getInt16(offset, true),
        y: view.getInt16(offset + 2, true),
      };
    }

    return vertices;
  }

  /**
   * @param {Uint8Array} data
   * @returns {MapLine[]}
   */
  static loadLineDefs(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 14;
    const lines = new Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 14;
      lines[i] = {
        v1: view.getInt16(offset, true),
        v2: view.getInt16(offset + 2, true),
        flags: view.getInt16(offset + 4, true),
        special: view.getInt16(offset + 6, true),
        tag: view.getInt16(offset + 8, true),
        sideFront: view.getInt16(offset + 10, true),
        sideBack: view.getInt16(offset + 12, true),
      };
    }

    return lines;
  }

  /**
   * @param {Uint8Array} data
   * @returns {MapSide[]}
   */
  static loadSideDefs(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 30;
    const sides = new Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 30;
      sides[i] = {
        textureOffset: view.getInt16(offset, true),
        rowOffset: view.getInt16(offset + 2, true),
        topTexture: MapLoader.readName(data, offset + 4),
        bottomTexture: MapLoader.readName(data, offset + 12),
        midTexture: MapLoader.readName(data, offset + 20),
        sectorIndex: view.getInt16(offset + 28, true),
      };
    }

    return sides;
  }

  /**
   * @param {Uint8Array} data
   * @returns {MapSector[]}
   */
  static loadSectors(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 26;
    const sectors = new Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 26;
      sectors[i] = {
        floorHeight: view.getInt16(offset, true),
        ceilingHeight: view.getInt16(offset + 2, true),
        floorPic: MapLoader.readName(data, offset + 4),
        ceilingPic: MapLoader.readName(data, offset + 12),
        lightLevel: view.getInt16(offset + 20, true),
        special: view.getInt16(offset + 22, true),
        tag: view.getInt16(offset + 24, true),
      };
    }

    return sectors;
  }

  /**
   * @param {Uint8Array} data
   * @returns {MapSeg[]}
   */
  static loadSegs(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 12;
    const segs = new Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 12;
      segs[i] = {
        v1: view.getInt16(offset, true),
        v2: view.getInt16(offset + 2, true),
        angle: view.getInt16(offset + 4, true),
        lineIndex: view.getInt16(offset + 6, true),
        side: view.getInt16(offset + 8, true),
        offset: view.getInt16(offset + 10, true),
      };
    }

    return segs;
  }

  /**
   * @param {Uint8Array} data
   * @returns {MapSubsector[]}
   */
  static loadSubsectors(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 4;
    const subsectors = new Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 4;
      subsectors[i] = {
        numSegs: view.getInt16(offset, true),
        firstSeg: view.getInt16(offset + 2, true),
      };
    }

    return subsectors;
  }

  /**
   * @param {Uint8Array} data
   * @returns {MapNode[]}
   */
  static loadNodes(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 28;
    const nodes = new Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 28;
      nodes[i] = {
        x: view.getInt16(offset, true),
        y: view.getInt16(offset + 2, true),
        dx: view.getInt16(offset + 4, true),
        dy: view.getInt16(offset + 6, true),
        bbox: [
          [
            view.getInt16(offset + 8, true),
            view.getInt16(offset + 10, true),
            view.getInt16(offset + 12, true),
            view.getInt16(offset + 14, true),
          ],
          [
            view.getInt16(offset + 16, true),
            view.getInt16(offset + 18, true),
            view.getInt16(offset + 20, true),
            view.getInt16(offset + 22, true),
          ],
        ],
        children: [
          view.getUint16(offset + 24, true),
          view.getUint16(offset + 26, true),
        ],
      };
    }

    return nodes;
  }

  /**
   * @param {Uint8Array} data
   * @returns {MapThing[]}
   */
  static loadThings(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const count = data.byteLength / 10;
    const things = new Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 10;
      things[i] = {
        x: view.getInt16(offset, true),
        y: view.getInt16(offset + 2, true),
        angle: view.getInt16(offset + 4, true),
        type: view.getInt16(offset + 6, true),
        options: view.getInt16(offset + 8, true),
      };
    }

    return things;
  }

  /**
   * @param {Uint8Array} data
   * @param {number} offset
   * @returns {string}
   */
  static readName(data, offset) {
    let name = '';
    for (let i = 0; i < 8; i++) {
      const c = data[offset + i];
      if (c === 0) {
        break;
      }
      name += String.fromCharCode(c);
    }
    return name;
  }

  /**
   * @param {DoomMap} map
   * @returns {MapThing|null}
   */
  static findPlayerStart(map) {
    return map.things.find((thing) => thing.type >= 1 && thing.type <= 4) ?? null;
  }

  /**
   * Coop player starts indexed by player 0–3 (thing types 1–4).
   * Missing slots fall back to player 1's start (caller may offset).
   * @param {DoomMap} map
   * @returns {(MapThing|null)[]}
   */
  static findPlayerStarts(map) {
    /** @type {(MapThing|null)[]} */
    const starts = [null, null, null, null];
    for (const thing of map.things) {
      if (thing.type >= 1 && thing.type <= 4) {
        starts[thing.type - 1] = thing;
      }
    }
    return starts;
  }
}
