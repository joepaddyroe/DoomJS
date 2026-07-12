import { SoundDriver } from '../../audio/SoundDriver.js';

/** No-op driver for testing without audio. */
export class NullSoundDriver extends SoundDriver {
  get id() {
    return 'null';
  }
}
