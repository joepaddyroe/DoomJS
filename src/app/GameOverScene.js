import { TextRenderer } from '../render/TextRenderer.js';

/**
 * Game-over screen after player death.
 */
export class GameOverScene {
  constructor() {
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
    const pixels = renderer.pixels;
    pixels.fill(0x70);

    const flash = ((this.flashTics / 10) | 0) % 2 === 0;
    TextRenderer.drawCentered(pixels, 'YOU DIED', 72, flash ? 0x25 : 0x50, 2);
    TextRenderer.drawCentered(pixels, 'PRESS ENTER TO TRY AGAIN', 132, 0x8a, 1);
  }
}
