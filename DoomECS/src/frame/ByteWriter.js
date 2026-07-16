/**
 * Growable byte buffer for checksum / snapshot serialization.
 */
export class ByteWriter {
  constructor(initial = 256) {
    this.buffer = new Uint8Array(initial);
    this.offset = 0;
  }

  /** @param {number} need */
  _ensure(need) {
    if (this.offset + need <= this.buffer.length) {
      return;
    }
    let cap = this.buffer.length;
    while (cap < this.offset + need) {
      cap *= 2;
    }
    const next = new Uint8Array(cap);
    next.set(this.buffer);
    this.buffer = next;
  }

  /** @param {number} v */
  writeUint8(v) {
    this._ensure(1);
    this.buffer[this.offset++] = v & 0xff;
  }

  /** @param {number} v */
  writeUint32(v) {
    this._ensure(4);
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
    view.setUint32(this.offset, v >>> 0, true);
    this.offset += 4;
  }

  /** @param {number} v */
  writeInt16(v) {
    this._ensure(2);
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
    view.setInt16(this.offset, v, true);
    this.offset += 2;
  }

  /** @param {string} s */
  writeString(s) {
    const bytes = new TextEncoder().encode(s);
    this.writeUint32(bytes.length);
    this._ensure(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  /** @param {Uint8Array} bytes */
  writeBytes(bytes) {
    this.writeUint32(bytes.length);
    this._ensure(bytes.length);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  /** @returns {Uint8Array} */
  toBytes() {
    return this.buffer.subarray(0, this.offset);
  }
}
