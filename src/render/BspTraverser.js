import {
  ANG90,
  ANG180,
  ANGLETOFINESHIFT,
  BOXLEFT,
  BOXRIGHT,
  BOXTOP,
  BOXBOTTOM,
  NF_SUBSECTOR,
} from '../core/angles.js';
import { pointOnSide, pointToAngle } from '../math/viewMath.js';

const CHECK_COORD = [
  [3, 0, 2, 1],
  [3, 0, 2, 0],
  [3, 1, 2, 0],
  null,
  [2, 0, 2, 1],
  null,
  [3, 1, 3, 0],
  null,
  [2, 0, 3, 1],
  [2, 1, 3, 1],
  [2, 1, 3, 0],
];

/**
 * BSP tree traversal and wall segment submission (r_bsp.c).
 */
export class BspTraverser {
  /**
   * @param {import('./RenderContext.js').RenderContext} ctx
   * @param {import('./WallDrawer.js').WallDrawer} walls
   * @param {import('./PlaneDrawer.js').PlaneDrawer} planes
   */
  constructor(ctx, walls, planes) {
    this.ctx = ctx;
    this.walls = walls;
    this.planes = planes;
    this.curline = null;
    this.rwAngle1 = 0;
  }

  /** @param {number} bspNum */
  renderNode(bspNum) {
    if (bspNum & NF_SUBSECTOR) {
      this.renderSubsector(bspNum === -1 ? 0 : bspNum & ~NF_SUBSECTOR);
      return;
    }

    const node = this.ctx.level.nodes[bspNum];
    const side = pointOnSide(this.ctx.viewX, this.ctx.viewY, node);
    this.renderNode(node.children[side]);

    if (this.checkBBox(node.bbox[side ^ 1])) {
      this.renderNode(node.children[side ^ 1]);
    }
  }

  /** @param {number} num */
  renderSubsector(num) {
    const sub = this.ctx.level.subsectors[num];
    const frontsector = sub.sector;
    const firstSegIndex = sub.firstline;

    if (frontsector.floorHeight < this.ctx.viewZ) {
      this.planes.findFloorPlane(frontsector);
    } else {
      this.planes.floorPlane = null;
    }

    if (frontsector.ceilingHeight > this.ctx.viewZ
      || frontsector.ceilingPic === this.ctx.textures.skyFlatNum) {
      this.planes.findCeilingPlane(frontsector);
    } else {
      this.planes.ceilingPlane = null;
    }

    for (let i = 0; i < sub.numlines; i++) {
      this.addLine(this.ctx.level.segs[firstSegIndex + i]);
    }
  }

  /** @param {object} line Seg */
  addLine(line) {
    this.curline = line;
    const frontsector = line.frontsector;
    const backsector = line.backsector;

    let angle1 = pointToAngle(
      line.v1.x, line.v1.y,
      this.ctx.viewX, this.ctx.viewY,
      this.ctx.tables.tantoangle,
    );
    let angle2 = pointToAngle(
      line.v2.x, line.v2.y,
      this.ctx.viewX, this.ctx.viewY,
      this.ctx.tables.tantoangle,
    );

    let span = (angle1 - angle2) >>> 0;
    if (span >= ANG180) {
      return;
    }

    this.rwAngle1 = angle1;
    angle1 = (angle1 - this.ctx.viewAngle) >>> 0;
    angle2 = (angle2 - this.ctx.viewAngle) >>> 0;

    let tspan = (angle1 + this.ctx.viewSetup.clipAngle) >>> 0;
    if (tspan > 2 * this.ctx.viewSetup.clipAngle) {
      tspan = (tspan - 2 * this.ctx.viewSetup.clipAngle) >>> 0;
      if (tspan >= span) {
        return;
      }
      angle1 = this.ctx.viewSetup.clipAngle;
    }

    tspan = (this.ctx.viewSetup.clipAngle - angle2) >>> 0;
    if (tspan > 2 * this.ctx.viewSetup.clipAngle) {
      tspan = (tspan - 2 * this.ctx.viewSetup.clipAngle) >>> 0;
      if (tspan >= span) {
        return;
      }
      angle2 = (-this.ctx.viewSetup.clipAngle) >>> 0;
    }

    angle1 = ((angle1 + ANG90) >>> 0) >> ANGLETOFINESHIFT;
    angle2 = ((angle2 + ANG90) >>> 0) >> ANGLETOFINESHIFT;
    const x1 = this.ctx.viewSetup.viewAngleToX[angle1];
    const x2 = this.ctx.viewSetup.viewAngleToX[angle2];
    if (x1 === x2) {
      return;
    }

    if (!backsector
      || backsector.ceilingHeight <= frontsector.floorHeight
      || backsector.floorHeight >= frontsector.ceilingHeight) {
      this.ctx.clipSegs.clipSolid(x1, x2 - 1, (s, e) => this.walls.storeWallRange(s, e));
      return;
    }

    if (backsector.ceilingHeight !== frontsector.ceilingHeight
      || backsector.floorHeight !== frontsector.floorHeight) {
      this.ctx.clipSegs.clipPass(x1, x2 - 1, (s, e) => this.walls.storeWallRange(s, e));
      return;
    }

    if (backsector.ceilingPic === frontsector.ceilingPic
      && backsector.floorPic === frontsector.floorPic
      && backsector.lightLevel === frontsector.lightLevel
      && line.sidedef.midTexture === 0) {
      return;
    }

    this.ctx.clipSegs.clipPass(x1, x2 - 1, (s, e) => this.walls.storeWallRange(s, e));
  }

  /** @param {number[][]} bbox */
  checkBBox(bbox) {
    let boxx;
    if (this.ctx.viewX <= bbox[BOXLEFT]) {
      boxx = 0;
    } else if (this.ctx.viewX < bbox[BOXRIGHT]) {
      boxx = 1;
    } else {
      boxx = 2;
    }

    let boxy;
    if (this.ctx.viewY >= bbox[BOXTOP]) {
      boxy = 0;
    } else if (this.ctx.viewY > bbox[BOXBOTTOM]) {
      boxy = 1;
    } else {
      boxy = 2;
    }

    const boxpos = (boxy << 2) + boxx;
    if (boxpos === 5) {
      return true;
    }

    const coords = CHECK_COORD[boxpos];
    if (!coords) {
      return true;
    }

    const x1 = bbox[coords[0]];
    const y1 = bbox[coords[1]];
    const x2 = bbox[coords[2]];
    const y2 = bbox[coords[3]];

    let angle1 = (pointToAngle(x1, y1, this.ctx.viewX, this.ctx.viewY, this.ctx.tables.tantoangle)
      - this.ctx.viewAngle) >>> 0;
    let angle2 = (pointToAngle(x2, y2, this.ctx.viewX, this.ctx.viewY, this.ctx.tables.tantoangle)
      - this.ctx.viewAngle) >>> 0;
    const span = (angle1 - angle2) >>> 0;
    if (span >= ANG180) {
      return true;
    }

    let tspan = (angle1 + this.ctx.viewSetup.clipAngle) >>> 0;
    if (tspan > 2 * this.ctx.viewSetup.clipAngle) {
      tspan = (tspan - 2 * this.ctx.viewSetup.clipAngle) >>> 0;
      if (tspan >= span) {
        return false;
      }
      angle1 = this.ctx.viewSetup.clipAngle;
    }

    tspan = (this.ctx.viewSetup.clipAngle - angle2) >>> 0;
    if (tspan > 2 * this.ctx.viewSetup.clipAngle) {
      tspan = (tspan - 2 * this.ctx.viewSetup.clipAngle) >>> 0;
      if (tspan >= span) {
        return false;
      }
      angle2 = (-this.ctx.viewSetup.clipAngle) >>> 0;
    }

    angle1 = ((angle1 + ANG90) >>> 0) >> ANGLETOFINESHIFT;
    angle2 = ((angle2 + ANG90) >>> 0) >> ANGLETOFINESHIFT;
    const sx1 = this.ctx.viewSetup.viewAngleToX[angle1];
    let sx2 = this.ctx.viewSetup.viewAngleToX[angle2];
    if (sx1 === sx2) {
      return false;
    }
    sx2--;

    return this.ctx.clipSegs.hasOpening(sx1, sx2);
  }
}
