import { SoundDriver } from '../../audio/SoundDriver.js';
import { sfxToWavBlob } from '../../wad/DoomSfxLoader.js';

const HOWLER_CDN = 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js';

/**
 * Howler.js SFX driver — loads decoded WAD clips as WAV blob URLs.
 * Requires Howler on window (loaded via script tag or loadHowler()).
 */
export class HowlerSoundDriver extends SoundDriver {
  constructor() {
    super();
    /** @type {Map<string, import('howler').Howl>} */
    this.sounds = new Map();
    /** @type {string[]} */
    this.objectUrls = [];
    /** @type {boolean} */
    this.howlerReady = false;
  }

  get id() {
    return 'howler';
  }

  async init() {
    await this.ensureHowler();
  }

  async ensureHowler() {
    if (typeof globalThis.Howl !== 'undefined') {
      this.howlerReady = true;
      return;
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = HOWLER_CDN;
      script.async = true;
      script.onload = () => {
        this.howlerReady = typeof globalThis.Howl !== 'undefined';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Howler.js'));
      document.head.appendChild(script);
    });

    if (!this.howlerReady) {
      throw new Error('Howler.js loaded but Howl is unavailable');
    }
  }

  /** @param {Map<string, import('../../audio/SoundDriver.js').SfxClip>} clips */
  async bindClips(clips) {
    await this.init();
    this.disposeSounds();

    const Howl = globalThis.Howl;
    for (const [name, clip] of clips) {
      const blob = sfxToWavBlob(clip);
      const url = URL.createObjectURL(blob);
      this.objectUrls.push(url);

      this.sounds.set(name, new Howl({
        src: [url],
        format: ['wav'],
        preload: true,
        html5: false,
      }));
    }
  }

  unlock() {
    // Howler handles context resume on first play; no-op here.
  }

  /** @param {string} name @param {{ volume?: number, pan?: number }} [options] */
  start(name, options = {}) {
    if (!this.howlerReady) {
      return;
    }

    const howl = this.sounds.get(name);
    if (!howl) {
      return;
    }

    const id = howl.play();
    howl.volume(options.volume ?? 1, id);

    const pan = options.pan ?? 0;
    if (typeof howl.stereo === 'function') {
      howl.stereo(Math.max(-1, Math.min(1, pan)), id);
    }
  }

  stopAll() {
    for (const howl of this.sounds.values()) {
      howl.stop();
    }
  }

  disposeSounds() {
    for (const howl of this.sounds.values()) {
      howl.unload();
    }
    this.sounds.clear();

    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.length = 0;
  }
}
