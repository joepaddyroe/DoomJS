/**
 * Active thinkers (p_tick.c — P_RunThinkers).
 */
export class ThinkerList {
  constructor() {
    /** @type {Array<{ think(): void }>} */
    this.thinkers = [];
    /** @type {Set<{ think(): void }>} */
    this.pendingRemove = new Set();
  }

  /** @param {{ think(): void }} thinker */
  add(thinker) {
    this.thinkers.push(thinker);
  }

  /** @param {{ think(): void }} thinker */
  remove(thinker) {
    this.pendingRemove.add(thinker);
  }

  runAll() {
    for (const thinker of this.thinkers) {
      if (!this.pendingRemove.has(thinker)) {
        thinker.think();
      }
    }

    if (this.pendingRemove.size > 0) {
      this.thinkers = this.thinkers.filter((t) => !this.pendingRemove.has(t));
      this.pendingRemove.clear();
    }
  }
}
