import { MenuPatches, drawFullScreenPatch } from '../ui/WadUiPatches.js';

/** @typedef {1 | 2 | 3 | 4} GameSkill */

const MENU_X = 48;
const MENU_Y = 63;
const LINE_HEIGHT = 16;
const SKULL_X_OFF = -32;
const SKULL_Y_OFF = -5;

/**
 * Skill selection screen (m_menu.c — NewDef + M_DrawNewGame).
 */
export class SkillMenuScene {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    /** @type {GameSkill} */
    this.selected = 3;
    this.tics = 0;
    this.whichSkull = 0;
    this.skullAnimCounter = 8;
    this.patches = new MenuPatches(wad);
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tick(input) {
    this.tics++;

    if (--this.skullAnimCounter <= 0) {
      this.whichSkull ^= 1;
      this.skullAnimCounter = 8;
    }

    if (input.consumeJustPressed('Digit1')) {
      this.selected = 1;
    } else if (input.consumeJustPressed('Digit2')) {
      this.selected = 2;
    } else if (input.consumeJustPressed('Digit3')) {
      this.selected = 3;
    } else if (input.consumeJustPressed('Digit4')) {
      this.selected = 4;
    }

    if (input.consumeJustPressed('ArrowUp')) {
      this.selected = Math.max(1, this.selected - 1);
    }
    if (input.consumeJustPressed('ArrowDown')) {
      this.selected = Math.min(4, this.selected + 1);
    }

    return input.consumeJustPressed('Enter') || input.consumeJustPressed('Space');
  }

  /**
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   */
  draw(renderer) {
    drawFullScreenPatch(renderer, this.patches.titlePic);

    const { newGame, chooseSkill, skills, skulls } = this.patches;
    renderer.drawPatch(96, 14, newGame.header, newGame.data);
    renderer.drawPatch(54, 38, chooseSkill.header, chooseSkill.data);

    for (let i = 0; i < skills.length; i++) {
      renderer.drawPatch(
        MENU_X,
        MENU_Y + i * LINE_HEIGHT,
        skills[i].header,
        skills[i].data,
      );
    }

    const skull = skulls[this.whichSkull];
    renderer.drawPatch(
      MENU_X + SKULL_X_OFF,
      MENU_Y + SKULL_Y_OFF + (this.selected - 1) * LINE_HEIGHT,
      skull.header,
      skull.data,
    );
  }
}
