import {
  ANG90,
  ANG180,
  ANGLETOFINESHIFT,
  tangentAngleIndex,
  HEIGHTBITS,
  HEIGHTUNIT,
  LIGHTSCALESHIFT,
  LIGHTSEGSHIFT,
  MAXLIGHTSCALE,
  LIGHTLEVELS,
  ML_DONTPEGBOTTOM,
  ML_DONTPEGTOP,
  SIL_BOTH,
  SIL_BOTTOM,
  SIL_NONE,
  SIL_TOP,
} from '../core/angles.js';
import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';
import { fixedMul, int32 } from '../math/fixed.js';
import { pointToDist, scaleFromGlobalAngle } from '../math/viewMath.js';
import { MAX_DRAW_SEGS, MASKED_COL_DONE, SPR_CLIP_BOTTOM_OPEN, SPR_CLIP_TOP_OPEN } from './ClipSegList.js';

/**
 * Wall segment rasterization (r_segs.c).
 */
export class WallDrawer {
  /**
   * @param {import('./RenderContext.js').RenderContext} ctx
   * @param {import('./PlaneDrawer.js').PlaneDrawer} planes
   * @param {import('./BspTraverser.js').BspTraverser} bsp
   */
  constructor(ctx, planes, bsp) {
    this.ctx = ctx;
    this.planes = planes;
    this.bsp = bsp;
  }

  /** @param {number} start @param {number} stop */
  storeWallRange(start, stop) {
    if (this.ctx.drawSegCount >= MAX_DRAW_SEGS) {
      return;
    }

    const seg = this.bsp.curline;
    const sidedef = seg.sidedef;
    const linedef = seg.linedef;
    const frontsector = seg.frontsector;
    const backsector = seg.backsector;

    const rwNormalAngle = (seg.angle + ANG90) >>> 0;
    let offsetAngle = (rwNormalAngle - this.bsp.rwAngle1) >>> 0;
    if (offsetAngle > ANG180) {
      offsetAngle = (-offsetAngle) >>> 0;
    }
    if (offsetAngle > ANG90) {
      offsetAngle = ANG90;
    }

    const distAngle = (ANG90 - offsetAngle) >>> 0;
    const hyp = pointToDist(
      seg.v1.x, seg.v1.y,
      this.ctx.viewX, this.ctx.viewY,
      this.ctx.tables.tantoangle,
      this.ctx.tables.finesine,
    );
    const rwDistance = fixedMul(hyp, this.ctx.tables.finesine[(distAngle >>> 0) >> ANGLETOFINESHIFT]);

    const ds = this.ctx.drawSegs[this.ctx.drawSegCount];
    ds.curline = seg;
    ds.x1 = start;
    ds.x2 = stop;
    ds.maskedtexturecol = null;
    ds.maskedtexture = 0;

    let rwScale = scaleFromGlobalAngle(
      (this.ctx.viewAngle + this.ctx.viewSetup.xToViewAngle[start]) >>> 0,
      this.ctx.viewAngle,
      rwNormalAngle,
      rwDistance,
      this.ctx.viewSetup.projection,
      this.ctx.tables.finesine,
    );
    ds.scale1 = rwScale;

    let rwScaleStep = 0;
    if (stop > start) {
      const scale2 = scaleFromGlobalAngle(
        (this.ctx.viewAngle + this.ctx.viewSetup.xToViewAngle[stop]) >>> 0,
        this.ctx.viewAngle,
        rwNormalAngle,
        rwDistance,
        this.ctx.viewSetup.projection,
        this.ctx.tables.finesine,
      );
      ds.scale2 = scale2;
      rwScaleStep = ((scale2 - rwScale) / (stop - start)) | 0;
      ds.scalestep = rwScaleStep;
    } else {
      ds.scale2 = rwScale;
      ds.scalestep = 0;
    }

    let worldTop = frontsector.ceilingHeight - this.ctx.viewZ;
    const worldBottom = frontsector.floorHeight - this.ctx.viewZ;

    let midTexture = 0;
    let maskedTexture = 0;
    let maskedTextureCol = null;
    let topTexture = 0;
    let bottomTexture = 0;
    let markFloor = false;
    let markCeiling = false;
    let rwMidTextureMid = 0;
    let rwTopTextureMid = 0;
    let rwBottomTextureMid = 0;

    if (!backsector) {
      midTexture = sidedef.midTexture;
      markFloor = true;
      markCeiling = true;
      if (linedef.flags & ML_DONTPEGBOTTOM) {
        rwMidTextureMid = frontsector.floorHeight
          + this.ctx.textures.textureHeight[sidedef.midTexture] - this.ctx.viewZ;
      } else {
        rwMidTextureMid = worldTop;
      }
      rwMidTextureMid += sidedef.rowOffset;
      ds.silhouette = SIL_BOTH;
      ds.sprtopclip = SPR_CLIP_TOP_OPEN;
      ds.sprbottomclip = SPR_CLIP_BOTTOM_OPEN;
      ds.bsilheight = 0x7fffffff;
      ds.tsilheight = -0x80000000;
    } else {
      ds.silhouette = SIL_NONE;
      ds.sprtopclip = null;
      ds.sprbottomclip = null;

      if (frontsector.floorHeight > backsector.floorHeight) {
        ds.silhouette = SIL_BOTTOM;
        ds.bsilheight = frontsector.floorHeight;
      } else if (backsector.floorHeight > this.ctx.viewZ) {
        ds.silhouette = SIL_BOTTOM;
        ds.bsilheight = 0x7fffffff;
      }

      if (frontsector.ceilingHeight < backsector.ceilingHeight) {
        ds.silhouette |= SIL_TOP;
        ds.tsilheight = frontsector.ceilingHeight;
      } else if (backsector.ceilingHeight < this.ctx.viewZ) {
        ds.silhouette |= SIL_TOP;
        ds.tsilheight = -0x80000000;
      }

      if (backsector.ceilingHeight <= frontsector.floorHeight) {
        ds.sprbottomclip = SPR_CLIP_BOTTOM_OPEN;
        ds.bsilheight = 0x7fffffff;
        ds.silhouette |= SIL_BOTTOM;
      }

      if (backsector.floorHeight >= frontsector.ceilingHeight) {
        ds.sprtopclip = SPR_CLIP_TOP_OPEN;
        ds.tsilheight = -0x80000000;
        ds.silhouette |= SIL_TOP;
      }

      let worldHigh = backsector.ceilingHeight - this.ctx.viewZ;
      const worldLow = backsector.floorHeight - this.ctx.viewZ;

      // Outdoor sky hack (r_segs.c) — needed for correct ceiling/floor marks at sky borders.
      if (frontsector.ceilingPic === this.ctx.textures.skyFlatNum
        && backsector.ceilingPic === this.ctx.textures.skyFlatNum) {
        worldTop = worldHigh;
      }

      markFloor = worldLow !== worldBottom
        || backsector.floorPic !== frontsector.floorPic
        || backsector.lightLevel !== frontsector.lightLevel;
      markCeiling = worldHigh !== worldTop
        || backsector.ceilingPic !== frontsector.ceilingPic
        || backsector.lightLevel !== frontsector.lightLevel;

      if (backsector.ceilingHeight <= frontsector.floorHeight
        || backsector.floorHeight >= frontsector.ceilingHeight) {
        markCeiling = true;
        markFloor = true;
      }

      if (worldHigh < worldTop) {
        topTexture = sidedef.topTexture;
        rwTopTextureMid = (linedef.flags & ML_DONTPEGTOP)
          ? worldTop
          : backsector.ceilingHeight + this.ctx.textures.textureHeight[sidedef.topTexture] - this.ctx.viewZ;
        rwTopTextureMid += sidedef.rowOffset;
      }

      if (worldLow > worldBottom) {
        bottomTexture = sidedef.bottomTexture;
        rwBottomTextureMid = (linedef.flags & ML_DONTPEGBOTTOM)
          ? worldTop
          : worldLow;
        rwBottomTextureMid += sidedef.rowOffset;
      }

      if (sidedef.midTexture) {
        maskedTexture = sidedef.midTexture;
        const segWidth = stop - start + 1;
        maskedTextureCol = new Int16Array(segWidth).fill(MASKED_COL_DONE);
        ds.maskedtexturecol = maskedTextureCol;
        ds.maskedtexture = maskedTexture;
      }
    }

    if (frontsector.floorHeight >= this.ctx.viewZ) {
      markFloor = false;
    }
    if (frontsector.ceilingHeight <= this.ctx.viewZ
      && frontsector.ceilingPic !== this.ctx.textures.skyFlatNum) {
      markCeiling = false;
    }

    if (markCeiling && this.planes.ceilingPlane) {
      this.planes.ceilingPlane = this.planes.checkPlane(this.planes.ceilingPlane, start, stop);
    }
    if (markFloor && this.planes.floorPlane) {
      this.planes.floorPlane = this.planes.checkPlane(this.planes.floorPlane, start, stop);
    }

    let rwOffset = 0;
    let rwCenterAngle = 0;
    const segTextured = midTexture || topTexture || bottomTexture || maskedTexture;
    if (segTextured) {
      let texOffsetAngle = (rwNormalAngle - this.bsp.rwAngle1) >>> 0;
      if (texOffsetAngle > ANG180) {
        texOffsetAngle = (-texOffsetAngle) >>> 0;
      }
      if (texOffsetAngle > ANG90) {
        texOffsetAngle = ANG90;
      }

      let rwOffsetSine = this.ctx.tables.finesine[(texOffsetAngle >>> 0) >> ANGLETOFINESHIFT];
      rwOffset = fixedMul(hyp, rwOffsetSine);
      if (((rwNormalAngle - this.bsp.rwAngle1) >>> 0) < ANG180) {
        rwOffset = -rwOffset;
      }
      rwOffset += sidedef.textureOffset + seg.offset;
      rwCenterAngle = (ANG90 + this.ctx.viewAngle - rwNormalAngle) >>> 0;
    }

    let lightNum = (frontsector.lightLevel >> LIGHTSEGSHIFT) + this.ctx.extralight;
    if (seg.v1.y === seg.v2.y) {
      lightNum--;
    } else if (seg.v1.x === seg.v2.x) {
      lightNum++;
    }
    if (lightNum < 0) {
      lightNum = 0;
    } else if (lightNum >= LIGHTLEVELS) {
      lightNum = LIGHTLEVELS - 1;
    }
    const wallLights = this.ctx.viewSetup.scaleLight[lightNum];

    this.renderSegLoop(
      start, stop + 1, rwScale, rwScaleStep,
      worldTop, worldBottom, backsector,
      midTexture, topTexture, bottomTexture, maskedTexture, maskedTextureCol,
      rwMidTextureMid, rwTopTextureMid, rwBottomTextureMid,
      rwCenterAngle, rwDistance, rwOffset, sidedef,
      markFloor, markCeiling, wallLights,
    );

    const segWidth = stop - start + 1;
    const hasMasked = !!ds.maskedtexturecol;

    if (((ds.silhouette & SIL_TOP) || hasMasked) && !ds.sprtopclip) {
      ds.sprtopclip = new Int16Array(segWidth);
      for (let x = start; x <= stop; x++) {
        ds.sprtopclip[x - start] = this.ctx.ceilingClip[x];
      }
    }
    if (((ds.silhouette & SIL_BOTTOM) || hasMasked) && !ds.sprbottomclip) {
      ds.sprbottomclip = new Int16Array(segWidth);
      for (let x = start; x <= stop; x++) {
        ds.sprbottomclip[x - start] = this.ctx.floorClip[x];
      }
    }

    if (hasMasked && !(ds.silhouette & SIL_TOP)) {
      ds.silhouette |= SIL_TOP;
      ds.tsilheight = -0x80000000;
    }
    if (hasMasked && !(ds.silhouette & SIL_BOTTOM)) {
      ds.silhouette |= SIL_BOTTOM;
      ds.bsilheight = 0x7fffffff;
    }

    this.ctx.drawSegCount++;
  }

  /**
   * @param {import('./ClipSegList.js').VisPlane|null} plane
   * @param {number} x
   * @param {number} top
   * @param {number} bottom
   */
  updatePlaneColumn(plane, x, top, bottom) {
    top = Math.max(0, top);
    bottom = Math.min(this.ctx.viewHeight - 1, bottom);
    if (!plane || top > bottom) {
      return;
    }
    plane.top[x] = top;
    plane.bottom[x] = bottom;
    if (x < plane.minx) {
      plane.minx = x;
    }
    if (x > plane.maxx) {
      plane.maxx = x;
    }
  }

  renderSegLoop(
    segStart, rwStopX, rwScale, rwScaleStep,
    worldTop, worldBottom, backsector,
    midTexture, topTexture, bottomTexture, maskedTexture, maskedTextureCol,
    rwMidTextureMid, rwTopTextureMid, rwBottomTextureMid,
    rwCenterAngle, rwDistance, rwOffset, sidedef,
    markFloor, markCeiling, wallLights,
  ) {
    const segTextured = midTexture || topTexture || bottomTexture || maskedTexture;

    let topFrac = (this.ctx.viewSetup.centerYFrac >> 4) - fixedMul(worldTop >> 4, rwScale);
    let topStep = -fixedMul(rwScaleStep, worldTop >> 4);
    let bottomFrac = (this.ctx.viewSetup.centerYFrac >> 4) - fixedMul(worldBottom >> 4, rwScale);
    let bottomStep = -fixedMul(rwScaleStep, worldBottom >> 4);

    let pixHigh = 0;
    let pixHighStep = 0;
    let pixLow = 0;
    let pixLowStep = 0;
    if (backsector) {
      const worldHigh = backsector.ceilingHeight - this.ctx.viewZ;
      const worldLow = backsector.floorHeight - this.ctx.viewZ;
      pixHigh = (this.ctx.viewSetup.centerYFrac >> 4) - fixedMul(worldHigh >> 4, rwScale);
      pixHighStep = -fixedMul(rwScaleStep, worldHigh >> 4);
      pixLow = (this.ctx.viewSetup.centerYFrac >> 4) - fixedMul(worldLow >> 4, rwScale);
      pixLowStep = -fixedMul(rwScaleStep, worldLow >> 4);
    }

    for (let rwX = segStart; rwX < rwStopX; rwX++) {
      let yl = (topFrac + HEIGHTUNIT - 1) >> HEIGHTBITS;

      if (yl < this.ctx.ceilingClip[rwX] + 1) {
        yl = this.ctx.ceilingClip[rwX] + 1;
      }

      if (markCeiling && this.planes.ceilingPlane) {
        let top = this.ctx.ceilingClip[rwX] + 1;
        let bottom = yl - 1;

        if (bottom >= this.ctx.floorClip[rwX]) {
          bottom = this.ctx.floorClip[rwX] - 1;
        }

        top = Math.max(0, top);
        bottom = Math.min(this.ctx.viewHeight - 1, bottom);

        if (top <= bottom) {
          this.planes.ceilingPlane.top[rwX] = top;
          this.planes.ceilingPlane.bottom[rwX] = bottom;
        }
      }

      let yh = bottomFrac >> HEIGHTBITS;

      if (yh >= this.ctx.floorClip[rwX]) {
        yh = this.ctx.floorClip[rwX] - 1;
      }

      if (markFloor && this.planes.floorPlane) {
        let top = yh + 1;
        let bottom = this.ctx.floorClip[rwX] - 1;

        if (top <= this.ctx.ceilingClip[rwX]) {
          top = this.ctx.ceilingClip[rwX] + 1;
        }

        top = Math.max(0, top);
        bottom = Math.min(this.ctx.viewHeight - 1, bottom);

        if (top <= bottom) {
          this.planes.floorPlane.top[rwX] = top;
          this.planes.floorPlane.bottom[rwX] = bottom;
        }
      }

      let textureColumn = 0;
      let colormap = wallLights[0];
      if (segTextured) {
        const angle = tangentAngleIndex(rwCenterAngle + this.ctx.viewSetup.xToViewAngle[rwX]);
        textureColumn = int32(rwOffset - fixedMul(this.ctx.tables.finetangent[angle], rwDistance)) >> FRACBITS;
        const lightIndex = Math.min(MAXLIGHTSCALE - 1, (rwScale >>> 0) >> LIGHTSCALESHIFT);
        colormap = wallLights[lightIndex];
      }

      if (midTexture) {
        if (segTextured) {
          this.ctx.softwareRenderer.drawColumn({
            x: rwX,
            yl,
            yh,
            iscale: (0xFFFFFFFF / (rwScale >>> 0)) | 0,
            textureMid: rwMidTextureMid,
            source: this.ctx.textures.getColumn(midTexture, textureColumn),
            colormap,
          });
        }
        this.ctx.ceilingClip[rwX] = this.ctx.viewHeight;
        this.ctx.floorClip[rwX] = -1;
      } else {
        if (topTexture) {
          let mid = pixHigh >> HEIGHTBITS;
          pixHigh = int32(pixHigh + pixHighStep);
          if (mid >= this.ctx.floorClip[rwX]) {
            mid = this.ctx.floorClip[rwX] - 1;
          }
          if (mid >= yl) {
            if (segTextured) {
              this.ctx.softwareRenderer.drawColumn({
                x: rwX,
                yl,
                yh: mid,
                iscale: (0xFFFFFFFF / (rwScale >>> 0)) | 0,
                textureMid: rwTopTextureMid,
                source: this.ctx.textures.getColumn(topTexture, textureColumn),
                colormap,
              });
            }
            this.ctx.ceilingClip[rwX] = mid;
          } else {
            this.ctx.ceilingClip[rwX] = yl - 1;
          }
        } else if (markCeiling) {
          this.ctx.ceilingClip[rwX] = yl - 1;
        }

        if (bottomTexture) {
          let mid = (pixLow + HEIGHTUNIT - 1) >> HEIGHTBITS;
          pixLow = int32(pixLow + pixLowStep);
          if (mid <= this.ctx.ceilingClip[rwX]) {
            mid = this.ctx.ceilingClip[rwX] + 1;
          }
          if (mid <= yh) {
            if (segTextured) {
              this.ctx.softwareRenderer.drawColumn({
                x: rwX,
                yl: mid,
                yh,
                iscale: (0xFFFFFFFF / (rwScale >>> 0)) | 0,
                textureMid: rwBottomTextureMid,
                source: this.ctx.textures.getColumn(bottomTexture, textureColumn),
                colormap,
              });
            }
            this.ctx.floorClip[rwX] = mid;
          } else {
            this.ctx.floorClip[rwX] = yh + 1;
          }
        } else if (markFloor) {
          this.ctx.floorClip[rwX] = yh + 1;
        }

        if (maskedTexture && maskedTextureCol && segTextured) {
          maskedTextureCol[rwX - segStart] = textureColumn;

          // Same-sector fences skip markFloor/markCeiling; refresh spans for this column only.
          if (!markCeiling) {
            let top = this.ctx.ceilingClip[rwX] + 1;
            let bottom = yl - 1;
            if (bottom >= this.ctx.floorClip[rwX]) {
              bottom = this.ctx.floorClip[rwX] - 1;
            }
            this.updatePlaneColumn(this.planes.ceilingPlane, rwX, top, bottom);
          }

          if (!markFloor) {
            let top = yh + 1;
            let bottom = this.ctx.floorClip[rwX] - 1;
            if (top <= this.ctx.ceilingClip[rwX]) {
              top = this.ctx.ceilingClip[rwX] + 1;
            }
            this.updatePlaneColumn(this.planes.floorPlane, rwX, top, bottom);
          }

          this.ctx.ceilingClip[rwX] = yl - 1;
          this.ctx.floorClip[rwX] = yh + 1;
        }
      }

      rwScale = int32(rwScale + rwScaleStep);
      topFrac = int32(topFrac + topStep);
      bottomFrac = int32(bottomFrac + bottomStep);
    }
  }

  /**
   * Deferred masked mid-texture pass (r_segs.c — R_RenderMaskedSegRange).
   * @param {import('./ClipSegList.js').DrawSeg} ds
   * @param {number} x1
   * @param {number} x2
   */
  renderMaskedSegRange(ds, x1, x2) {
    const seg = ds.curline;
    if (!seg || !ds.maskedtexturecol || !ds.maskedtexture) {
      return;
    }

    const frontsector = seg.frontsector;
    const backsector = seg.backsector;
    const linedef = seg.linedef;
    const sidedef = seg.sidedef;
    const texnum = ds.maskedtexture;

    let lightNum = (frontsector.lightLevel >> LIGHTSEGSHIFT) + this.ctx.extralight;
    if (seg.v1.y === seg.v2.y) {
      lightNum--;
    } else if (seg.v1.x === seg.v2.x) {
      lightNum++;
    }
    if (lightNum < 0) {
      lightNum = 0;
    } else if (lightNum >= LIGHTLEVELS) {
      lightNum = LIGHTLEVELS - 1;
    }
    const wallLights = this.ctx.viewSetup.scaleLight[lightNum];

    const maskedtexturecol = ds.maskedtexturecol;
    let spryscale = int32(ds.scale1 + (x1 - ds.x1) * ds.scalestep);
    const mfloorclip = ds.sprbottomclip;
    const mceilingclip = ds.sprtopclip;

    let dcTextureMid;
    if (linedef.flags & ML_DONTPEGBOTTOM) {
      const floor = frontsector.floorHeight > backsector.floorHeight
        ? frontsector.floorHeight
        : backsector.floorHeight;
      dcTextureMid = floor + this.ctx.textures.textureHeight[texnum] - this.ctx.viewZ;
    } else {
      const ceil = frontsector.ceilingHeight < backsector.ceilingHeight
        ? frontsector.ceilingHeight
        : backsector.ceilingHeight;
      dcTextureMid = ceil - this.ctx.viewZ;
    }
    dcTextureMid += sidedef.rowOffset;

    for (let dcX = x1; dcX <= x2; dcX++) {
      const colIdx = dcX - ds.x1;
      if (maskedtexturecol[colIdx] !== MASKED_COL_DONE) {
        const lightIndex = Math.min(MAXLIGHTSCALE - 1, (spryscale >>> 0) >> LIGHTSCALESHIFT);
        const colormap = wallLights[lightIndex];

        let floorClip = this.ctx.viewHeight;
        let ceilingClip = -1;
        if (mfloorclip === SPR_CLIP_BOTTOM_OPEN) {
          floorClip = this.ctx.viewHeight;
        } else if (mfloorclip) {
          floorClip = mfloorclip[colIdx];
        }
        if (mceilingclip === SPR_CLIP_TOP_OPEN) {
          ceilingClip = -1;
        } else if (mceilingclip) {
          ceilingClip = mceilingclip[colIdx];
        }

        const maskedColumn = this.ctx.textures.getMaskedPatchColumn(
          texnum,
          maskedtexturecol[colIdx],
        );

        this.ctx.softwareRenderer.drawMaskedColumn({
          x: dcX,
          textureMid: dcTextureMid,
          spryscale,
          colormap,
          centerYFrac: this.ctx.viewSetup.centerYFrac,
          floorClip,
          ceilingClip,
          ...maskedColumn,
        });
        maskedtexturecol[colIdx] = MASKED_COL_DONE;
      }
      spryscale = int32(spryscale + ds.scalestep);
    }
  }

  /** Draw all deferred masked mid-textures after sprites (r_things.c — R_DrawMasked). */
  renderAllMaskedSegs() {
    // Back-to-front (far segs first) so nearer masked fences draw over farther ones.
    for (let i = this.ctx.drawSegCount - 1; i >= 0; i--) {
      const ds = this.ctx.drawSegs[i];
      if (ds.maskedtexturecol) {
        this.renderMaskedSegRange(ds, ds.x1, ds.x2);
      }
    }
  }

}
