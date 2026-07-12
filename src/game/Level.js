import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { ML_TWOSIDED } from './mapFormat.js';
import { pointOnSide } from '../math/viewMath.js';
import { calcLineBounds } from '../math/mapGeometry.js';
import { Blockmap } from './Blockmap.js';

/**
 * Runtime level geometry for rendering (p_setup.c structures).
 */
export class Level {
  /**
   * @param {import('./MapLoader.js').DoomMap} map
   * @param {import('../render/TextureManager.js').TextureManager} textures
   * @param {Blockmap} blockmap
   */
  static fromMap(map, textures, blockmap) {
    const level = new Level();
    const scale = FRACUNIT;
    level.blockmap = blockmap;
    level.skyFlatNum = textures.skyFlatNum;

    level.vertices = map.vertices.map((vertex) => ({
      x: vertex.x * scale,
      y: vertex.y * scale,
    }));

    level.sectors = map.sectors.map((sector) => ({
      floorHeight: sector.floorHeight * scale,
      ceilingHeight: sector.ceilingHeight * scale,
      floorPic: textures.flatIndexForName(sector.floorPic),
      ceilingPic: textures.flatIndexForName(sector.ceilingPic),
      lightLevel: sector.lightLevel,
    }));

    level.sides = map.sides.map((side) => ({
      textureOffset: side.textureOffset * scale,
      rowOffset: side.rowOffset * scale,
      topTexture: textures.textureIndexForName(side.topTexture),
      bottomTexture: textures.textureIndexForName(side.bottomTexture),
      midTexture: textures.textureIndexForName(side.midTexture),
      sector: level.sectors[side.sectorIndex],
    }));

    level.lines = map.lines.map((line) => {
      const v1 = level.vertices[line.v1];
      const v2 = level.vertices[line.v2];
      const entry = {
        v1,
        v2,
        dx: v2.x - v1.x,
        dy: v2.y - v1.y,
        flags: line.flags,
        special: line.special,
        tag: line.tag,
        sideFront: line.sideFront >= 0 ? level.sides[line.sideFront] : null,
        sideBack: line.sideBack >= 0 ? level.sides[line.sideBack] : null,
        frontSector: null,
        backSector: null,
      };

      entry.frontSector = entry.sideFront?.sector ?? null;
      entry.backSector = entry.sideBack?.sector ?? null;
      calcLineBounds(entry);
      return entry;
    });

    level.segs = map.segs.map((seg) => {
      const line = level.lines[seg.lineIndex];
      const sidedef = seg.side === 0 ? line.sideFront : line.sideBack;
      const opposite = seg.side === 0 ? line.sideBack : line.sideFront;
      return {
        v1: level.vertices[seg.v1],
        v2: level.vertices[seg.v2],
        angle: (seg.angle << 16) >>> 0,
        offset: seg.offset * scale,
        linedef: line,
        sidedef,
        frontsector: sidedef?.sector ?? null,
        backsector: (line.flags & ML_TWOSIDED) ? opposite?.sector ?? null : null,
      };
    });

    level.subsectors = map.subsectors.map((sub) => ({
      numlines: sub.numSegs,
      firstline: sub.firstSeg,
      sector: level.segs[sub.firstSeg].frontsector,
    }));

    level.nodes = map.nodes.map((node) => ({
      x: node.x * scale,
      y: node.y * scale,
      dx: node.dx * scale,
      dy: node.dy * scale,
      bbox: [
        [
          node.bbox[0][0] * scale,
          node.bbox[0][1] * scale,
          node.bbox[0][2] * scale,
          node.bbox[0][3] * scale,
        ],
        [
          node.bbox[1][0] * scale,
          node.bbox[1][1] * scale,
          node.bbox[1][2] * scale,
          node.bbox[1][3] * scale,
        ],
      ],
      children: node.children,
    }));

    level.things = map.things;
    return level;
  }

  /** @param {import('./MapLoader.js').MapThing|null} thing */
  viewFromThing(thing) {
    if (!thing) {
      return { x: 0, y: 0, z: 41 * FRACUNIT, angle: 0 };
    }

    const subsector = this.findSubsector(thing.x * FRACUNIT, thing.y * FRACUNIT);
    const floor = subsector?.sector?.floorHeight ?? 0;

    return {
      x: thing.x * FRACUNIT,
      y: thing.y * FRACUNIT,
      z: floor + 41 * FRACUNIT,
      angle: (Math.imul(0x20000000, (thing.angle / 45) | 0)) >>> 0,
    };
  }

  /**
   * @param {number} x Fixed
   * @param {number} y Fixed
   */
  findSubsector(x, y) {
    if (this.nodes.length === 0) {
      return this.subsectors[0];
    }

    let nodenum = this.nodes.length - 1;
    while ((nodenum & 0x8000) === 0) {
      const node = this.nodes[nodenum];
      nodenum = node.children[pointOnSide(x, y, node)];
    }

    return this.subsectors[nodenum & ~0x8000];
  }
}
