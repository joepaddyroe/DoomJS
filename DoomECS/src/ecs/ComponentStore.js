/**
 * Sparse-set component store backed by parallel TypedArrays / arrays.
 * Designed so World.clone() can memcpy store buffers for rollback.
 *
 * @template T
 */
export class ComponentStore {
  /**
   * @param {string} name
   * @param {{ createDefault: () => T, cloneValue?: (v: T) => T, capacity?: number }} opts
   */
  constructor(name, opts) {
    this.name = name;
    this.createDefault = opts.createDefault;
    this.cloneValue = opts.cloneValue ?? ((v) => structuredClone(v));
    this.capacity = opts.capacity ?? 256;

    /** @type {number[]} dense entity ids */
    this.dense = [];
    /** @type {Int32Array} entity → dense index, -1 = absent */
    this.sparse = new Int32Array(this.capacity).fill(-1);
    /** @type {T[]} */
    this.data = [];
  }

  /** @param {number} entity */
  has(entity) {
    return entity >= 0 && entity < this.sparse.length && this.sparse[entity] !== -1;
  }

  /** @param {number} entity @returns {T|undefined} */
  get(entity) {
    const idx = entity < this.sparse.length ? this.sparse[entity] : -1;
    return idx === -1 ? undefined : this.data[idx];
  }

  /**
   * @param {number} entity
   * @param {T} [value]
   * @returns {T}
   */
  set(entity, value) {
    this._ensureSparse(entity);
    const existing = this.sparse[entity];
    const v = value === undefined ? this.createDefault() : value;
    if (existing !== -1) {
      this.data[existing] = v;
      return v;
    }
    const idx = this.dense.length;
    this.dense.push(entity);
    this.data.push(v);
    this.sparse[entity] = idx;
    return v;
  }

  /** @param {number} entity */
  remove(entity) {
    if (!this.has(entity)) {
      return;
    }
    const idx = this.sparse[entity];
    const last = this.dense.length - 1;
    const lastEntity = this.dense[last];

    this.dense[idx] = lastEntity;
    this.data[idx] = this.data[last];
    this.sparse[lastEntity] = idx;

    this.dense.pop();
    this.data.pop();
    this.sparse[entity] = -1;
  }

  /** @returns {ComponentStore<T>} */
  clone() {
    const copy = new ComponentStore(this.name, {
      createDefault: this.createDefault,
      cloneValue: this.cloneValue,
      capacity: this.sparse.length,
    });
    copy.dense = this.dense.slice();
    copy.sparse = new Int32Array(this.sparse);
    copy.data = this.data.map((v) => this.cloneValue(v));
    return copy;
  }

  /**
   * Append store bytes into a writer for checksums (JSON fallback for object comps).
   * @param {import('../frame/ByteWriter.js').ByteWriter} writer
   */
  writeChecksumBytes(writer) {
    writer.writeUint32(this.dense.length);
    for (let i = 0; i < this.dense.length; i++) {
      writer.writeUint32(this.dense[i]);
      const json = JSON.stringify(this.data[i]);
      writer.writeString(json);
    }
  }

  /** @param {number} entity */
  _ensureSparse(entity) {
    if (entity < this.sparse.length) {
      return;
    }
    let cap = this.sparse.length;
    while (cap <= entity) {
      cap *= 2;
    }
    const next = new Int32Array(cap).fill(-1);
    next.set(this.sparse);
    this.sparse = next;
  }
}
