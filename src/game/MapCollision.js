import {
  BOXTOP,
  BOXBOTTOM,
  BOXLEFT,
  BOXRIGHT,
} from '../core/angles.js';
import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import {
  ANG180,
  ANG90,
  ANGLETOFINESHIFT,
  fineAngleIndex,
} from '../core/angles.js';
import {
  MAPBLOCKSHIFT,
  MAPBTOFRAC,
  MAPBLOCKSIZE,
  MAXINTERCEPTS,
  MAXMOVE,
  MAXSTEPHEIGHT,
  MF_DROPOFF,
  MF_NOCLIP,
  MF_TELEPORT,
  ML_BLOCKING,
  ML_BLOCKMONSTERS,
  PT_ADDLINES,
  FRICTION,
  STOPSPEED,
  ST_HORIZONTAL,
  ST_VERTICAL,
} from '../core/gameConstants.js';
import { fixedDiv, fixedMul } from '../math/fixed.js';
import {
  boxOnLineSide,
  interceptVector,
  lineOpening,
  makeDivline,
  pointOnDivlineSide,
  pointOnLineSide,
} from '../math/mapGeometry.js';
import { ML_TWOSIDED } from './mapFormat.js';
import { createTrigTables } from '../math/tables.js';
import { pointToAngle } from '../math/viewMath.js';
import { MF_PICKUP, MF_SOLID, MF_SPECIAL } from './mobjFlags.js';

/**
 * Map collision and movement (p_map.c, p_maputl.c, p_mobj.c).
 */
export class MapCollision {
  /**
   * @param {import('./Level.js').Level} level
   * @param {import('./MapThingSpawner.js').MapThingMobj[]} [mapThings]
   * @param {import('./ItemPickup.js').ItemPickup|null} [pickups]
   */
  constructor(level, mapThings = [], pickups = null) {
    this.level = level;
    this.mapThings = mapThings;
    this.pickups = pickups;
    this.tables = createTrigTables();
    this.tantoangle = this.tables.tantoangle;

    this.validcount = 0;
    this.tmthing = null;
    this.tmflags = 0;
    this.tmx = 0;
    this.tmy = 0;
    this.tmbbox = [0, 0, 0, 0];
    this.tmfloorz = 0;
    this.tmceilingz = 0;
    this.tmdropoffz = 0;
    this.ceilingline = null;

    this.slidemo = null;
    this.bestslidefrac = 0;
    this.bestslideline = null;
    this.tmxmove = 0;
    this.tmymove = 0;

    this.trace = { x: 0, y: 0, dx: 0, dy: 0 };
    this.intercepts = [];
    for (let i = 0; i < MAXINTERCEPTS; i++) {
      this.intercepts.push({ frac: 0, isaline: false, line: null });
    }
    this.interceptCount = 0;
  }

  /**
   * @param {import('./Mobj.js').Mobj} thing
   * @param {number} x
   * @param {number} y
   */
  checkPosition(thing, x, y) {
    this.validcount++;
    this.tmthing = thing;
    this.tmflags = thing.flags;
    this.tmx = x;
    this.tmy = y;

    this.tmbbox[BOXTOP] = y + thing.radius;
    this.tmbbox[BOXBOTTOM] = y - thing.radius;
    this.tmbbox[BOXRIGHT] = x + thing.radius;
    this.tmbbox[BOXLEFT] = x - thing.radius;

    const newsubsec = this.level.findSubsector(x, y);
    this.ceilingline = null;

    this.tmfloorz = newsubsec.sector.floorHeight;
    this.tmdropoffz = newsubsec.sector.floorHeight;
    this.tmceilingz = newsubsec.sector.ceilingHeight;

    if (this.tmflags & MF_NOCLIP) {
      return true;
    }

    const blockmap = this.level.blockmap;
    const xl = (this.tmbbox[BOXLEFT] - blockmap.orgX) >> MAPBLOCKSHIFT;
    const xh = (this.tmbbox[BOXRIGHT] - blockmap.orgX) >> MAPBLOCKSHIFT;
    const yl = (this.tmbbox[BOXBOTTOM] - blockmap.orgY) >> MAPBLOCKSHIFT;
    const yh = (this.tmbbox[BOXTOP] - blockmap.orgY) >> MAPBLOCKSHIFT;

    for (let bx = xl; bx <= xh; bx++) {
      for (let by = yl; by <= yh; by++) {
        const indices = blockmap.lineIndicesForBlock(bx, by);
        for (const lineIndex of indices) {
          const line = this.level.lines[lineIndex];
          if (line.validcount === this.validcount) {
            continue;
          }
          line.validcount = this.validcount;
          if (!this.checkLine(line)) {
            return false;
          }
        }
      }
    }

    for (const thing of this.mapThings) {
      if (!this.checkThing(thing)) {
        return false;
      }
    }

    return true;
  }

  /** @param {import('./MapThingSpawner.js').MapThingMobj} thing */
  checkThing(thing) {
    if (thing.removed) {
      return true;
    }
    if (!(thing.flags & (MF_SOLID | MF_SPECIAL))) {
      return true;
    }

    const blockdist = thing.radius + this.tmthing.radius;
    if (Math.abs(thing.x - this.tmx) >= blockdist
      || Math.abs(thing.y - this.tmy) >= blockdist) {
      return true;
    }

    if (thing.flags & MF_SPECIAL) {
      const solid = (thing.flags & MF_SOLID) !== 0;
      if ((this.tmflags & MF_PICKUP) && this.pickups && this.tmthing.playerObject) {
        this.pickups.touchSpecial(this.tmthing.playerObject, thing);
      }
      return !solid;
    }

    return !(thing.flags & MF_SOLID);
  }

  /** @param {import('./Level.js').LevelLine} ld */
  checkLine(ld) {
    if (this.tmbbox[BOXRIGHT] <= ld.bbox[BOXLEFT]
      || this.tmbbox[BOXLEFT] >= ld.bbox[BOXRIGHT]
      || this.tmbbox[BOXTOP] <= ld.bbox[BOXBOTTOM]
      || this.tmbbox[BOXBOTTOM] >= ld.bbox[BOXTOP]) {
      return true;
    }

    if (boxOnLineSide(this.tmbbox, ld) !== -1) {
      return true;
    }

    if (!ld.backSector) {
      return false;
    }

    if (!(this.tmthing.flags & (1 << 22))) {
      if (ld.flags & ML_BLOCKING) {
        return false;
      }
      if (ld.flags & ML_BLOCKMONSTERS) {
        return false;
      }
    }

    const opening = lineOpening(ld);
    if (opening.opentop < this.tmceilingz) {
      this.tmceilingz = opening.opentop;
      this.ceilingline = ld;
    }
    if (opening.openbottom > this.tmfloorz) {
      this.tmfloorz = opening.openbottom;
    }
    if (opening.lowfloor < this.tmdropoffz) {
      this.tmdropoffz = opening.lowfloor;
    }

    return true;
  }

  /**
   * @param {import('./Mobj.js').Mobj} thing
   * @param {number} x
   * @param {number} y
   */
  tryMove(thing, x, y) {
    if (!this.checkPosition(thing, x, y)) {
      return false;
    }

    if (!(thing.flags & MF_NOCLIP)) {
      if (this.tmceilingz - this.tmfloorz < thing.height) {
        return false;
      }
      if (!(thing.flags & MF_TELEPORT)
        && this.tmceilingz - thing.z < thing.height) {
        return false;
      }
      if (!(thing.flags & MF_TELEPORT)
        && this.tmfloorz - thing.z > MAXSTEPHEIGHT) {
        return false;
      }
      if (!(thing.flags & (MF_DROPOFF | (1 << 24)))
        && this.tmfloorz - this.tmdropoffz > MAXSTEPHEIGHT) {
        return false;
      }
    }

    thing.floorz = this.tmfloorz;
    thing.ceilingz = this.tmceilingz;
    thing.x = x;
    thing.y = y;
    thing.subsector = this.level.findSubsector(x, y);
    return true;
  }

  /**
   * @param {import('./Mobj.js').Mobj} mo
   * @param {import('./TicCmd.js').TicCmd|null} cmd
   */
  xyMovement(mo, cmd) {
    if (!mo.momx && !mo.momy) {
      return;
    }

    if (mo.momx > MAXMOVE) {
      mo.momx = MAXMOVE;
    } else if (mo.momx < -MAXMOVE) {
      mo.momx = -MAXMOVE;
    }
    if (mo.momy > MAXMOVE) {
      mo.momy = MAXMOVE;
    } else if (mo.momy < -MAXMOVE) {
      mo.momy = -MAXMOVE;
    }

    let xmove = mo.momx;
    let ymove = mo.momy;

    do {
      let ptryx;
      let ptryy;
      if (xmove > (MAXMOVE >> 1) || ymove > (MAXMOVE >> 1)) {
        ptryx = mo.x + (xmove >> 1);
        ptryy = mo.y + (ymove >> 1);
        xmove >>= 1;
        ymove >>= 1;
      } else {
        ptryx = mo.x + xmove;
        ptryy = mo.y + ymove;
        xmove = 0;
        ymove = 0;
      }

      if (!this.tryMove(mo, ptryx, ptryy)) {
        if (mo.player) {
          this.slideMove(mo);
        } else {
          mo.momx = 0;
          mo.momy = 0;
        }
      }
    } while (xmove || ymove);

    if (mo.z > mo.floorz) {
      return;
    }

    const stopped = mo.momx > -STOPSPEED && mo.momx < STOPSPEED
      && mo.momy > -STOPSPEED && mo.momy < STOPSPEED
      && (!cmd || (cmd.forwardmove === 0 && cmd.sidemove === 0));

    if (stopped) {
      mo.momx = 0;
      mo.momy = 0;
    } else {
      mo.momx = fixedMul(mo.momx, FRICTION);
      mo.momy = fixedMul(mo.momy, FRICTION);
    }
  }

  /** @param {import('./Mobj.js').Mobj} mo */
  slideMove(mo) {
    this.slidemo = mo;
    let hitcount = 0;

    while (true) {
      if (++hitcount === 3) {
        this.stairStep(mo);
        return;
      }

      let leadx;
      let leady;
      let trailx;
      let traily;

      if (mo.momx > 0) {
        leadx = mo.x + mo.radius;
        trailx = mo.x - mo.radius;
      } else {
        leadx = mo.x - mo.radius;
        trailx = mo.x + mo.radius;
      }

      if (mo.momy > 0) {
        leady = mo.y + mo.radius;
        traily = mo.y - mo.radius;
      } else {
        leady = mo.y - mo.radius;
        traily = mo.y + mo.radius;
      }

      this.bestslidefrac = FRACUNIT + 1;
      this.interceptCount = 0;

      this.pathTraverse(leadx, leady, leadx + mo.momx, leady + mo.momy, PT_ADDLINES);
      this.pathTraverse(trailx, leady, trailx + mo.momx, leady + mo.momy, PT_ADDLINES);
      this.pathTraverse(leadx, traily, leadx + mo.momx, traily + mo.momy, PT_ADDLINES);

      if (this.bestslidefrac === FRACUNIT + 1) {
        this.stairStep(mo);
        return;
      }

      let bestslidefrac = this.bestslidefrac - 0x800;
      if (bestslidefrac > 0) {
        const newx = fixedMul(mo.momx, bestslidefrac);
        const newy = fixedMul(mo.momy, bestslidefrac);
        if (!this.tryMove(mo, mo.x + newx, mo.y + newy)) {
          continue;
        }
      }

      bestslidefrac = FRACUNIT - (this.bestslidefrac + 0x800);
      if (bestslidefrac > FRACUNIT) {
        bestslidefrac = FRACUNIT;
      }
      if (bestslidefrac <= 0) {
        return;
      }

      this.tmxmove = fixedMul(mo.momx, bestslidefrac);
      this.tmymove = fixedMul(mo.momy, bestslidefrac);
      this.hitSlideLine(this.bestslideline);
      mo.momx = this.tmxmove;
      mo.momy = this.tmymove;

      if (this.tryMove(mo, mo.x + this.tmxmove, mo.y + this.tmymove)) {
        return;
      }
    }
  }

  /** @param {import('./Mobj.js').Mobj} mo */
  stairStep(mo) {
    if (!this.tryMove(mo, mo.x, mo.y + mo.momy)) {
      this.tryMove(mo, mo.x + mo.momx, mo.y);
    }
  }

  /** @param {import('./Level.js').LevelLine} ld */
  hitSlideLine(ld) {
    if (ld.slopetype === ST_HORIZONTAL) {
      this.tmymove = 0;
      return;
    }
    if (ld.slopetype === ST_VERTICAL) {
      this.tmxmove = 0;
      return;
    }

    const side = pointOnLineSide(this.slidemo.x, this.slidemo.y, ld);
    let lineangle = pointToAngle(ld.dx, ld.dy, 0, 0, this.tantoangle);
    if (side === 1) {
      lineangle = (lineangle + ANG180) >>> 0;
    }

    const moveangle = pointToAngle(this.tmxmove, this.tmymove, 0, 0, this.tantoangle);
    let deltaangle = (moveangle - lineangle) >>> 0;
    if (deltaangle > ANG180) {
      deltaangle = (deltaangle + ANG180) >>> 0;
    }

    const lineIdx = fineAngleIndex(lineangle);
    const deltaIdx = fineAngleIndex(deltaangle);
    const movelen = Math.hypot(this.tmxmove, this.tmymove) | 0;
    const newlen = fixedMul(movelen, this.tables.finecosine[deltaIdx]);
    this.tmxmove = fixedMul(newlen, this.tables.finecosine[lineIdx]);
    this.tmymove = fixedMul(newlen, this.tables.finesine[lineIdx]);
  }

  pathTraverse(x1, y1, x2, y2, flags, traverseFn = null) {
    const blockmap = this.level.blockmap;
    this.interceptCount = 0;
    if (((x1 - blockmap.orgX) & (MAPBLOCKSIZE - 1)) === 0) {
      x1 += FRACUNIT;
    }
    if (((y1 - blockmap.orgY) & (MAPBLOCKSIZE - 1)) === 0) {
      y1 += FRACUNIT;
    }

    this.trace.x = x1;
    this.trace.y = y1;
    this.trace.dx = x2 - x1;
    this.trace.dy = y2 - y1;

    let x1rel = x1 - blockmap.orgX;
    let y1rel = y1 - blockmap.orgY;
    let xt1 = x1rel >> MAPBLOCKSHIFT;
    let yt1 = y1rel >> MAPBLOCKSHIFT;

    const x2rel = x2 - blockmap.orgX;
    const y2rel = y2 - blockmap.orgY;
    const xt2 = x2rel >> MAPBLOCKSHIFT;
    const yt2 = y2rel >> MAPBLOCKSHIFT;

    let mapxstep = 0;
    let mapystep = 0;
    let xstep = 0;
    let ystep = 0;
    let partial;
    let xintercept;
    let yintercept;

    if (xt2 > xt1) {
      mapxstep = 1;
      partial = FRACUNIT - ((x1rel >> MAPBTOFRAC) & (FRACUNIT - 1));
      ystep = fixedDiv(y2 - y1, Math.abs(x2 - x1));
    } else if (xt2 < xt1) {
      mapxstep = -1;
      partial = (x1rel >> MAPBTOFRAC) & (FRACUNIT - 1);
      ystep = fixedDiv(y2 - y1, Math.abs(x2 - x1));
    } else {
      partial = FRACUNIT;
      ystep = 256 * FRACUNIT;
    }
    yintercept = (y1rel >> MAPBTOFRAC) + fixedMul(partial, ystep);

    if (yt2 > yt1) {
      mapystep = 1;
      partial = FRACUNIT - ((y1rel >> MAPBTOFRAC) & (FRACUNIT - 1));
      xstep = fixedDiv(x2 - x1, Math.abs(y2 - y1));
    } else if (yt2 < yt1) {
      mapystep = -1;
      partial = (y1rel >> MAPBTOFRAC) & (FRACUNIT - 1);
      xstep = fixedDiv(x2 - x1, Math.abs(y2 - y1));
    } else {
      partial = FRACUNIT;
      xstep = 256 * FRACUNIT;
    }
    xintercept = (x1rel >> MAPBTOFRAC) + fixedMul(partial, xstep);

    let mapx = xt1;
    let mapy = yt1;

    for (let count = 0; count < 64; count++) {
      if (flags & PT_ADDLINES) {
        const indices = blockmap.lineIndicesForBlock(mapx, mapy);
        for (const lineIndex of indices) {
          this.addLineIntercept(this.level.lines[lineIndex]);
        }
      }

      if (mapx === xt2 && mapy === yt2) {
        break;
      }

      if ((yintercept >> FRACBITS) === mapy) {
        yintercept += ystep;
        mapx += mapxstep;
      } else if ((xintercept >> FRACBITS) === mapx) {
        xintercept += xstep;
        mapy += mapystep;
      }
    }

    const active = this.intercepts.slice(0, this.interceptCount);
    active.sort((a, b) => a.frac - b.frac);

    const traverse = traverseFn ?? ((incept) => this.slideTraverse(incept));

    for (let i = 0; i < active.length; i++) {
      if (!traverse(active[i])) {
        break;
      }
    }
  }

  /** @param {import('./Level.js').LevelLine} ld */
  addLineIntercept(ld) {
    let s1;
    let s2;
    const trace = this.trace;

    if (trace.dx > FRACUNIT * 16 || trace.dy > FRACUNIT * 16
      || trace.dx < -FRACUNIT * 16 || trace.dy < -FRACUNIT * 16) {
      s1 = pointOnDivlineSide(ld.v1.x, ld.v1.y, trace);
      s2 = pointOnDivlineSide(ld.v2.x, ld.v2.y, trace);
    } else {
      s1 = pointOnLineSide(trace.x, trace.y, ld);
      s2 = pointOnLineSide(trace.x + trace.dx, trace.y + trace.dy, ld);
    }

    if (s1 === s2) {
      return;
    }

    const frac = interceptVector(trace, makeDivline(ld));
    if (frac < 0 || this.interceptCount >= MAXINTERCEPTS) {
      return;
    }

    const entry = this.intercepts[this.interceptCount++];
    entry.frac = frac;
    entry.isaline = true;
    entry.line = ld;
  }

  /** @param {{ frac: number, line: import('./Level.js').LevelLine|null }} incept */
  slideTraverse(incept) {
    const li = incept.line;
    if (!li) {
      return true;
    }
    if (!(li.flags & ML_TWOSIDED)) {
      if (pointOnLineSide(this.slidemo.x, this.slidemo.y, li)) {
        return true;
      }
      return this.recordSlide(incept);
    }

    const opening = lineOpening(li);
    if (opening.openrange < this.slidemo.height) {
      return this.recordSlide(incept);
    }
    if (opening.opentop - this.slidemo.z < this.slidemo.height) {
      return this.recordSlide(incept);
    }
    if (opening.openbottom - this.slidemo.z > MAXSTEPHEIGHT) {
      return this.recordSlide(incept);
    }
    return true;
  }

  recordSlide(incept) {
    if (incept.frac < this.bestslidefrac) {
      this.bestslidefrac = incept.frac;
      this.bestslideline = incept.line;
    }
    return false;
  }

  /**
   * Hitscan trace — stops at the first blocking line (p_map.c — PTR_ShootTraverse).
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {number} shootZ
   * @param {number} slope
   * @param {number} attackrange
   * @returns {{ hit: boolean, x?: number, y?: number, z?: number }}
   */
  shootTraverse(x1, y1, x2, y2, shootZ, slope, attackrange) {
    const blockmap = this.level.blockmap;
    if (((x1 - blockmap.orgX) & (MAPBLOCKSIZE - 1)) === 0) {
      x1 += FRACUNIT;
    }
    if (((y1 - blockmap.orgY) & (MAPBLOCKSIZE - 1)) === 0) {
      y1 += FRACUNIT;
    }

    this.trace.x = x1;
    this.trace.y = y1;
    this.trace.dx = x2 - x1;
    this.trace.dy = y2 - y1;
    this.interceptCount = 0;

    let x1rel = x1 - blockmap.orgX;
    let y1rel = y1 - blockmap.orgY;
    let xt1 = x1rel >> MAPBLOCKSHIFT;
    let yt1 = y1rel >> MAPBLOCKSHIFT;

    const x2rel = x2 - blockmap.orgX;
    const y2rel = y2 - blockmap.orgY;
    const xt2 = x2rel >> MAPBLOCKSHIFT;
    const yt2 = y2rel >> MAPBLOCKSHIFT;

    let mapxstep = 0;
    let mapystep = 0;
    let xstep = 0;
    let ystep = 0;
    let partial;
    let xintercept;
    let yintercept;

    if (xt2 > xt1) {
      mapxstep = 1;
      partial = FRACUNIT - ((x1rel >> MAPBTOFRAC) & (FRACUNIT - 1));
      ystep = fixedDiv(y2 - y1, Math.abs(x2 - x1));
    } else if (xt2 < xt1) {
      mapxstep = -1;
      partial = (x1rel >> MAPBTOFRAC) & (FRACUNIT - 1);
      ystep = fixedDiv(y2 - y1, Math.abs(x2 - x1));
    } else {
      partial = FRACUNIT;
      ystep = 256 * FRACUNIT;
    }
    yintercept = (y1rel >> MAPBTOFRAC) + fixedMul(partial, ystep);

    if (yt2 > yt1) {
      mapystep = 1;
      partial = FRACUNIT - ((y1rel >> MAPBTOFRAC) & (FRACUNIT - 1));
      xstep = fixedDiv(x2 - x1, Math.abs(y2 - y1));
    } else if (yt2 < yt1) {
      mapystep = -1;
      partial = (y1rel >> MAPBTOFRAC) & (FRACUNIT - 1);
      xstep = fixedDiv(x2 - x1, Math.abs(y2 - y1));
    } else {
      partial = FRACUNIT;
      xstep = 256 * FRACUNIT;
    }
    xintercept = (x1rel >> MAPBTOFRAC) + fixedMul(partial, xstep);

    let mapx = xt1;
    let mapy = yt1;

    for (let count = 0; count < 64; count++) {
      const indices = blockmap.lineIndicesForBlock(mapx, mapy);
      for (const lineIndex of indices) {
        this.addLineIntercept(this.level.lines[lineIndex]);
      }

      if (mapx === xt2 && mapy === yt2) {
        break;
      }

      if ((yintercept >> FRACBITS) === mapy) {
        yintercept += ystep;
        mapx += mapxstep;
      } else if ((xintercept >> FRACBITS) === mapx) {
        xintercept += xstep;
        mapy += mapystep;
      }
    }

    const active = this.intercepts.slice(0, this.interceptCount);
    active.sort((a, b) => a.frac - b.frac);

    const aimslope = slope;

    for (let i = 0; i < active.length; i++) {
      const incept = active[i];
      const li = incept.line;
      if (!li) {
        continue;
      }

      if (!(li.flags & ML_TWOSIDED)) {
        return this.shootHitLine(incept, shootZ, aimslope, attackrange);
      }

      const opening = lineOpening(li);
      const dist = fixedMul(attackrange, incept.frac);

      if (li.frontsector && li.backsector
        && li.frontsector.floorHeight !== li.backsector.floorHeight) {
        const lineSlope = fixedDiv(opening.openbottom - shootZ, dist);
        if (lineSlope > aimslope) {
          return this.shootHitLine(incept, shootZ, aimslope, attackrange);
        }
      }

      if (li.frontsector && li.backsector
        && li.frontsector.ceilingHeight !== li.backsector.ceilingHeight) {
        const lineSlope = fixedDiv(opening.opentop - shootZ, dist);
        if (lineSlope < aimslope) {
          return this.shootHitLine(incept, shootZ, aimslope, attackrange);
        }
      }

      if (opening.openrange <= 0) {
        return this.shootHitLine(incept, shootZ, aimslope, attackrange);
      }
    }

    return { hit: false };
  }

  /**
   * @param {{ frac: number, line: import('./Level.js').LevelLine|null }} incept
   * @param {number} shootZ
   * @param {number} aimslope
   * @param {number} attackrange
   */
  shootHitLine(incept, shootZ, aimslope, attackrange) {
    const li = incept.line;
    if (!li) {
      return { hit: false };
    }

    let frac = incept.frac - fixedDiv(4 * FRACUNIT, attackrange);
    const x = this.trace.x + fixedMul(this.trace.dx, frac);
    const y = this.trace.y + fixedMul(this.trace.dy, frac);
    const z = shootZ + fixedMul(aimslope, fixedMul(frac, attackrange));

    const skyFlat = this.level.skyFlatNum;
    if (li.frontsector && li.frontsector.ceilingPic === skyFlat) {
      if (z > li.frontsector.ceilingHeight) {
        return { hit: false };
      }
      if (li.backsector && li.backsector.ceilingPic === skyFlat) {
        return { hit: false };
      }
    }

    return { hit: true, x, y, z };
  }

  /** @param {import('./Player.js').Player} player */
  zMovement(player) {
    const mo = player.mo;
    if (mo.z < mo.floorz) {
      player.viewheight -= mo.floorz - mo.z;
      player.deltaviewheight = (player.viewheightBase - player.viewheight) >> 3;
    }

    mo.z = mo.floorz;
    mo.momz = 0;
  }
}
