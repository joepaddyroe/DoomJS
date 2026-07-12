import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';

/**
 * Wall/flat texture data from WAD (r_data.c).
 */
export class TextureManager {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    this.wad = wad;

    const fStart = wad.requireIndex('F_START');
    const fEnd = wad.requireIndex('F_END');
    this.firstFlat = fStart + 1;
    this.numFlats = fEnd - this.firstFlat;

    this.flatNameToIndex = new Map();
    for (let i = 0; i < this.numFlats; i++) {
      this.flatNameToIndex.set(wad.lumps[this.firstFlat + i].name.toUpperCase(), i);
    }

    this.skyFlatNum = this.flatIndexForName('F_SKY1');
    this.textures = [];
    this.textureNameToIndex = new Map();
    this.textureWidthMask = [];
    this.textureHeight = [];
    this.columnLump = [];
    this.columnOffset = [];
    this.composites = [];

    this.initTextures();
    this.skyTexture = this.textureIndexForName('SKY1');
  }

  initTextures() {
    const pnames = this.wad.readLumpByName('PNAMES');
    const pview = new DataView(pnames.buffer, pnames.byteOffset, pnames.byteLength);
    const patchCount = pview.getInt32(0, true);
    const patchLookup = new Int32Array(patchCount);
    for (let i = 0; i < patchCount; i++) {
      const name = this.readName(pnames, 4 + i * 8);
      patchLookup[i] = this.wad.indexOf(name);
    }

    const mapParts = [];
    for (const lumpName of ['TEXTURE1', 'TEXTURE2']) {
      const index = this.wad.indexOf(lumpName);
      if (index >= 0) {
        mapParts.push(this.wad.readLump(index));
      }
    }

    for (const mapTex of mapParts) {
      const view = new DataView(mapTex.buffer, mapTex.byteOffset, mapTex.byteLength);
      const count = view.getInt32(0, true);
      for (let i = 0; i < count; i++) {
        const offset = view.getInt32(4 + i * 4, true);
        this.parseTexture(mapTex, offset, patchLookup);
      }
    }
  }

  /**
   * @param {Uint8Array} mapTex
   * @param {number} offset
   * @param {Int32Array} patchLookup
   */
  parseTexture(mapTex, offset, patchLookup) {
    const view = new DataView(mapTex.buffer, mapTex.byteOffset + offset, mapTex.byteLength - offset);
    const name = this.readName(mapTex, offset);
    const width = view.getInt16(12, true);
    const height = view.getInt16(14, true);
    const patchCount = view.getInt16(20, true);

    const patches = [];
    for (let j = 0; j < patchCount; j++) {
      const patchOffset = 22 + j * 10;
      patches.push({
        originX: view.getInt16(patchOffset, true),
        originY: view.getInt16(patchOffset + 2, true),
        patch: patchLookup[view.getInt16(patchOffset + 4, true)],
      });
    }

    const texIndex = this.textures.length;
    this.textures.push({ name, width, height, patches });
    this.textureNameToIndex.set(name.toUpperCase(), texIndex);

    let mask = 1;
    while (mask * 2 <= width) {
      mask <<= 1;
    }
    this.textureWidthMask[texIndex] = mask - 1;
    this.textureHeight[texIndex] = height * FRACUNIT;

    this.buildColumnLookup(texIndex);
  }

  /** @param {number} texIndex */
  buildColumnLookup(texIndex) {
    const texture = this.textures[texIndex];
    const lumps = new Int32Array(texture.width).fill(-1);
    const offsets = new Int32Array(texture.width).fill(0);
    const counts = new Int8Array(texture.width).fill(0);

    for (const patch of texture.patches) {
      const patchData = this.wad.readLump(patch.patch);
      const patchWidth = new DataView(patchData.buffer, patchData.byteOffset, patchData.byteLength)
        .getInt16(0, true);
      const x1 = patch.originX;
      const x2 = x1 + patchWidth;

      for (let x = Math.max(0, x1); x < Math.min(texture.width, x2); x++) {
        counts[x]++;
        if (counts[x] === 1) {
          lumps[x] = patch.patch;
          offsets[x] = this.patchColumnOffset(patchData, x - x1);
        } else {
          lumps[x] = -1;
        }
      }
    }

    this.columnLump[texIndex] = lumps;
    this.columnOffset[texIndex] = offsets;
    this.composites[texIndex] = null;
  }

  /**
   * @param {Uint8Array} patchData
   * @param {number} column
   * @returns {number}
   */
  patchColumnOffset(patchData, column) {
    const view = new DataView(patchData.buffer, patchData.byteOffset, patchData.byteLength);
    return view.getInt32(8 + column * 4, true);
  }

  /**
   * @param {Uint8Array} data
   * @param {number} offset
   * @returns {string}
   */
  readName(data, offset) {
    let name = '';
    for (let i = 0; i < 8; i++) {
      const c = data[offset + i];
      if (c === 0) {
        break;
      }
      name += String.fromCharCode(c);
    }
    return name;
  }

  /**
   * @param {string} name
   * @returns {number}
   */
  flatIndexForName(name) {
    const key = name.toUpperCase().replace(/\0/g, '').trim();
    if (!key) {
      return 0;
    }
    const index = this.flatNameToIndex.get(key);
    if (index === undefined) {
      throw new Error(`Flat not found: ${name}`);
    }
    return index;
  }

  /**
   * @param {string} name
   * @returns {number}
   */
  textureIndexForName(name) {
    const key = name.toUpperCase().replace(/\0/g, '').trim();
    if (!key || key === '-') {
      return 0;
    }
    const index = this.textureNameToIndex.get(key);
    if (index === undefined) {
      return 0;
    }
    return index;
  }

  /**
   * @param {number} flatIndex
   * @returns {Uint8Array|null}
   */
  getFlat(flatIndex) {
    if (flatIndex < 0 || flatIndex >= this.numFlats) {
      return null;
    }
    return this.wad.readLump(this.firstFlat + flatIndex);
  }

  /**
   * @param {number} texIndex
   * @param {number} column
   * @returns {Uint8Array}
   */
  getColumn(texIndex, column) {
    if (texIndex <= 0) {
      return new Uint8Array(128);
    }

    const maskedCol = (column | 0) & this.textureWidthMask[texIndex];
    const lump = this.columnLump[texIndex][maskedCol];
    const offset = this.columnOffset[texIndex][maskedCol];

    if (lump >= 0) {
      const patch = this.wad.readLump(lump);
      return this.extractPatchColumn(patch, offset, this.textures[texIndex].height);
    }

    return this.getCompositeColumn(texIndex, maskedCol);
  }

  /**
   * Raw patch column for masked mid-textures (r_segs.c — R_GetColumn, column_t at -3).
   * @param {number} texIndex
   * @param {number} column
   * @returns {{ patchData: Uint8Array, columnOffset: number, originY: number } | { flatColumn: Uint8Array }}
   */
  getMaskedPatchColumn(texIndex, column) {
    if (texIndex <= 0) {
      return { flatColumn: new Uint8Array(128) };
    }

    const maskedCol = (column | 0) & this.textureWidthMask[texIndex];
    const lump = this.columnLump[texIndex][maskedCol];
    const offset = this.columnOffset[texIndex][maskedCol];

    if (lump >= 0) {
      const texture = this.textures[texIndex];
      let originY = 0;
      for (const patch of texture.patches) {
        const patchData = this.wad.readLump(patch.patch);
        const patchWidth = new DataView(patchData.buffer, patchData.byteOffset, patchData.byteLength)
          .getInt16(0, true);
        if (maskedCol >= patch.originX && maskedCol < patch.originX + patchWidth) {
          originY = patch.originY;
          break;
        }
      }
      return {
        patchData: this.wad.readLump(lump),
        columnOffset: offset,
        originY,
      };
    }

    return { flatColumn: this.getCompositeColumn(texIndex, maskedCol) };
  }

  /**
   * @param {Uint8Array} patch
   * @param {number} columnOffset
   * @returns {Uint8Array}
   */
  extractPatchColumn(patch, columnOffset, height) {
    const cache = new Uint8Array(height);
    let pos = columnOffset;
    let topDelta = patch[pos];

    while (topDelta !== 0xff) {
      const length = patch[pos + 1];
      const pixelStart = pos + 3;
      for (let i = 0; i < length; i++) {
        const row = topDelta + i;
        if (row >= 0 && row < cache.length) {
          cache[row] = patch[pixelStart + i];
        }
      }
      pos += length + 4;
      topDelta = patch[pos];
    }

    return cache;
  }

  /**
   * @param {number} texIndex
   * @param {number} column
   * @returns {Uint8Array}
   */
  getCompositeColumn(texIndex, column) {
    if (!this.composites[texIndex]) {
      this.composites[texIndex] = this.buildComposite(texIndex);
    }
    return this.composites[texIndex].columns[column];
  }

  /** @param {number} texIndex */
  buildComposite(texIndex) {
    const texture = this.textures[texIndex];
    const columns = new Array(texture.width);

    for (let x = 0; x < texture.width; x++) {
      const column = new Uint8Array(texture.height);
      for (const patch of texture.patches) {
        const patchData = this.wad.readLump(patch.patch);
        const patchWidth = new DataView(patchData.buffer, patchData.byteOffset, patchData.byteLength)
          .getInt16(0, true);
        const localX = x - patch.originX;
        if (localX < 0 || localX >= patchWidth) {
          continue;
        }
        this.blitPatchColumn(patchData, localX, column, patch.originY);
      }
      columns[x] = column;
    }

    return { columns };
  }

  /**
   * @param {Uint8Array} patch
   * @param {number} localX
   * @param {Uint8Array} dest
   * @param {number} originY
   */
  blitPatchColumn(patch, localX, dest, originY) {
    const offset = this.patchColumnOffset(patch, localX);
    let pos = offset;
    let topDelta = patch[pos];

    while (topDelta !== 0xff) {
      const length = patch[pos + 1];
      const pixelStart = pos + 3;
      for (let i = 0; i < length; i++) {
        const row = originY + topDelta + i;
        if (row >= 0 && row < dest.length) {
          dest[row] = patch[pixelStart + i];
        }
      }
      pos += length + 4;
      topDelta = patch[pos];
    }
  }
}
