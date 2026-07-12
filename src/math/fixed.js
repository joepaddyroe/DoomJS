import { FRACBITS, FRACUNIT } from '../core/renderConstants.js';

/** @typedef {number} Fixed */

/**
 * 16.16 fixed-point multiply (m_fixed.c — FixedMul).
 * @param {Fixed} a
 * @param {Fixed} b
 * @returns {Fixed}
 */
export function fixedMul(a, b) {
  return Number((BigInt(a | 0) * BigInt(b | 0)) >> BigInt(FRACBITS));
}

/**
 * 16.16 fixed-point divide (m_fixed.c — FixedDiv2).
 * @param {Fixed} a
 * @param {Fixed} b
 * @returns {Fixed}
 */
export function fixedDiv2(a, b) {
  if (b === 0) {
    throw new Error('fixedDiv2: divide by zero');
  }
  return Math.trunc((a / b) * FRACUNIT);
}

/**
 * Safe fixed divide with overflow guard (m_fixed.c — FixedDiv).
 * @param {Fixed} a
 * @param {Fixed} b
 * @returns {Fixed}
 */
export function fixedDiv(a, b) {
  if ((Math.abs(a >> 14) >= Math.abs(b))) {
    return (a ^ b) < 0 ? -0x80000000 : 0x7fffffff;
  }
  return fixedDiv2(a, b);
}

/**
 * Extract the integer part of a fixed value.
 * @param {Fixed} value
 * @returns {number}
 */
export function fixedToInt(value) {
  return value >> FRACBITS;
}

/**
 * Convert integer to fixed.
 * @param {number} value
 * @returns {Fixed}
 */
export function intToFixed(value) {
  return value << FRACBITS;
}

/** Truncate to signed 32-bit (C fixed_t / int behavior). */
export function int32(value) {
  return value | 0;
}

export { FRACBITS, FRACUNIT };
