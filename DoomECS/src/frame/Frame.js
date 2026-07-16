import { World } from '../ecs/World.js';
import { DeterministicRng } from '../rng/DeterministicRng.js';
import { ByteWriter } from './ByteWriter.js';
import { fnv1a32 } from '../checksum/Checksum.js';

/**
 * One simulation frame: tick index + ECS world + RNG.
 * Cloneable for Quantum-style rollback.
 */
export class Frame {
  /**
   * @param {number} tick
   * @param {World} world
   * @param {DeterministicRng} rng
   */
  constructor(tick, world, rng) {
    this.tick = tick;
    this.world = world;
    this.rng = rng;
  }

  /**
   * @param {number} tick
   * @param {{ seed?: number, world?: World }} [opts]
   * @returns {Frame}
   */
  static create(tick = 0, opts = {}) {
    const world = opts.world ?? new World();
    const rng = new DeterministicRng(opts.seed ?? 1);
    return new Frame(tick, world, rng);
  }

  /** @returns {Frame} */
  clone() {
    return new Frame(this.tick, this.world.clone(), this.rng.clone());
  }

  /** @returns {number} */
  checksum() {
    const writer = new ByteWriter();
    writer.writeUint32(this.tick);
    writer.writeUint32(this.rng.getSeedState());
    writer.writeUint32(this.world.checksum());
    return fnv1a32(writer.toBytes());
  }
}
