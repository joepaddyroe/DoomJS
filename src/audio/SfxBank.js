import { parseDoomSfx } from '../wad/DoomSfxLoader.js';
import { PRELOAD_SFX, SFX_LUMPS } from './SfxRegistry.js';

/**
 * Loads and caches decoded SFX clips from the WAD (sounds.c / w_wad.c).
 */
export class SfxBank {
  constructor() {
    /** @type {Map<string, import('./SoundDriver.js').SfxClip>} */
    this.clips = new Map();
  }

  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {readonly string[]} [names=PRELOAD_SFX]
   */
  load(wad, names = PRELOAD_SFX) {
    this.clips.clear();

    for (const name of names) {
      const lumpName = SFX_LUMPS[name];
      if (!lumpName) {
        continue;
      }

      const index = wad.indexOf(lumpName);
      if (index < 0) {
        console.warn(`SfxBank: missing lump ${lumpName} for ${name}`);
        continue;
      }

      try {
        this.clips.set(name, parseDoomSfx(wad.readLump(index)));
      } catch (error) {
        console.warn(`SfxBank: failed to parse ${lumpName}`, error);
      }
    }
  }

  /** @param {string} name */
  get(name) {
    return this.clips.get(name) ?? null;
  }
}
