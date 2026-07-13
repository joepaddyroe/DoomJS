import { detectGamemode } from '../ui/Gamemode.js';
import { isMusLump, OplMusicBackend } from './OplMusicBackend.js';

/**
 * WAD music playback via OPL2 emulation (DMX MUS + GENMIDI).
 */
export class MusicSystem {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    this.wad = wad;
    this.gamemode = detectGamemode(wad);
    this.backend = new OplMusicBackend(wad);

    /** @type {AudioContext|null} */
    this.context = null;
    /** @type {GainNode|null} */
    this.gain = null;
    /** @type {number} */
    this.volume = 0.7;

    /** @type {string|null} */
    this.currentLump = null;
    /** @type {string|null} */
    this.pendingLump = null;
    /** @type {Promise<void>|null} */
    this.playPromise = null;
  }

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.context.destination);
      this.backend.attach(this.context, this.gain);
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    if (this.pendingLump) {
      const lump = this.pendingLump;
      this.pendingLump = null;
      this.startLump(lump);
    }
  }

  /** @param {number} volume 0..1 */
  setMusicVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.backend.setVolume(this.volume);
    if (this.gain) {
      this.gain.gain.value = this.volume;
    }
  }

  stop() {
    this.backend.stop();
    this.currentLump = null;
    this.pendingLump = null;
    this.playPromise = null;
  }

  /** @param {string} lumpName */
  startLump(lumpName) {
    const upper = lumpName.toUpperCase();
    if (this.currentLump === upper) {
      return;
    }
    if (this.wad.indexOf(upper) < 0) {
      return;
    }
    const data = this.wad.readLumpByName(upper);
    if (!isMusLump(data)) {
      return;
    }

    if (!this.context || !this.gain) {
      this.pendingLump = upper;
      return;
    }

    this.backend.stop();
    this.currentLump = upper;
    this.pendingLump = null;
    this.playPromise = this.playLump(upper, data);
  }

  /**
   * @param {string} lumpName
   * @param {Uint8Array} musData
   */
  async playLump(lumpName, musData) {
    try {
      await this.backend.play(lumpName, musData);
    } catch (error) {
      console.error(`Music playback failed for ${lumpName}`, error);
      if (this.currentLump === lumpName) {
        this.currentLump = null;
      }
    }
  }

  /** Title screen / control panel music. */
  startMenuMusic() {
    const candidates = this.gamemode === 'commercial'
      ? ['D_DM2TTL', 'D_INTRO', 'D_READ_M']
      : ['D_INTRO', 'D_INTROA', 'D_INTROB'];
    this.startFirstExisting(candidates);
  }

  /** Intermission music. */
  startIntermissionMusic() {
    const candidates = this.gamemode === 'commercial'
      ? ['D_DM2INT', 'D_INTER']
      : ['D_INTER'];
    this.startFirstExisting(candidates);
  }

  /**
   * Level music for a map name.
   * Doom 1: D_E1M1 etc. Doom 2: D_RUNNIN etc (not D_MAP01).
   * @param {string} mapName
   */
  startLevelMusic(mapName) {
    const name = mapName.toUpperCase();
    const candidates = [];
    if (/^E\dM\d$/.test(name)) {
      candidates.push(`D_${name}`);
    } else if (/^MAP\d\d$/.test(name)) {
      const doom2 = {
        MAP01: 'D_RUNNIN',
        MAP02: 'D_STALKS',
        MAP03: 'D_COUNTD',
        MAP04: 'D_BETWEE',
        MAP05: 'D_DOOM',
        MAP06: 'D_THE_DA',
        MAP07: 'D_SHAWN',
        MAP08: 'D_DDTBLU',
        MAP09: 'D_IN_CIT',
        MAP10: 'D_DEAD',
        MAP11: 'D_STLKS2',
        MAP12: 'D_THE_DA2',
        MAP13: 'D_DOOM2',
        MAP14: 'D_DDTBL2',
        MAP15: 'D_RUNNI2',
        MAP16: 'D_DEAD2',
        MAP17: 'D_STLKS3',
        MAP18: 'D_ROMERO',
        MAP19: 'D_SHAWN2',
        MAP20: 'D_MESSAG',
        MAP21: 'D_COUNT2',
        MAP22: 'D_DDTBL3',
        MAP23: 'D_AMPIE',
        MAP24: 'D_THEDA3',
        MAP25: 'D_ADRIAN',
        MAP26: 'D_MESSG2',
        MAP27: 'D_ROMER2',
        MAP28: 'D_TENSE',
        MAP29: 'D_SHAWN3',
        MAP30: 'D_OPENIN',
        MAP31: 'D_EVIL',
        MAP32: 'D_ULTIMA',
      };
      const lump = doom2[name];
      if (lump) candidates.push(lump);
    }
    this.startFirstExisting(candidates);
  }

  /** @param {string[]} candidates */
  startFirstExisting(candidates) {
    for (const c of candidates) {
      if (this.wad.indexOf(c) >= 0) {
        this.startLump(c);
        return;
      }
    }
  }
}
