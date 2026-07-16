import { ComponentStore } from './ComponentStore.js';
import { ByteWriter } from '../frame/ByteWriter.js';
import { fnv1a32 } from '../checksum/Checksum.js';

/**
 * Minimal deterministic ECS world.
 * Entities are dense integer ids; components live in named sparse stores.
 */
export class World {
  constructor() {
    this.nextEntity = 1;
    this.alive = new Set();
    /** @type {Map<string, ComponentStore>} */
    this.stores = new Map();
    /** @type {Map<string, unknown>} */
    this.resources = new Map();
  }

  /**
   * @param {string} name
   * @param {{ createDefault: () => any, cloneValue?: (v: any) => any, capacity?: number }} opts
   */
  registerComponent(name, opts) {
    if (this.stores.has(name)) {
      throw new Error(`Component already registered: ${name}`);
    }
    this.stores.set(name, new ComponentStore(name, opts));
    return this.stores.get(name);
  }

  /** @param {string} name */
  store(name) {
    const s = this.stores.get(name);
    if (!s) {
      throw new Error(`Unknown component: ${name}`);
    }
    return s;
  }

  /** @returns {number} entity id */
  createEntity() {
    const id = this.nextEntity++;
    this.alive.add(id);
    return id;
  }

  /** @param {number} entity */
  destroyEntity(entity) {
    if (!this.alive.has(entity)) {
      return;
    }
    for (const store of this.stores.values()) {
      store.remove(entity);
    }
    this.alive.delete(entity);
  }

  /** @param {number} entity */
  isAlive(entity) {
    return this.alive.has(entity);
  }

  /**
   * @param {string} key
   * @param {unknown} value
   */
  setResource(key, value) {
    this.resources.set(key, value);
  }

  /** @param {string} key */
  getResource(key) {
    return this.resources.get(key);
  }

  /** @returns {World} */
  clone() {
    const copy = new World();
    copy.nextEntity = this.nextEntity;
    copy.alive = new Set(this.alive);
    for (const [name, store] of this.stores) {
      copy.stores.set(name, store.clone());
    }
    for (const [key, value] of this.resources) {
      copy.resources.set(key, structuredClone(value));
    }
    return copy;
  }

  /** @returns {number} FNV checksum of world contents */
  checksum() {
    const writer = new ByteWriter();
    writer.writeUint32(this.nextEntity);
    writer.writeUint32(this.alive.size);
    const aliveIds = [...this.alive].sort((a, b) => a - b);
    for (const id of aliveIds) {
      writer.writeUint32(id);
    }
    const names = [...this.stores.keys()].sort();
    for (const name of names) {
      writer.writeString(name);
      this.stores.get(name).writeChecksumBytes(writer);
    }
    const resKeys = [...this.resources.keys()].sort();
    for (const key of resKeys) {
      writer.writeString(key);
      writer.writeString(JSON.stringify(this.resources.get(key)));
    }
    return fnv1a32(writer.toBytes());
  }
}
