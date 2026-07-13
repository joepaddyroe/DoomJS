import { TextRenderer } from '../render/TextRenderer.js';
import { DeathScreenPatches, drawSaveLoadBorder } from '../ui/WadUiPatches.js';

/** Border x for a 208px-wide M_DrawSaveLoadBorder centered on 320. */
const MESSAGE_BORDER_X = 56;
const MESSAGE_BORDER_Y = 82;

/**
 * Game-over screen — frozen death view with vanilla message border.
 */
export class GameOverScene {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {Uint8Array} backgroundPixels Snapshot of the screen at death
   */
  constructor(wad, backgroundPixels) {
    this.backgroundPixels = backgroundPixels;
    this.patches = new DeathScreenPatches(wad);
    this.flashTics = 0;
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tick(input) {
    this.flashTics++;
    return input.consumeJustPressed('Enter')
      || input.consumeJustPressed('Space')
      || input.consumeJustPressed('KeyR');
  }

  /**
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   */
  draw(renderer) {
    renderer.pixels.set(this.backgroundPixels);

    drawSaveLoadBorder(renderer, MESSAGE_BORDER_X, MESSAGE_BORDER_Y, this.patches);

    const flash = ((this.flashTics / 10) | 0) % 2 === 0;
    TextRenderer.drawCentered(renderer.pixels, 'YOU DIED', 96, flash ? 0x25 : 0x50, 1);
    TextRenderer.drawCentered(renderer.pixels, 'PRESS ENTER TO TRY AGAIN', 112, 0x8a, 1);
  }
}
