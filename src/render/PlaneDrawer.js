import {
  ANG90,
  ANGLETOFINESHIFT,
  fineAngleIndex,
  LIGHTSEGSHIFT,
  LIGHTZSHIFT,
  LIGHTLEVELS,
  MAXLIGHTZ,
} from '../core/angles.js';
import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { fixedDiv2, fixedMul } from '../math/fixed.js';
import { MAX_VIS_PLANES, VIS_PLANE_TOP_OPEN } from './ClipSegList.js';

/**
 * Floor and ceiling plane rendering (r_plane.c).
 */
export class PlaneDrawer {
  /**
   * @param {import('./RenderContext.js').RenderContext} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.floorPlane = null;
    this.ceilingPlane = null;
    this.spanStart = new Int32Array(this.ctx.viewHeight);
    this.cachedHeight = new Int32Array(this.ctx.viewHeight);
    this.cachedDistance = new Int32Array(this.ctx.viewHeight);
    this.cachedXStep = new Int32Array(this.ctx.viewHeight);
    this.cachedYStep = new Int32Array(this.ctx.viewHeight);
    this.baseXScale = 0;
    this.baseYScale = 0;
    this.planeHeight = 0;
    this.planeZLight = null;
  }

  /** @param {object} sector */
  findFloorPlane(sector) {
    this.floorPlane = this.findPlane(sector.floorHeight, sector.floorPic, sector.lightLevel);
  }

  /** @param {object} sector */
  findCeilingPlane(sector) {
    this.ceilingPlane = this.findPlane(sector.ceilingHeight, sector.ceilingPic, sector.lightLevel);
  }

  /**
   * @param {number} height
   * @param {number} picnum
   * @param {number} lightlevel
   */
  findPlane(height, picnum, lightlevel) {
    if (picnum === this.ctx.textures.skyFlatNum) {
      height = 0;
      lightlevel = 0;
    }

    for (let i = 0; i < this.ctx.visPlaneCount; i++) {
      const check = this.ctx.visPlanes[i];
      if (height === check.height && picnum === check.picnum && lightlevel === check.lightlevel) {
        return check;
      }
    }

    if (this.ctx.visPlaneCount >= MAX_VIS_PLANES) {
      return this.ctx.visPlanes[MAX_VIS_PLANES - 1];
    }

    const plane = this.ctx.visPlanes[this.ctx.visPlaneCount++];
    plane.height = height;
    plane.picnum = picnum;
    plane.lightlevel = lightlevel;
    plane.minx = this.ctx.viewWidth;
    plane.maxx = -1;
    plane.top.fill(VIS_PLANE_TOP_OPEN);
    plane.bottom.fill(0);
    return plane;
  }

  /**
   * @param {import('./ClipSegList.js').VisPlane|null} pl
   * @param {number} start
   * @param {number} stop
   */
  checkPlane(pl, start, stop) {
    if (!pl) {
      return pl;
    }

    let intrl;
    let intrh;
    let unionl;
    let unionh;

    if (start < pl.minx) {
      intrl = pl.minx;
      unionl = start;
    } else {
      unionl = pl.minx;
      intrl = start;
    }

    if (stop > pl.maxx) {
      intrh = pl.maxx;
      unionh = stop;
    } else {
      unionh = pl.maxx;
      intrh = stop;
    }

    for (let x = intrl; x <= intrh; x++) {
      if (pl.top[x] !== VIS_PLANE_TOP_OPEN) {
        return this.splitPlane(pl, start, stop);
      }
    }

    pl.minx = unionl;
    pl.maxx = unionh;
    return pl;
  }

  splitPlane(pl, start, stop) {
    if (this.ctx.visPlaneCount >= MAX_VIS_PLANES) {
      return pl;
    }

    const next = this.ctx.visPlanes[this.ctx.visPlaneCount++];
    next.height = pl.height;
    next.picnum = pl.picnum;
    next.lightlevel = pl.lightlevel;
    next.minx = start;
    next.maxx = stop;
    next.top.fill(VIS_PLANE_TOP_OPEN);
    next.bottom.fill(0);
    return next;
  }

  clearPlanes() {
    this.cachedHeight.fill(0);
    const angle = fineAngleIndex(this.ctx.viewAngle - ANG90);
    this.baseXScale = fixedDiv2(this.ctx.tables.finecosine[angle], this.ctx.viewSetup.centerXFrac);
    this.baseYScale = -fixedDiv2(this.ctx.tables.finesine[angle], this.ctx.viewSetup.centerXFrac);
  }

  drawPlanes() {
    for (let p = 0; p < this.ctx.visPlaneCount; p++) {
      const pl = this.ctx.visPlanes[p];
      if (pl.minx > pl.maxx) {
        continue;
      }

      if (pl.picnum === this.ctx.textures.skyFlatNum) {
        this.drawSkyPlane(pl);
        continue;
      }

      const flat = this.ctx.textures.getFlat(pl.picnum);
      if (!flat) {
        continue;
      }

      this.planeHeight = Math.abs(pl.height - this.ctx.viewZ);
      let light = (pl.lightlevel >> LIGHTSEGSHIFT) + this.ctx.extralight;
      if (light >= LIGHTLEVELS) {
        light = LIGHTLEVELS - 1;
      }
      if (light < 0) {
        light = 0;
      }
      this.planeZLight = this.ctx.viewSetup.zLight[light];

      // C sets top[minx-1] and top[maxx+1] fenceposts via pad bytes before top[].
      // Typed arrays cannot index -1, so carry the previous column explicitly.
      let prevTop = VIS_PLANE_TOP_OPEN;
      let prevBottom = 0;
      const stop = pl.maxx + 1;
      for (let x = pl.minx; x <= stop; x++) {
        const curTop = x <= pl.maxx ? pl.top[x] : VIS_PLANE_TOP_OPEN;
        const curBottom = x <= pl.maxx ? pl.bottom[x] : 0;
        this.makeSpans(x, prevTop, prevBottom, curTop, curBottom, flat);
        prevTop = curTop;
        prevBottom = curBottom;
      }
    }
  }

  /** @param {import('./ClipSegList.js').VisPlane} pl */
  drawSkyPlane(pl) {
    for (let x = pl.minx; x <= pl.maxx; x++) {
      const yl = pl.top[x];
      const yh = pl.bottom[x];
      if (yl > yh) {
        continue;
      }
      const skyCol = (fineAngleIndex(this.ctx.viewAngle + this.ctx.viewSetup.xToViewAngle[x]) >> 3) & 255;
      this.ctx.drawWallColumn({
        x,
        yl,
        yh,
        iscale: FRACUNIT,
        textureMid: 100 * FRACUNIT,
        source: this.ctx.textures.getColumn(this.ctx.textures.skyTexture, skyCol),
        colormap: this.ctx.colormaps.subarray(0, 256),
      });
    }
  }

  makeSpans(x, t1, b1, t2, b2, flat) {
    while (t1 < t2 && t1 <= b1) {
      this.mapPlane(t1, this.spanStart[t1], x - 1, flat);
      t1++;
    }
    while (b1 > b2 && b1 >= t1) {
      this.mapPlane(b1, this.spanStart[b1], x - 1, flat);
      b1--;
    }
    while (t2 < t1 && t2 <= b2) {
      this.spanStart[t2] = x;
      t2++;
    }
    while (b2 > b1 && b2 >= t2) {
      this.spanStart[b2] = x;
      b2--;
    }
  }

  mapPlane(y, x1, x2, flat) {
    if (x2 < x1 || x1 < 0 || x2 >= this.ctx.viewWidth) {
      return;
    }
    if (y < 0 || y >= this.ctx.viewHeight || !flat) {
      return;
    }

    if (this.planeHeight !== this.cachedHeight[y]) {
      this.cachedHeight[y] = this.planeHeight;
      this.cachedDistance[y] = fixedMul(this.planeHeight, this.ctx.viewSetup.ySlope[y]);
      this.cachedXStep[y] = fixedMul(this.cachedDistance[y], this.baseXScale);
      this.cachedYStep[y] = fixedMul(this.cachedDistance[y], this.baseYScale);
    }

    const distance = this.cachedDistance[y];
    const dsXStep = this.cachedXStep[y];
    const dsYStep = this.cachedYStep[y];

    // Vanilla r_plane.c: one colormap per scanline from row distance, not per-column
    // view distance. Per-column splits caused visible vertical seams on the floor that
    // lined up with wall light bands and looked like distance rings/corruption.
    let lightIndex = (distance >>> 0) >> LIGHTZSHIFT;
    if (lightIndex < 0) {
      lightIndex = 0;
    }
    if (lightIndex >= MAXLIGHTZ) {
      lightIndex = MAXLIGHTZ - 1;
    }
    const colormap = this.planeZLight?.[lightIndex];
    if (!colormap) {
      return;
    }

    const angle = fineAngleIndex(this.ctx.viewAngle + this.ctx.viewSetup.xToViewAngle[x1]);
    const length = fixedMul(distance, this.ctx.viewSetup.distScale[x1]);
    const dsXFrac = this.ctx.viewX + fixedMul(this.ctx.tables.finecosine[angle], length);
    const dsYFrac = -this.ctx.viewY - fixedMul(this.ctx.tables.finesine[angle], length);

    this.ctx.drawPlaneSpan({
      y,
      x1,
      x2,
      xfrac: dsXFrac,
      yfrac: dsYFrac,
      xstep: dsXStep,
      ystep: dsYStep,
      source: flat,
      colormap,
    });
  }
}
