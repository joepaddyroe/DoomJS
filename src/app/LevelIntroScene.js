import { TICRATE } from '../core/gameConstants.js';
import { SCREENWIDTH } from '../core/renderConstants.js';
import {
  EPISODE_MAP_NODES,
  IntermissionPatches,
  parseEpisodeMap,
} from '../ui/WadUiPatches.js';

const INTRO_DURATION = TICRATE * 4;
const WI_TITLEY = 2;

/**
 * Level intro using vanilla intermission map graphics (wi_stuff.c — ShowNextLoc).
 */
export class LevelIntroScene {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {string} mapName
   */
  constructor(wad, mapName) {
    this.mapName = mapName;
    const parsed = parseEpisodeMap(mapName);
    if (!parsed) {
      throw new Error(`Level intro requires episode map name, got ${mapName}`);
    }

    this.epsd = parsed.epsd;
    this.map = parsed.map;
    this.patches = new IntermissionPatches(wad, this.epsd, this.map);
    this.tics = 0;
    this.done = false;
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tick(input) {
    this.tics++;
    this.patches.tickAnimations(this.tics);

    if (this.tics >= INTRO_DURATION) {
      this.done = true;
    }
    if (input.consumeJustPressed('Enter') || input.consumeJustPressed('Space')) {
      this.done = true;
    }
    return this.done;
  }

  /**
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   */
  draw(renderer) {
    renderer.clear(0x1d);

    const { background, entering, levelName, pointer, animDefs, animFrames, animCounters } = this.patches;
    renderer.drawPatch(0, 0, background.header, background.data);

    for (let i = 0; i < animDefs.length; i++) {
      const frame = animFrames[i][animCounters[i]];
      const anim = animDefs[i];
      renderer.drawPatch(anim.x, anim.y, frame.header, frame.data);
    }

    const pointerOn = (this.tics & 31) < 20;
    if (pointerOn) {
      const node = EPISODE_MAP_NODES[this.epsd]?.[this.map];
      const ptr = pointer[(this.tics >> 3) & 1];
      if (node && ptr) {
        renderer.drawPatch(node.x, node.y, ptr.header, ptr.data);
      }
    }

    let y = WI_TITLEY;
    renderer.drawPatch(
      ((SCREENWIDTH - entering.header.width) / 2) | 0,
      y,
      entering.header,
      entering.data,
    );
    y += ((5 * levelName.header.height) / 4) | 0;
    renderer.drawPatch(
      ((SCREENWIDTH - levelName.header.width) / 2) | 0,
      y,
      levelName.header,
      levelName.data,
    );
  }
}
