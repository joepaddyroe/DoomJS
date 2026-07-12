import { SCREENWIDTH } from '../core/renderConstants.js';

/** Wall column clip list (r_bsp.c — solidsegs). */
export class ClipSegList {
  constructor(viewWidth) {
    this.viewWidth = viewWidth;
    this.segments = [
      { first: -0x7fffffff, last: -1 },
      { first: viewWidth, last: 0x7fffffff },
    ];
  }

  clear() {
    this.segments.length = 2;
    this.segments[0] = { first: -0x7fffffff, last: -1 };
    this.segments[1] = { first: this.viewWidth, last: 0x7fffffff };
  }

  /**
   * @param {number} first
   * @param {number} last
   * @param {(start: number, stop: number) => void} onVisible
   */
  clipSolid(first, last, onVisible) {
    let startIndex = 0;
    while (startIndex < this.segments.length && this.segments[startIndex].last < first - 1) {
      startIndex++;
    }

    if (first < this.segments[startIndex].first) {
      if (last < this.segments[startIndex].first - 1) {
        onVisible(first, last);
        this.insertSegment(startIndex, first, last);
        return;
      }
      onVisible(first, this.segments[startIndex].first - 1);
      this.segments[startIndex].first = first;
    }

    if (last <= this.segments[startIndex].last) {
      return;
    }

    let next = startIndex;
    while (next + 1 < this.segments.length && last >= this.segments[next + 1].first - 1) {
      onVisible(this.segments[next].last + 1, this.segments[next + 1].first - 1);
      next++;
      if (last <= this.segments[next].last) {
        this.segments[startIndex].last = this.segments[next].last;
        this.removeRange(startIndex + 1, next);
        return;
      }
    }

    onVisible(this.segments[next].last + 1, last);
    this.segments[startIndex].last = last;
    if (next > startIndex) {
      this.removeRange(startIndex + 1, next);
    }
  }

  /**
   * @param {number} first
   * @param {number} last
   * @param {(start: number, stop: number) => void} onVisible
   */
  clipPass(first, last, onVisible) {
    let startIndex = 0;
    while (startIndex < this.segments.length && this.segments[startIndex].last < first - 1) {
      startIndex++;
    }

    if (first < this.segments[startIndex].first) {
      if (last < this.segments[startIndex].first - 1) {
        onVisible(first, last);
        return;
      }
      onVisible(first, this.segments[startIndex].first - 1);
    }

    if (last <= this.segments[startIndex].last) {
      return;
    }

    let next = startIndex;
    while (next + 1 < this.segments.length && last >= this.segments[next + 1].first - 1) {
      onVisible(this.segments[next].last + 1, this.segments[next + 1].first - 1);
      next++;
      if (last <= this.segments[next].last) {
        return;
      }
    }

    onVisible(this.segments[next].last + 1, last);
  }

  /**
   * @param {number} sx1
   * @param {number} sx2
   * @returns {boolean}
   */
  hasOpening(sx1, sx2) {
    let start = 0;
    while (start < this.segments.length && this.segments[start].last < sx2) {
      start++;
    }
    return !(sx1 >= this.segments[start].first && sx2 <= this.segments[start].last);
  }

  /** @param {number} index @param {number} first @param {number} last */
  insertSegment(index, first, last) {
    this.segments.splice(index, 0, { first, last });
  }

  /** @param {number} from @param {number} to */
  removeRange(from, to) {
    this.segments.splice(from, to - from + 1);
  }
}

export const MAX_DRAW_SEGS = 256;

/** Unmarked visplane top scanline (r_plane.c — 0xff sentinel). */
export const VIS_PLANE_TOP_OPEN = 0xff;

/** @returns {import('./WallDrawer.js').DrawSeg} */
export function createDrawSeg() {
  return {
    curline: null,
    x1: 0,
    x2: 0,
    scale1: 0,
    scale2: 0,
    scalestep: 0,
    silhouette: 0,
    bsilheight: 0,
    tsilheight: 0,
  };
}

export const MAX_VIS_PLANES = 128;

/** @returns {import('./PlaneDrawer.js').VisPlane} */
export function createVisPlane() {
  return {
    height: 0,
    picnum: 0,
    lightlevel: 0,
    minx: SCREENWIDTH,
    maxx: -1,
    top: new Int16Array(SCREENWIDTH).fill(VIS_PLANE_TOP_OPEN),
    bottom: new Int16Array(SCREENWIDTH).fill(0),
  };
}
