import { WadFile } from './WadFile.js';

/**
 * PLAYPAL, COLORMAP, and flat texture access from a WAD.
 */
export class GameAssets {
  /**
   * @param {WadFile} wad
   */
  constructor(wad) {
    this.wad = wad;

    /** @type {Uint8Array} Full PLAYPAL lump (14 palettes × 768 bytes). */
    this.playpal = wad.readLumpByName('PLAYPAL');
    /** @type {Uint8ClampedArray[]} Indexed RGB palettes for I_SetPalette. */
    this.palettes = GameAssets.parseAllPlaypals(this.playpal);
    /** @type {Uint8ClampedArray} Base palette (index 0). */
    this.palette = this.palettes[0];

    /** @type {Uint8Array} Full COLORMAP lump */
    this.colormaps = wad.readLumpByName('COLORMAP');

    const fStart = wad.requireIndex('F_START');
    const fEnd = wad.requireIndex('F_END');
    this.firstFlat = fStart + 1;
    this.numFlats = fEnd - this.firstFlat;

    /** @type {Map<string, number>} Flat name → flat index */
    this.flatNameToIndex = new Map();
    for (let i = 0; i < this.numFlats; i++) {
      const name = wad.lumps[this.firstFlat + i].name.toUpperCase();
      this.flatNameToIndex.set(name, i);
    }
  }

  /**
   * @param {Uint8Array} data
   * @returns {Uint8ClampedArray[]}
   */
  static parseAllPlaypals(data) {
    const count = (data.length / 768) | 0;
    const palettes = [];
    for (let p = 0; p < count; p++) {
      palettes.push(GameAssets.parsePlaypalSlice(data, p));
    }
    return palettes;
  }

  /**
   * @param {Uint8Array} data
   * @param {number} index
   * @returns {Uint8ClampedArray}
   */
  static parsePlaypalSlice(data, index) {
    const offset = index * 768;
    const rgb = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const base = offset + i * 3;
      rgb[i * 3] = data[base];
      rgb[i * 3 + 1] = data[base + 1];
      rgb[i * 3 + 2] = data[base + 2];
    }
    return rgb;
  }

  /**
   * @param {number} index
   * @returns {Uint8ClampedArray}
   */
  getPalette(index) {
    return this.palettes[index] ?? this.palettes[0];
  }

  /**
   * @param {string} name Eight-char flat name
   * @returns {number}
   */
  flatIndexForName(name) {
    const key = name.toUpperCase().replace(/\0/g, '').trim();
    const index = this.flatNameToIndex.get(key);
    if (index === undefined) {
      throw new Error(`Flat not found: ${name}`);
    }
    return index;
  }

  /**
   * @param {number} flatIndex
   * @returns {Uint8Array}
   */
  getFlat(flatIndex) {
    return this.wad.readLump(this.firstFlat + flatIndex);
  }

  /**
   * @param {number} lightLevel 0–255
   * @returns {Uint8Array}
   */
  colormapForLight(lightLevel) {
    const index = Math.min(31, (lightLevel >> 3) & 31);
    return this.colormaps.subarray(index * 256, (index + 1) * 256);
  }
}
