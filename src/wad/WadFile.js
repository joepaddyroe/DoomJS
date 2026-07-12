/**
 * WAD archive reader (w_wad.c).
 */
export class WadFile {
  /**
   * @param {ArrayBuffer} buffer
   */
  constructor(buffer) {
    /** @type {DataView} */
    this.view = new DataView(buffer);
    this.data = new Uint8Array(buffer);

    const id = this.readAscii(0, 4);
    if (id !== 'IWAD' && id !== 'PWAD') {
      throw new Error(`Invalid WAD header: ${id}`);
    }

    this.numLumps = this.view.getInt32(4, true);
    this.infoTableOffset = this.view.getInt32(8, true);

    /** @type {{ name: string, position: number, size: number }[]} */
    this.lumps = [];

    for (let i = 0; i < this.numLumps; i++) {
      const entry = this.infoTableOffset + i * 16;
      this.lumps.push({
        position: this.view.getInt32(entry, true),
        size: this.view.getInt32(entry + 4, true),
        name: this.readAscii(entry + 8, 8).replace(/\0/g, ''),
      });
    }

    /** @type {Map<string, number>} */
    this.nameToIndex = new Map();
    for (let i = 0; i < this.lumps.length; i++) {
      this.nameToIndex.set(this.lumps[i].name.toUpperCase(), i);
    }
  }

  /**
   * @param {string|ArrayBuffer} source URL or buffer
   * @returns {Promise<WadFile>}
   */
  static async load(source) {
    const buffer = typeof source === 'string'
      ? await (await fetch(source)).arrayBuffer()
      : source;
    return new WadFile(buffer);
  }

  /**
   * @param {number} offset
   * @param {number} length
   * @returns {string}
   */
  readAscii(offset, length) {
    let s = '';
    for (let i = 0; i < length; i++) {
      s += String.fromCharCode(this.data[offset + i]);
    }
    return s;
  }

  /**
   * @param {string} name
   * @returns {number}
   */
  indexOf(name) {
    return this.nameToIndex.get(name.toUpperCase()) ?? -1;
  }

  /**
   * @param {string} name
   * @returns {number}
   */
  requireIndex(name) {
    const index = this.indexOf(name);
    if (index < 0) {
      throw new Error(`WAD lump not found: ${name}`);
    }
    return index;
  }

  /**
   * @param {number} index
   * @returns {number}
   */
  lumpSize(index) {
    return this.lumps[index].size;
  }

  /**
   * @param {number} index
   * @returns {Uint8Array}
   */
  readLump(index) {
    const lump = this.lumps[index];
    return this.data.subarray(lump.position, lump.position + lump.size);
  }

  /**
   * @param {string} name
   * @returns {Uint8Array}
   */
  readLumpByName(name) {
    return this.readLump(this.requireIndex(name));
  }
}
