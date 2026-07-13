import { SfxBank } from './SfxBank.js';

/**
 * Game-facing sound API (s_sound.c — S_StartSound subset).
 */
export class SoundSystem {
  /**
   * @param {import('./SoundDriver.js').SoundDriver} driver
   */
  constructor(driver) {
    this.driver = driver;
    this.bank = new SfxBank();
    this.sfxVolume = 1;
    this.ready = false;
  }

  /** @returns {string} Active driver id. */
  get driverId() {
    return this.driver.id;
  }

  /**
   * Parse SFX lumps from the WAD. Re-binds driver clips if audio is already unlocked.
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @returns {Promise<void>}
   */
  async load(wad) {
    this.bank.load(wad);
    if (this.ready) {
      await this.driver.bindClips(this.bank.clips);
    }
  }

  /**
   * Call after a user gesture — creates/resumes audio and uploads clips.
   * @returns {Promise<void>}
   */
  async unlock() {
    if (!this.ready) {
      await this.driver.bindClips(this.bank.clips);
      this.ready = true;
    }
    await this.driver.unlock();
  }

  /** @param {number} volume 0–1 */
  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * @param {string} name Logical sfx name (e.g. "pistol")
   * @param {{ volume?: number, pan?: number }} [options]
   */
  start(name, options = {}) {
    if (!this.ready || !this.bank.get(name)) {
      return;
    }
    const volume = (options.volume ?? 1) * this.sfxVolume;
    this.driver.start(name, { ...options, volume });
  }
}
