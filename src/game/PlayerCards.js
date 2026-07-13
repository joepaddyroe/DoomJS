/** Key/card types (doomdef.h — cardtype_t). */
export const CARD_BLUE = 0;
export const CARD_YELLOW = 1;
export const CARD_RED = 2;
export const CARD_BLUE_SKULL = 3;
export const CARD_YELLOW_SKULL = 4;
export const CARD_RED_SKULL = 5;
export const NUM_CARDS = 6;

/**
 * Key slots shown on the status bar (st_stuff.c — ST_updateWidgets).
 * @param {boolean[]} cards
 * @returns {number[]}
 */
export function statusBarKeyboxes(cards) {
  /** @type {number[]} */
  const boxes = [-1, -1, -1];
  for (let i = 0; i < 3; i++) {
    boxes[i] = cards[i] ? i : -1;
    if (cards[i + 3]) {
      boxes[i] = i + 3;
    }
  }
  return boxes;
}
