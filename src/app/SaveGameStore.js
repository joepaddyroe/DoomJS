const KEY_PREFIX = 'doomjs.save.v1.';
const SLOT_COUNT = 6;

/**
 * localStorage-backed save slots (Phase 1).
 * Stores JSON strings per slot + a short display name.
 */
export class SaveGameStore {
  /** @returns {number} */
  static slotCount() {
    return SLOT_COUNT;
  }

  /** @param {number} slot */
  static slotKey(slot) {
    return `${KEY_PREFIX}slot.${slot}`;
  }

  /** @param {number} slot */
  static nameKey(slot) {
    return `${KEY_PREFIX}name.${slot}`;
  }

  /** @returns {string[]} slot display strings */
  listSlotNames() {
    const names = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      names.push(localStorage.getItem(SaveGameStore.nameKey(i)) ?? 'empty slot');
    }
    return names;
  }

  /**
   * @param {number} slot
   * @param {string} name
   * @param {object} payload
   */
  save(slot, name, payload) {
    localStorage.setItem(SaveGameStore.slotKey(slot), JSON.stringify(payload));
    localStorage.setItem(SaveGameStore.nameKey(slot), name);
  }

  /** @param {number} slot */
  load(slot) {
    const raw = localStorage.getItem(SaveGameStore.slotKey(slot));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

