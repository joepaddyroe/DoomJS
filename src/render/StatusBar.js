import { PatchRenderer } from '../render/PatchRenderer.js';
import { SCREENHEIGHT } from '../core/renderConstants.js';
import { NUM_AMMO } from '../game/weapons/weaponConstants.js';

const ST_HEIGHT = 32;
const ST_Y = SCREENHEIGHT - ST_HEIGHT;

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
    renderer.drawPatch(0, ST_Y, this.bar.header, this.bar.data);

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
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {number} x
   * @param {number} y
   * @param {number} value
   * @param {number} width
   */
  drawNumber(renderer, x, y, value, width) {
    let num = Math.max(0, value | 0);
    const digitWidth = this.digits[0].header.width;

    for (let place = 0; place < width; place++) {
      const digit = num % 10;
      num = (num / 10) | 0;
      const patch = this.digits[digit];
      const drawX = x - (place + 1) * digitWidth;
      renderer.drawPatch(drawX, y, patch.header, patch.data);
    }
  }
}
