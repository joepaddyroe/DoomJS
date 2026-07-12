import { FRACUNIT } from '../core/renderConstants.js';
import { FINEANGLES, SLOPERANGE } from '../core/angles.js';

/**
 * Generate Doom trig lookup tables (tables.c).
 * @returns {{
 *   finesine: Int32Array,
 *   finecosine: Int32Array,
 *   finetangent: Int32Array,
 *   tantoangle: Uint32Array,
 * }}
 */
export function createTrigTables() {
  const finesine = new Int32Array((5 * FINEANGLES) / 4);
  for (let i = 0; i < finesine.length; i++) {
    const angle = ((i + 0.5) * (Math.PI * 2)) / FINEANGLES;
    finesine[i] = (Math.sin(angle) * FRACUNIT) | 0;
  }

  const finecosine = finesine.subarray(FINEANGLES / 4);
  const finetangent = new Int32Array(FINEANGLES / 2);
  for (let i = 0; i < finetangent.length; i++) {
    const angle = ((i - FINEANGLES / 4 + 0.5) * (Math.PI * 2)) / FINEANGLES;
    finetangent[i] = (Math.tan(angle) * FRACUNIT) | 0;
  }

  const tantoangle = new Uint32Array(SLOPERANGE + 1);
  for (let i = 0; i <= SLOPERANGE; i++) {
    const ratio = i / SLOPERANGE;
    tantoangle[i] = (Math.atan(ratio) / (Math.PI * 2)) * 0x100000000 >>> 0;
  }

  return { finesine, finecosine, finetangent, tantoangle };
}

/**
 * @param {number} num
 * @param {number} den
 * @returns {number}
 */
export function slopeDiv(num, den) {
  if (den < 512) {
    return SLOPERANGE;
  }
  const ans = (num << 3) / (den >> 8);
  return ans <= SLOPERANGE ? ans | 0 : SLOPERANGE;
}
