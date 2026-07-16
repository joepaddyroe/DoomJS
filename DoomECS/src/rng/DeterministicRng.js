/**
 * Seeded deterministic PRNG (xorshift32).
 * Same seed + same call sequence → same values on every platform.
 */
export class DeterministicRng {
  /** @param {number} seed unsigned 32-bit; 0 becomes 1 */
  constructor(seed = 1) {
    this.state = (seed >>> 0) || 1;
  }

  /** @returns {number} next uint32 */
  nextU32() {
    let x = this.state >>> 0;
    x ^= (x << 13) >>> 0;
    x ^= x >>> 17;
    x ^= (x << 5) >>> 0;
    this.state = x >>> 0;
    return this.state;
  }

  /** @returns {number} integer in [0, max) */
  nextInt(max) {
    if (max <= 0) {
      return 0;
    }
    return this.nextU32() % (max >>> 0);
  }

  /** @returns {number} float in [0, 1) */
  nextFloat() {
    return this.nextU32() / 0x100000000;
  }

  /** @returns {DeterministicRng} */
  clone() {
    return new DeterministicRng(this.state);
  }

  /** @returns {number} */
  getSeedState() {
    return this.state >>> 0;
  }

  /** @param {number} state */
  setSeedState(state) {
    this.state = (state >>> 0) || 1;
  }
}
