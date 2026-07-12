/** Player ticcmd button flags (d_event.h). */
export const BT_ATTACK = 1;
export const BT_USE = 2;
export const BT_CHANGE = 4;
export const BT_WEAPONSHIFT = 3;
export const BT_WEAPONMASK = 0x7 << BT_WEAPONSHIFT;

/** @param {number} weaponIndex */
export function weaponChangeButtons(weaponIndex) {
  return BT_CHANGE | ((weaponIndex & 7) << BT_WEAPONSHIFT);
}
