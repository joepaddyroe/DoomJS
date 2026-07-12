import { NullSoundDriver } from './NullSoundDriver.js';
import { WebAudioSoundDriver } from './WebAudioSoundDriver.js';
import { HowlerSoundDriver } from './HowlerSoundDriver.js';

/** @typedef {'null' | 'webaudio' | 'howler'} SoundDriverType */

export const SOUND_DRIVER_TYPES = {
  NULL: /** @type {const} */ ('null'),
  WEB_AUDIO: /** @type {const} */ ('webaudio'),
  HOWLER: /** @type {const} */ ('howler'),
};

/** @type {SoundDriverType[]} */
export const SOUND_DRIVER_OPTIONS = [
  SOUND_DRIVER_TYPES.WEB_AUDIO,
  SOUND_DRIVER_TYPES.HOWLER,
  SOUND_DRIVER_TYPES.NULL,
];

/**
 * @param {SoundDriverType} [type='webaudio']
 * @returns {import('../../audio/SoundDriver.js').SoundDriver}
 */
export function createSoundDriver(type = SOUND_DRIVER_TYPES.WEB_AUDIO) {
  switch (type) {
    case SOUND_DRIVER_TYPES.HOWLER:
      return new HowlerSoundDriver();
    case SOUND_DRIVER_TYPES.NULL:
      return new NullSoundDriver();
    case SOUND_DRIVER_TYPES.WEB_AUDIO:
    default:
      return new WebAudioSoundDriver();
  }
}

/**
 * Read driver choice from URL query: ?sound=webaudio | howler | null
 * @returns {SoundDriverType}
 */
export function soundDriverFromQuery() {
  const value = new URLSearchParams(globalThis.location?.search ?? '').get('sound');
  if (value === SOUND_DRIVER_TYPES.HOWLER
    || value === SOUND_DRIVER_TYPES.NULL
    || value === SOUND_DRIVER_TYPES.WEB_AUDIO) {
    return value;
  }
  return SOUND_DRIVER_TYPES.WEB_AUDIO;
}
