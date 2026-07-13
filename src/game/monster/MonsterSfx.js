import { gameRandom } from '../GameRandom.js';

/**
 * @param {import('../../audio/SoundSystem.js').SoundSystem|null} sound
 * @param {string|null|undefined} id
 */
function play(sound, id) {
  if (id && sound) {
    sound.start(id);
  }
}

/**
 * Randomized see sounds (p_enemy.c — A_Look seeyou).
 * @param {string|null|undefined} seeSound
 * @param {import('../../audio/SoundSystem.js').SoundSystem|null} sound
 */
export function playSeeSound(seeSound, sound) {
  if (!seeSound) {
    return;
  }

  switch (seeSound) {
    case 'posit1':
    case 'posit2':
    case 'posit3':
      play(sound, ['posit1', 'posit2', 'posit3'][gameRandom() % 3]);
      break;
    case 'bgsit1':
    case 'bgsit2':
      play(sound, ['bgsit1', 'bgsit2'][gameRandom() % 2]);
      break;
    default:
      play(sound, seeSound);
      break;
  }
}

/**
 * Randomized death screams (p_enemy.c — A_Scream).
 * @param {string|null|undefined} deathSound
 * @param {import('../../audio/SoundSystem.js').SoundSystem|null} sound
 */
export function playDeathSound(deathSound, sound) {
  if (!deathSound) {
    return;
  }

  switch (deathSound) {
    case 'podth1':
    case 'podth2':
    case 'podth3':
      play(sound, ['podth1', 'podth2', 'podth3'][gameRandom() % 3]);
      break;
    case 'bgdth1':
    case 'bgdth2':
      play(sound, ['bgdth1', 'bgdth2'][gameRandom() % 2]);
      break;
    default:
      play(sound, deathSound);
      break;
  }
}

/**
 * @param {string|null|undefined} painSound
 * @param {import('../../audio/SoundSystem.js').SoundSystem|null} sound
 */
export function playPainSound(painSound, sound) {
  play(sound, painSound);
}

/**
 * @param {string|null|undefined} activeSound
 * @param {import('../../audio/SoundSystem.js').SoundSystem|null} sound
 */
export function playActiveSound(activeSound, sound) {
  play(sound, activeSound);
}
