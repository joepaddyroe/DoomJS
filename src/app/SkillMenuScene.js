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
   * @param {import('../audio/SoundSystem.js').SoundSystem|null} [sound]
   */
  constructor(wad, sound = null) {
    /** @type {GameSkill} */
    this.selected = 3;
    this.tics = 0;
    this.whichSkull = 0;
    this.skullAnimCounter = 8;
    this.patches = new MenuPatches(wad);
    this.sound = sound;
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tick(input) {
    this.tics++;

    if (--this.skullAnimCounter <= 0) {
      this.whichSkull ^= 1;
      this.skullAnimCounter = 8;
    }

    if (input.consumeJustPressed('Digit1')) {
      this.selectSkill(1);
    } else if (input.consumeJustPressed('Digit2')) {
      this.selectSkill(2);
    } else if (input.consumeJustPressed('Digit3')) {
      this.selectSkill(3);
    } else if (input.consumeJustPressed('Digit4')) {
      this.selectSkill(4);
    }

    if (input.consumeJustPressed('ArrowUp')) {
      this.moveSelection(-1);
    }
    if (input.consumeJustPressed('ArrowDown')) {
      this.moveSelection(1);
    }

    if (input.consumeJustPressed('Enter') || input.consumeJustPressed('Space')) {
      this.sound?.start('pistol');
      return true;
    }

    return false;
  }

  /** @param {GameSkill} skill */
  selectSkill(skill) {
    if (this.selected !== skill) {
      this.selected = skill;
    }
    this.sound?.start('pstop');
  }

  /** @param {number} delta */
  moveSelection(delta) {
    this.selected = Math.max(1, Math.min(4, this.selected + delta));
    this.sound?.start('pstop');
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
