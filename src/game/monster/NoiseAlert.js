import { lineOpening } from '../../math/mapGeometry.js';
import { ML_TWOSIDED } from '../mapFormat.js';

/** doomdata.h — ML_SOUNDBLOCK */
export const ML_SOUNDBLOCK = 64;

/**
 * Flood adjacent sectors with a sound target (p_enemy.c — P_NoiseAlert).
 * @param {import('../Level.js').Level} level
 * @param {import('../Mobj.js').Mobj} target
 * @param {{ subsector: { sector: import('../Level.js').LevelSector } | null }} emitter
 */
export function noiseAlert(level, target, emitter) {
  if (!emitter.subsector) {
    return;
  }

  level.soundValidCount = (level.soundValidCount ?? 0) + 1;
  recursiveSound(level, emitter.subsector.sector, 0, target, level.soundValidCount);
}

/**
 * @param {import('../Level.js').Level} level
 * @param {import('../Level.js').LevelSector} sector
 * @param {number} soundblocks
 * @param {import('../Mobj.js').Mobj} soundtarget
 * @param {number} validcount
 */
function recursiveSound(level, sector, soundblocks, soundtarget, validcount) {
  if (sector.soundSequence === validcount && sector.soundtraversed <= soundblocks + 1) {
    return;
  }

  sector.soundSequence = validcount;
  sector.soundtraversed = soundblocks + 1;
  sector.soundtarget = soundtarget;

  for (const check of sector.lines) {
    if (!(check.flags & ML_TWOSIDED)) {
      continue;
    }

    const opening = lineOpening(check);
    if (opening.openrange <= 0) {
      continue;
    }

    const other = check.frontSector === sector ? check.backSector : check.frontSector;
    if (!other) {
      continue;
    }

    if (check.flags & ML_SOUNDBLOCK) {
      if (!soundblocks) {
        recursiveSound(level, other, 1, soundtarget, validcount);
      }
    } else {
      recursiveSound(level, other, soundblocks, soundtarget, validcount);
    }
  }
}
