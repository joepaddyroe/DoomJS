import { PatchRenderer } from '../render/PatchRenderer.js';
import { SCREENHEIGHT, SCREENWIDTH, SBARHEIGHT, VIEWHEIGHT } from '../core/renderConstants.js';
import { NUM_AMMO } from '../game/weapons/weaponConstants.js';

const ST_Y = SCREENHEIGHT - SBARHEIGHT;

/** Right-side ammo counters (st_stuff.c). */
const AMMO_POSITIONS = [
  { x: 288, y: 173 },
  { x: 288, y: 179 },
  { x: 288, y: 185 },
  { x: 288, y: 191 },
];

/**
 * Status bar HUD (st_stuff.c / st_lib.c).
 */
export class StatusBar {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    this.bar = PatchRenderer.parsePatch(wad.readLumpByName('STBAR'));
    /** @type {Array<{ header: import('../render/PatchRenderer.js').PatchHeader, data: Uint8Array }>} */
    this.digits = [];
    for (let i = 0; i < 10; i++) {
      this.digits.push(PatchRenderer.parsePatch(wad.readLumpByName(`STYSNUM${i}`)));
    }
  }

  /**
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {import('../game/Player.js').Player} player
   */
  draw(renderer, player) {
    const { header, data } = this.bar;
    const barX = header.width > SCREENWIDTH ? -(SCREENWIDTH >> 1) : 0;
    renderer.drawPatch(barX, ST_Y, header, data);

    for (let ammoType = 0; ammoType < NUM_AMMO; ammoType++) {
      this.drawNumber(
        renderer,
        AMMO_POSITIONS[ammoType].x,
        AMMO_POSITIONS[ammoType].y,
        player.ammo[ammoType],
        3,
      );
    }
  }

  /**
   * Right-aligned number widget (st_lib.c — STlib_drawNum).
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {number} x
   * @param {number} y
   * @param {number} value
   * @param {number} width
   */
  drawNumber(renderer, x, y, value, width) {
    let num = Math.max(0, value | 0);
    const digitWidth = this.digits[0].header.width;
    let drawX = x;

    if (num === 0) {
      renderer.drawPatch(
        drawX - digitWidth,
        y,
        this.digits[0].header,
        this.digits[0].data,
      );
      return;
    }

    while (num && width > 0) {
      drawX -= digitWidth;
      const digit = num % 10;
      const patch = this.digits[digit];
      renderer.drawPatch(drawX, y, patch.header, patch.data);
      num = (num / 10) | 0;
      width--;
    }
  }
}

export { VIEWHEIGHT, ST_Y };
