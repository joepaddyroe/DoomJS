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
  fineAngleIndex,
} from '../core/angles.js';
import {
  MAPBLOCKSHIFT,
  MAPBTOFRAC,
  MAPBLOCKSIZE,
  MAXINTERCEPTS,
  MAXMOVE,
  MAXSPECIALCROSS,
  MAXSTEPHEIGHT,
  MF_DROPOFF,
  MF_MISSILE,
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
import { MF_PICKUP, MF_SHOOTABLE, MF_SOLID, MF_SPECIAL } from './mobjFlags.js';
import { gameRandom } from './GameRandom.js';
import { damageMobj } from './monster/MobjCombat.js';
import { crossSpecialLine } from './spec/CrossSpecialLine.js';

/** Vertical auto-aim cone (p_map.c — P_AimLineAttack topslope/bottomslope). */
const AIM_TOP_SLOPE = ((100 * FRACUNIT) / 160) | 0;
const AIM_BOTTOM_SLOPE = ((-100 * FRACUNIT) / 160) | 0;

/**
 * Map collision and movement (p_map.c, p_maputl.c, p_mobj.c).
 */
export class MapCollision {
  /**
   * @param {import('./Level.js').Level} level
   * @param {import('./MapThingSpawner.js').MapThingMobj[]} [mapThings]
   * @param {import('./ItemPickup.js').ItemPickup|null} [pickups]
   * @param {import('./Mobj.js').Mobj|null} [playerMo]
   */
  constructor(level, mapThings = [], pickups = null, playerMo = null) {
    this.level = level;
    this.mapThings = mapThings;
    this.pickups = pickups;
    this.playerMo = playerMo;
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
      this.intercepts.push({ frac: 0, isaline: false, line: null, thing: null });
    }
    this.interceptCount = 0;

    /** @type {import('./monster/MissileManager.js').MissileMobj[]} */
    this.missiles = [];
    /** @type {((mo: import('./monster/MissileManager.js').MissileMobj) => void)|null} */
    this.onMissileExplode = null;
    /** @type {import('./Player.js').Player|null} */
    this.damagePlayer = null;

    /** @type {import('./Level.js').LevelLine[]} */
    this.spechit = new Array(MAXSPECIALCROSS);
    this.numspechit = 0;
    /** @type {import('./spec/Doors.js').SpecContext|null} */
    this.specCtx = null;

    /** @type {{ level: import('./Level.js').Level, things: import('./MapThingSpawner.js').MapThingMobj[] }|null} */
    this.dropCtx = null;
  }

  /**
   * @param {import('./Mobj.js').Mobj} thing
   * @param {number} x
   * @param {number} y
   */
  checkPosition(thing, x, y) {
    this.validcount++;
    this.numspechit = 0;
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

    for (const missile of this.missiles) {
      if (!missile.removed && !this.checkThing(missile)) {
        return false;
      }
    }

    if (this.playerMo && this.tmthing !== this.playerMo) {
      if (!this.checkThing(this.playerMo)) {
        return false;
      }
    }

    return true;
  }

  /** @param {import('./MapThingSpawner.js').MapThingMobj} thing */
  checkThing(thing) {
    if (thing === this.tmthing) {
      return true;
    }
    if (thing.removed) {
      return true;
    }

    if (this.tmflags & MF_MISSILE) {
      if (!(thing.flags & (MF_SOLID | MF_SPECIAL | MF_SHOOTABLE))) {
        return true;
      }

      const blockdist = thing.radius + this.tmthing.radius;
      if (Math.abs(thing.x - this.tmx) >= blockdist
        || Math.abs(thing.y - this.tmy) >= blockdist) {
        return true;
      }

      if (this.tmthing.z > thing.z + thing.height) {
        return true;
      }
      if (this.tmthing.z + this.tmthing.height < thing.z) {
        return true;
      }

      if (this.tmthing.target && thing === this.tmthing.target) {
        return true;
      }

      if (!(thing.flags & MF_SHOOTABLE)) {
        return !(thing.flags & MF_SOLID);
      }

      const damage = ((gameRandom() % 8) + 1) * (this.tmthing.missileDamage ?? 3);
      if (this.damagePlayer) {
        damageMobj(
          thing,
          this.tmthing,
          this.tmthing.target,
          damage,
          this.damagePlayer,
          this.dropCtx,
        );
      }
      return false;
    }

    if (!(thing.flags & (MF_SOLID | MF_SPECIAL | MF_SHOOTABLE))) {
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

    if (!(this.tmthing.flags & MF_MISSILE)) {
      if (ld.flags & ML_BLOCKING) {
        return false;
      }
      if (!this.tmthing.player && (ld.flags & ML_BLOCKMONSTERS)) {
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

    if (ld.special && this.tmthing.playerObject
      && this.numspechit < MAXSPECIALCROSS) {
      this.spechit[this.numspechit++] = ld;
    }

    return true;
  }

  /**
   * @param {import('./Mobj.js').Mobj} thing
   * @param {number} x
   * @param {number} y
   */
  tryMove(thing, x, y) {
    const oldx = thing.x;
    const oldy = thing.y;

    if (!this.checkPosition(thing, x, y)) {
      return false;
    }

    if (!(thing.flags & MF_NOCLIP)) {
      if (thing.flags & MF_MISSILE) {
        thing.floorz = this.tmfloorz;
        thing.ceilingz = this.tmceilingz;
        thing.x = x;
        thing.y = y;
        thing.subsector = this.level.findSubsector(x, y);
        return true;
      }

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

    if (thing.playerObject && this.specCtx) {
      for (let i = 0; i < this.numspechit; i++) {
        const line = this.spechit[i];
        const oldSide = pointOnLineSide(oldx, oldy, line);
        const newSide = pointOnLineSide(x, y, line);
        if (oldSide !== newSide) {
          crossSpecialLine(thing, line, oldSide, this.specCtx);
        }
      }
    }

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
        } else if (mo.flags & MF_MISSILE) {
          if (this.onMissileExplode) {
            this.onMissileExplode(mo);
          }
          return;
        } else {
          mo.momx = 0;
          mo.momy = 0;
        }
      }
    } while (xmove || ymove);

    if (mo.z > mo.floorz) {
      return;
    }

    if (mo.flags & (MF_MISSILE)) {
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
   * Build sorted line/thing intercepts along a horizontal shoot trace.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {object|null} shootThing
   * @returns {{ frac: number, isaline: boolean, line: import('./Level.js').LevelLine|null, thing: object|null }[]}
   */
  collectShootIntercepts(x1, y1, x2, y2, shootThing) {
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

    if (shootThing) {
      this.addShootableIntercepts(shootThing);
    }

    const active = this.intercepts.slice(0, this.interceptCount);
    active.sort((a, b) => a.frac - b.frac);
    return active;
  }

  /**
   * Hitscan trace — stops at the first blocking line or shootable mobj.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {number} shootZ
   * @param {number} slope
   * @param {number} attackrange
   * @param {{ shootThing?: object|null, damage?: number, aimMode?: boolean, onThingHit?: (thing: object, x: number, y: number, z: number) => void, onAimThing?: (thing: object, dist: number) => void }|null} [options]
   * @returns {{ hit: boolean, x?: number, y?: number, z?: number, thing?: object }}
   */
  shootTraverse(x1, y1, x2, y2, shootZ, slope, attackrange, options = null) {
    const shootThing = options?.shootThing ?? null;
    const damage = options?.damage ?? 0;
    const aimMode = options?.aimMode ?? false;
    const onThingHit = options?.onThingHit ?? null;
    const onAimThing = options?.onAimThing ?? null;

    const active = this.collectShootIntercepts(x1, y1, x2, y2, shootThing);
    const aimslope = slope;

    for (let i = 0; i < active.length; i++) {
      const incept = active[i];
      if (!incept.isaline) {
        const hit = this.shootHitThing(
          incept,
          shootZ,
          aimslope,
          attackrange,
          shootThing,
          damage,
          onThingHit,
          aimMode,
          onAimThing,
        );
        if (hit) {
          if (hit.aim) {
            return { hit: false };
          }
          return hit;
        }
        continue;
      }

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
   * @param {object} shootThing
   */
  addShootableIntercepts(shootThing) {
    /** @type {object[]} */
    const candidates = [...this.mapThings];
    if (this.playerMo && this.playerMo !== shootThing) {
      candidates.push(this.playerMo);
    }

    for (const thing of candidates) {
      if (thing === shootThing) {
        continue;
      }
      if (!(thing.flags & MF_SHOOTABLE)) {
        continue;
      }
      if (thing.health !== undefined && thing.health <= 0) {
        continue;
      }
      this.addThingShootIntercept(thing);
    }
  }

  /**
   * Fraction along the current trace where it passes closest to a thing center,
   * when the corner-crossing box test does not fire.
   * @param {object} thing
   * @returns {number}
   */
  thingCenterInterceptFrac(thing) {
    const trace = this.trace;
    const den = BigInt(trace.dx) * BigInt(trace.dx) + BigInt(trace.dy) * BigInt(trace.dy);
    if (den === 0n) {
      return -1;
    }

    const num = BigInt(thing.x - trace.x) * BigInt(trace.dx)
      + BigInt(thing.y - trace.y) * BigInt(trace.dy);
    const frac = Number((num << 16n) / den);
    if (frac < 0 || frac > FRACUNIT) {
      return -1;
    }

    const hitX = trace.x + Number((BigInt(frac) * BigInt(trace.dx)) >> 16n);
    const hitY = trace.y + Number((BigInt(frac) * BigInt(trace.dy)) >> 16n);
    const dx = thing.x - hitX;
    const dy = thing.y - hitY;
    const distSq = BigInt(dx) * BigInt(dx) + BigInt(dy) * BigInt(dy);
    const radiusSq = BigInt(thing.radius) * BigInt(thing.radius);
    if (distSq > radiusSq) {
      return -1;
    }

    return frac;
  }

  /**
   * @param {object} thing
   * @param {number} shootZ
   * @param {number} aimslope
   * @param {number} attackrange
   */
  addThingShootIntercept(thing, shootZ, aimslope, attackrange) {
    const trace = this.trace;
    const tracePositive = (trace.dx ^ trace.dy) > 0;

    let x1;
    let y1;
    let x2;
    let y2;
    if (tracePositive) {
      x1 = thing.x - thing.radius;
      y1 = thing.y + thing.radius;
      x2 = thing.x + thing.radius;
      y2 = thing.y - thing.radius;
    } else {
      x1 = thing.x - thing.radius;
      y1 = thing.y - thing.radius;
      x2 = thing.x + thing.radius;
      y2 = thing.y + thing.radius;
    }

    const s1 = pointOnDivlineSide(x1, y1, trace);
    const s2 = pointOnDivlineSide(x2, y2, trace);
    let frac = -1;
    if (s1 !== s2) {
      const div = { x: x1, y: y1, dx: x2 - x1, dy: y2 - y1 };
      frac = interceptVector(trace, div);
    }
    if (frac < 0 || frac > FRACUNIT) {
      frac = this.thingCenterInterceptFrac(thing);
    }
    if (frac < 0 || frac > FRACUNIT) {
      return;
    }

    if (this.interceptCount >= MAXINTERCEPTS) {
      return;
    }

    const entry = this.intercepts[this.interceptCount++];
    entry.frac = frac;
    entry.isaline = false;
    entry.line = null;
    entry.thing = thing;
  }

  /**
   * Auto-aim slope toward the first shootable thing along a trace (p_map.c — P_AimLineAttack).
   * @param {object} mo
   * @param {number} angle
   * @param {number} distance
   * @returns {number}
   */
  aimLineAttack(mo, angle, distance) {
    const idx = fineAngleIndex(angle);
    const x2 = mo.x + ((distance >> FRACBITS) * this.tables.finecosine[idx]) | 0;
    const y2 = mo.y + ((distance >> FRACBITS) * this.tables.finesine[idx]) | 0;
    const shootZ = mo.z + (mo.height >> 1) + 8 * FRACUNIT;

    let topSlope = AIM_TOP_SLOPE;
    let bottomSlope = AIM_BOTTOM_SLOPE;
    let aimSlope = 0;

    const active = this.collectShootIntercepts(mo.x, mo.y, x2, y2, mo);

    for (let i = 0; i < active.length; i++) {
      const incept = active[i];
      if (incept.isaline) {
        const li = incept.line;
        if (!li || !(li.flags & ML_TWOSIDED)) {
          break;
        }

        const opening = lineOpening(li);
        if (opening.openrange <= 0) {
          break;
        }

        const dist = fixedMul(distance, incept.frac);
        if (li.frontsector && li.backsector
          && li.frontsector.floorHeight !== li.backsector.floorHeight) {
          const lineSlope = fixedDiv(opening.openbottom - shootZ, dist);
          if (lineSlope > bottomSlope) {
            bottomSlope = lineSlope;
          }
        }

        if (li.frontsector && li.backsector
          && li.frontsector.ceilingHeight !== li.backsector.ceilingHeight) {
          const lineSlope = fixedDiv(opening.opentop - shootZ, dist);
          if (lineSlope < topSlope) {
            topSlope = lineSlope;
          }
        }

        if (topSlope <= bottomSlope) {
          break;
        }
        continue;
      }

      const thing = incept.thing;
      if (!thing || thing === mo || !(thing.flags & MF_SHOOTABLE)) {
        continue;
      }

      const dist = fixedMul(distance, incept.frac);
      if (!dist) {
        continue;
      }

      let thingTopSlope = fixedDiv(thing.z + thing.height - shootZ, dist);
      if (thingTopSlope < bottomSlope) {
        continue;
      }

      let thingBottomSlope = fixedDiv(thing.z - shootZ, dist);
      if (thingBottomSlope > topSlope) {
        continue;
      }

      if (thingTopSlope > topSlope) {
        thingTopSlope = topSlope;
      }
      if (thingBottomSlope < bottomSlope) {
        thingBottomSlope = bottomSlope;
      }

      aimSlope = (thingTopSlope + thingBottomSlope) >> 1;
      break;
    }

    return aimSlope;
  }

  /**
   * True when no solid wall blocks a straight line between two points.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  lineOfSightClear(x1, y1, x2, y2) {
    let blocked = false;
    this.pathTraverse(x1, y1, x2, y2, PT_ADDLINES, (incept) => {
      const li = incept.line;
      if (!li) {
        return true;
      }
      if (!(li.flags & ML_TWOSIDED)) {
        blocked = true;
        return false;
      }
      const opening = lineOpening(li);
      if (opening.openrange <= 0) {
        blocked = true;
        return false;
      }
      return true;
    });
    return !blocked;
  }

  /**
   * @param {{ frac: number, thing: object|null }} incept
   * @param {number} shootZ
   * @param {number} aimslope
   * @param {number} attackrange
   * @param {object|null} shootThing
   * @param {number} damage
   * @param {((thing: object, x: number, y: number, z: number) => void)|null} onThingHit
   * @param {boolean} aimMode
   * @param {((thing: object, dist: number) => void)|null} onAimThing
   */
  shootHitThing(
    incept,
    shootZ,
    aimslope,
    attackrange,
    shootThing,
    damage,
    onThingHit,
    aimMode = false,
    onAimThing = null,
  ) {
    const thing = incept.thing;
    if (!thing || thing === shootThing) {
      return null;
    }
    if (!(thing.flags & MF_SHOOTABLE)) {
      return null;
    }

    const dist = fixedMul(attackrange, incept.frac);
    if (!dist) {
      return null;
    }

    const thingTopSlope = fixedDiv(thing.z + thing.height - shootZ, dist);
    if (thingTopSlope < aimslope) {
      return null;
    }

    const thingBottomSlope = fixedDiv(thing.z - shootZ, dist);
    if (thingBottomSlope > aimslope) {
      return null;
    }

    if (aimMode) {
      if (onAimThing) {
        onAimThing(thing, dist);
      }
      return { aim: true };
    }

    let frac = incept.frac - fixedDiv(10 * FRACUNIT, attackrange);
    const x = this.trace.x + fixedMul(this.trace.dx, frac);
    const y = this.trace.y + fixedMul(this.trace.dy, frac);
    const z = shootZ + fixedMul(aimslope, fixedMul(frac, attackrange));

    if (onThingHit) {
      onThingHit(thing, x, y, z);
    }

    return { hit: true, x, y, z, thing };
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

  /** @param {import('./monster/MissileManager.js').MissileMobj} mo */
  missileZMovement(mo) {
    const subsector = this.level.findSubsector(mo.x, mo.y);
    mo.subsector = subsector;
    mo.floorz = subsector.sector.floorHeight;
    mo.ceilingz = subsector.sector.ceilingHeight;

    mo.z += mo.momz;

    if (mo.z <= mo.floorz) {
      mo.z = mo.floorz;
      if (mo.flags & MF_MISSILE) {
        if (this.onMissileExplode) {
          this.onMissileExplode(mo);
        }
      }
      return;
    }

    if (mo.z + mo.height > mo.ceilingz) {
      mo.z = mo.ceilingz - mo.height;
      if (mo.flags & MF_MISSILE) {
        if (this.onMissileExplode) {
          this.onMissileExplode(mo);
        }
      }
    }
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
