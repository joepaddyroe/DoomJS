/**
 * One tic of player input (d_ticcmd.h — ticcmd_t).
 * @typedef {Object} TicCmd
 * @property {number} forwardmove -50..50
 * @property {number} sidemove -50..50
 * @property {number} angleturn turn delta before <<16 in P_MovePlayer
 * @property {number} buttons
 */

/** @returns {TicCmd} */
export function createTicCmd() {
  return {
    forwardmove: 0,
    sidemove: 0,
    angleturn: 0,
    buttons: 0,
  };
}
