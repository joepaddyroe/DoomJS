import { drawFullScreenPatch } from '../ui/WadUiPatches.js';
import { MenuPatches } from '../ui/WadUiPatches.js';

/**
 * Title screen (d_main.c — D_StartTitle / TITLEPIC).
 * Any key opens the main menu.
 */
export class TitleScene {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {import('../ui/MenuController.js').MenuController} menu
   */
  constructor(wad, menu) {
    this.patches = new MenuPatches(wad);
    this.menu = menu;
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input @returns {boolean} true if menu opened */
  tick(input) {
    if (this.menu.active) {
      return false;
    }

    if (input.consumeAnyKey()) {
      this.menu.open();
      this.menu.sound?.start('swtchn');
      return true;
    }
    return false;
  }

  /**
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   */
  draw(renderer) {
    renderer.clear(0);
    drawFullScreenPatch(renderer, this.patches.titlePic);
    this.menu.draw(renderer);
  }
}
