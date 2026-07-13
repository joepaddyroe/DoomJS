import { PatchRenderer } from '../render/PatchRenderer.js';
import { SCREENHEIGHT, SCREENWIDTH, SBARHEIGHT } from '../core/renderConstants.js';
import { AM_NOAMMO, NUM_AMMO, WEAPON_INFO } from '../game/weapons/weaponConstants.js';
import { statusBarKeyboxes } from '../game/PlayerCards.js';
import { StatusBarFace } from './StatusBarFace.js';

const ST_Y = SCREENHEIGHT - SBARHEIGHT;
const ST_X = 0;
const ST_WIDTH = SCREENWIDTH;

/** st_stuff.c widget positions (absolute screen coordinates). */
const ST_HEALTHX = 90;
const ST_HEALTHY = 171;
const ST_ARMORX = 221;
const ST_ARMORY = 171;
const ST_AMMOX = 44;
const ST_AMMOY = 171;
const ST_ARMSBGX = 104;
const ST_ARMSBGY = 168;
const ST_ARMSX = 111;
const ST_ARMSY = 172;
const ST_ARMSXSPACE = 12;
const ST_ARMSYSPACE = 10;
const ST_FACESX = 143;
const ST_FACESY = 168;
const ST_FX = 143;
const ST_KEY0X = 239;
const ST_KEY0Y = 171;
const ST_KEY1Y = 181;
const ST_KEY2Y = 191;

const AMMO_POSITIONS = [
  { x: 288, y: 173 },
  { x: 288, y: 179 },
  { x: 288, y: 185 },
  { x: 288, y: 191 },
];

const MAX_AMMO_POSITIONS = [
  { x: 314, y: 173 },
  { x: 314, y: 179 },
  { x: 314, y: 185 },
  { x: 314, y: 191 },
];

const KEY_POSITIONS = [
  { x: ST_KEY0X, y: ST_KEY0Y },
  { x: ST_KEY0X, y: ST_KEY1Y },
  { x: ST_KEY0X, y: ST_KEY2Y },
];

/**
 * @param {number} patchWidth
 */
function statusBarSourceColumn(patchWidth) {
  if (patchWidth <= ST_WIDTH) {
    return 0;
  }
  return (patchWidth - ST_WIDTH) >> 1;
}

/**
 * Status bar HUD (st_stuff.c / st_lib.c).
 */
export class StatusBar {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    this.bar = PatchRenderer.parsePatch(wad.readLumpByName('STBAR'));
    this.faceBack = PatchRenderer.parsePatch(wad.readLumpByName('STFB0'));
    this.armsBg = PatchRenderer.parsePatch(wad.readLumpByName('STARMS'));
    this.percentSign = PatchRenderer.parsePatch(wad.readLumpByName('STTPRCNT'));

    /** @type {Array<{ header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }>} */
    this.tallDigits = [];
    /** @type {Array<{ header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }>} */
    this.shortDigits = [];
    for (let i = 0; i < 10; i++) {
      this.tallDigits.push(PatchRenderer.parsePatch(wad.readLumpByName(`STTNUM${i}`)));
      this.shortDigits.push(PatchRenderer.parsePatch(wad.readLumpByName(`STYSNUM${i}`)));
    }

    /** @type {Array<{ header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }>} */
    this.keys = [];
    for (let i = 0; i < 6; i++) {
      this.keys.push(PatchRenderer.parsePatch(wad.readLumpByName(`STKEYS${i}`)));
    }

    /** @type {Array<[{ header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }, { header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }]>} */
    this.arms = [];
    for (let i = 0; i < 6; i++) {
      this.arms.push([
        PatchRenderer.parsePatch(wad.readLumpByName(`STGNUM${i + 2}`)),
        this.shortDigits[i + 2],
      ]);
    }

    this.face = new StatusBarFace(wad);
  }

  /** @param {import('../game/Player.js').Player} player */
  resetForPlayer(player) {
    this.face.faceCount = 0;
    this.face.oldHealth = player.health;
    this.face.calcHealth = -1;
    this.face.pickStraightFace(player);
  }

  /** @param {import('../game/Player.js').Player} player */
  tick(player) {
    this.face.tick(player);
    if (player.damagecount > 0) {
      player.damagecount--;
    }
    if (player.bonuscount > 0) {
      player.bonuscount--;
    }
  }

  /**
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {import('../game/Player.js').Player} player
   */
  draw(renderer, player) {
    const { header, data } = this.bar;
    renderer.drawPatchSlice(ST_X, ST_Y, header, data, statusBarSourceColumn(header.width), ST_WIDTH);
    renderer.drawPatch(ST_FX, ST_Y, this.faceBack.header, this.faceBack.data);

    this.drawPercent(renderer, ST_HEALTHX, ST_HEALTHY, player.health, 3);
    this.drawPercent(renderer, ST_ARMORX, ST_ARMORY, player.armorpoints, 3);

    const readyAmmo = WEAPON_INFO[player.readyweapon]?.ammo ?? AM_NOAMMO;
    if (readyAmmo !== AM_NOAMMO) {
      this.drawTallNumber(renderer, ST_AMMOX, ST_AMMOY, player.ammo[readyAmmo], 3);
    }

    for (let i = 0; i < NUM_AMMO; i++) {
      this.drawShortNumber(renderer, AMMO_POSITIONS[i].x, AMMO_POSITIONS[i].y, player.ammo[i], 3);
      this.drawShortNumber(
        renderer,
        MAX_AMMO_POSITIONS[i].x,
        MAX_AMMO_POSITIONS[i].y,
        player.maxammo[i],
        3,
      );
    }

    renderer.drawPatch(ST_ARMSBGX, ST_ARMSBGY, this.armsBg.header, this.armsBg.data);
    for (let i = 0; i < 6; i++) {
      const owned = player.weaponowned[i + 2];
      const patch = this.arms[i][owned ? 1 : 0];
      renderer.drawPatch(
        ST_ARMSX + (i % 3) * ST_ARMSXSPACE,
        ST_ARMSY + ((i / 3) | 0) * ST_ARMSYSPACE,
        patch.header,
        patch.data,
      );
    }

    const keyboxes = statusBarKeyboxes(player.cards);
    for (let i = 0; i < 3; i++) {
      const keyIndex = keyboxes[i];
      if (keyIndex >= 0) {
        const keyPatch = this.keys[keyIndex];
        renderer.drawPatch(KEY_POSITIONS[i].x, KEY_POSITIONS[i].y, keyPatch.header, keyPatch.data);
      }
    }

    const face = this.face.currentFace();
    renderer.drawPatch(ST_FACESX, ST_FACESY, face.header, face.data);
  }

  /**
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {number} x
   * @param {number} y
   * @param {number} value
   * @param {number} width
   */
  drawPercent(renderer, x, y, value, width) {
    renderer.drawPatch(x, y, this.percentSign.header, this.percentSign.data);
    this.drawTallNumber(renderer, x, y, value, width);
  }

  /**
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {number} x
   * @param {number} y
   * @param {number} value
   * @param {number} width
   */
  drawTallNumber(renderer, x, y, value, width) {
    this.drawNumber(renderer, x, y, value, width, this.tallDigits);
  }

  /**
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {number} x
   * @param {number} y
   * @param {number} value
   * @param {number} width
   */
  drawShortNumber(renderer, x, y, value, width) {
    this.drawNumber(renderer, x, y, value, width, this.shortDigits);
  }

  /**
   * Right-aligned number widget (st_lib.c — STlib_drawNum).
   * @param {import('./SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {number} x
   * @param {number} y
   * @param {number} value
   * @param {number} width
   * @param {Array<{ header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }>} digits
   */
  drawNumber(renderer, x, y, value, width, digits) {
    let num = Math.max(0, value | 0);
    const digitWidth = digits[0].header.width;
    let drawX = x;

    if (num === 0) {
      renderer.drawPatch(
        drawX - digitWidth,
        y,
        digits[0].header,
        digits[0].data,
      );
      return;
    }

    while (num && width > 0) {
      drawX -= digitWidth;
      const digit = num % 10;
      const patch = digits[digit];
      renderer.drawPatch(drawX, y, patch.header, patch.data);
      num = (num / 10) | 0;
      width--;
    }
  }
}

export { ST_Y };
