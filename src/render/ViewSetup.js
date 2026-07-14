import { SCREENWIDTH } from '../core/renderConstants.js';
import {
  FINEANGLES,
  FIELDOFVIEW,
  LIGHTLEVELS,
  LIGHTSCALESHIFT,
  LIGHTZSHIFT,
  MAXLIGHTSCALE,
  MAXLIGHTZ,
  NUMCOLORMAPS,
  ANGLETOFINESHIFT,
  ANG90,
  fineAngleIndex,
} from '../core/angles.js';
import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { fixedDiv, fixedDiv2, fixedMul } from '../math/fixed.js';

/**
 * View-angle mapping and light tables (r_main.c).
 */
export class ViewSetup {
  /**
   * @param {import('../math/tables.js').createTrigTables extends Function ? ReturnType<createTrigTables> : any} tables
   * @param {Uint8Array} colormaps
   * @param {number} viewWidth
   * @param {number} viewHeight
   */
  constructor(tables, colormaps, viewWidth, viewHeight, detailShift = 0) {
    this.tables = tables;
    this.colormaps = colormaps;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.detailShift = detailShift;
    this.scaledViewWidth = viewWidth << detailShift;
    this.centerX = viewWidth >> 1;
    this.centerY = viewHeight >> 1;
    this.centerXFrac = this.centerX << FRACBITS;
    this.centerYFrac = this.centerY << FRACBITS;
    this.projection = this.centerXFrac;

    this.viewAngleToX = new Int32Array(FINEANGLES / 2);
    this.xToViewAngle = new Uint32Array(viewWidth + 1);
    this.ySlope = new Int32Array(viewHeight);
    this.distScale = new Int32Array(viewWidth);
    this.scaleLight = Array.from({ length: LIGHTLEVELS }, () => new Array(MAXLIGHTSCALE));
    this.zLight = Array.from({ length: LIGHTLEVELS }, () => new Array(MAXLIGHTZ));
    this.clipAngle = 0;

    this.buildAngleTables();
    this.buildSlopeTables();
    this.buildLightTables();
  }

  buildAngleTables() {
    const { finetangent } = this.tables;
    const focalLength = fixedDiv2(
      this.centerXFrac,
      finetangent[(FINEANGLES / 4 + FIELDOFVIEW / 2) | 0],
    );

    for (let i = 0; i < FINEANGLES / 2; i++) {
      if (finetangent[i] > FRACUNIT * 2) {
        this.viewAngleToX[i] = -1;
      } else if (finetangent[i] < -FRACUNIT * 2) {
        this.viewAngleToX[i] = this.viewWidth + 1;
      } else {
        let t = fixedMul(finetangent[i], focalLength);
        t = (this.centerXFrac - t + FRACUNIT - 1) >> FRACBITS;
        if (t < -1) {
          t = -1;
        } else if (t > this.viewWidth + 1) {
          t = this.viewWidth + 1;
        }
        this.viewAngleToX[i] = t;
      }
    }

    for (let x = 0; x <= this.viewWidth; x++) {
      let i = 0;
      while (this.viewAngleToX[i] > x) {
        i++;
      }
      this.xToViewAngle[x] = ((i << ANGLETOFINESHIFT) - ANG90) >>> 0;
    }

    for (let i = 0; i < FINEANGLES / 2; i++) {
      if (this.viewAngleToX[i] === -1) {
        this.viewAngleToX[i] = 0;
      } else if (this.viewAngleToX[i] === this.viewWidth + 1) {
        this.viewAngleToX[i] = this.viewWidth;
      }
    }

    this.clipAngle = this.xToViewAngle[0];
  }

  buildSlopeTables() {
    const halfWidth = (this.viewWidth << this.detailShift) / 2;
    for (let i = 0; i < this.viewHeight; i++) {
      let dy = ((i - (this.viewHeight / 2)) << FRACBITS) + FRACUNIT / 2;
      dy = Math.abs(dy);
      this.ySlope[i] = fixedDiv2(halfWidth * FRACUNIT, dy || 1);
    }

    for (let i = 0; i < this.viewWidth; i++) {
      const cosAdj = Math.abs(this.tables.finecosine[fineAngleIndex(this.xToViewAngle[i])]);
      this.distScale[i] = fixedDiv2(FRACUNIT, cosAdj || 1);
    }
  }

  buildLightTables() {
    const distMap = 2;
    for (let i = 0; i < LIGHTLEVELS; i++) {
      const startMap = ((LIGHTLEVELS - 1 - i) * 2 * NUMCOLORMAPS) / LIGHTLEVELS | 0;
      for (let j = 0; j < MAXLIGHTZ; j++) {
        let scale = fixedDiv((SCREENWIDTH / 2) * FRACUNIT, (j + 1) << LIGHTZSHIFT);
        scale >>= LIGHTSCALESHIFT;
        let level = (startMap - (scale / distMap | 0)) | 0;
        if (level < 0) {
          level = 0;
        }
        if (level >= NUMCOLORMAPS) {
          level = NUMCOLORMAPS - 1;
        }
        this.zLight[i][j] = this.colormaps.subarray(level * 256, (level + 1) * 256);
      }

      for (let j = 0; j < MAXLIGHTSCALE; j++) {
        let level = (startMap - ((j * SCREENWIDTH / this.scaledViewWidth | 0) / distMap | 0)) | 0;
        if (level < 0) {
          level = 0;
        }
        if (level >= NUMCOLORMAPS) {
          level = NUMCOLORMAPS - 1;
        }
        this.scaleLight[i][j] = this.colormaps.subarray(level * 256, (level + 1) * 256);
      }
    }
  }
}
