/**
 * @typedef {Object} SfxClip
 * @property {number} sampleRate
 * @property {number} sampleCount
 * @property {Uint8Array} pcm 8-bit unsigned, centered at 128
 */

/**
 * @typedef {Object} SfxPlayOptions
 * @property {number} [volume=1] 0–1
 * @property {number} [pan=0] -1 (left) to 1 (right)
 */

/**
 * Pluggable sound backend (i_sound.c / s_sound.c).
 * Implementations: NullSoundDriver, WebAudioSoundDriver, HowlerSoundDriver.
 */
export class SoundDriver {
  /** @returns {string} */
  get id() {
    return 'base';
  }

  /** @returns {Promise<void>} */
  async init() {}

  /**
   * @param {Map<string, SfxClip>} clips
   * @returns {Promise<void>}
   */
  async bindClips(_clips) {}

  /** Call after a user gesture so audio can play (browser policy). */
  unlock() {}

  /**
   * @param {string} name Logical sfx name from sounds.c (e.g. "pistol")
   * @param {SfxPlayOptions} [options]
   */
  start(_name, _options = {}) {}

  /** Stop all active sounds. */
  stopAll() {}
}
