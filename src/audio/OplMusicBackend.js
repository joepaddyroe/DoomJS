import { MusParser } from '../wad/MusParser.js';

const OPL_SAMPLE_RATE = 49700;
const OPL_SCRIPT = new URL('../vendor/opl3.min.js', import.meta.url).href;

/** @typedef {{ Player: typeof import('opl3').Player, format: { MUS: unknown } }} Opl3Lib */

/**
 * OPL2 music backend using doomjs/opl3 (DMX MUS + GENMIDI).
 * Renders MUS lumps to PCM offline, then plays via Web Audio with looping.
 */
export class OplMusicBackend {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    this.genmidi = loadGenmidi(wad);
    /** @type {Map<string, AudioBuffer>} */
    this.cache = new Map();
    /** @type {AudioContext|null} */
    this.context = null;
    /** @type {GainNode|null} */
    this.gain = null;
    /** @type {AudioBufferSourceNode|null} */
    this.source = null;
    /** @type {Promise<Opl3Lib>|null} */
    this.opl3Ready = null;
    this.playGeneration = 0;
  }

  /** @param {AudioContext} context @param {GainNode} gain */
  attach(context, gain) {
    this.context = context;
    this.gain = gain;
  }

  stop() {
    this.playGeneration++;
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // ignore
      }
      this.source.disconnect();
      this.source = null;
    }
  }

  /** @param {number} volume 0..1 */
  setVolume(volume) {
    if (this.gain) {
      this.gain.gain.value = volume;
    }
  }

  /**
   * @param {string} lumpName
   * @param {Uint8Array} musData
   */
  async play(lumpName, musData) {
    if (!this.context || !this.gain) {
      throw new Error('OplMusicBackend not attached to AudioContext');
    }

    this.stop();
    const generation = this.playGeneration;

    let audioBuffer = this.cache.get(lumpName);
    if (!audioBuffer) {
      audioBuffer = await this.renderMus(lumpName, musData, generation);
      if (!audioBuffer) {
        return;
      }
    }

    if (generation !== this.playGeneration || !this.context || !this.gain) {
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;
    source.connect(this.gain);
    source.start();
    this.source = source;
  }

  /**
   * @param {string} lumpName
   * @param {Uint8Array} musData
   * @param {number} generation
   * @returns {Promise<AudioBuffer|null>}
   */
  async renderMus(lumpName, musData, generation) {
    const OPL3 = await loadOpl3();
    if (generation !== this.playGeneration || !this.context) {
      return null;
    }

    const pcm = await renderMusToPcm(OPL3, toArrayBuffer(musData), this.genmidi);
    if (generation !== this.playGeneration || !this.context) {
      return null;
    }

    const audioBuffer = pcm16ToAudioBuffer(this.context, pcm);
    this.cache.set(lumpName, audioBuffer);
    return audioBuffer;
  }
}

/**
 * @param {import('../wad/WadFile.js').WadFile} wad
 * @returns {ArrayBuffer|null}
 */
function loadGenmidi(wad) {
  if (wad.indexOf('GENMIDI') < 0) {
    return null;
  }
  const data = wad.readLumpByName('GENMIDI');
  if (data.length < 8) {
    return null;
  }
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7]);
  if (magic !== '#OPL_II#') {
    return null;
  }
  return toArrayBuffer(data);
}

/** @returns {Promise<Opl3Lib>} */
function loadOpl3() {
  const global = /** @type {Window & { OPL3?: Opl3Lib }} */ (window);
  if (global.OPL3) {
    return Promise.resolve(global.OPL3);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-opl3="1"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (global.OPL3) resolve(global.OPL3);
        else reject(new Error('OPL3 library failed to initialize'));
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error('OPL3 script failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = OPL_SCRIPT;
    script.dataset.opl3 = '1';
    script.onload = () => {
      if (global.OPL3) resolve(global.OPL3);
      else reject(new Error('OPL3 library failed to initialize'));
    };
    script.onerror = () => reject(new Error('OPL3 script failed to load'));
    document.head.appendChild(script);
  });
}

/**
 * @param {Opl3Lib} OPL3
 * @param {ArrayBuffer} musBuffer
 * @param {ArrayBuffer|null} genmidi
 * @returns {Promise<ArrayBuffer>}
 */
function renderMusToPcm(OPL3, musBuffer, genmidi) {
  return new Promise((resolve, reject) => {
    /** @type {Record<string, unknown>} */
    const options = {
      normalization: false,
    };
    if (genmidi) {
      options.instruments = genmidi;
    }

    const player = new OPL3.Player(OPL3.format.MUS, options);
    player.on('error', reject);
    player.load(musBuffer, (err, pcm) => {
      if (err) {
        reject(err);
        return;
      }
      if (!pcm) {
        reject(new Error('OPL3 returned empty PCM buffer'));
        return;
      }
      resolve(pcm);
    });
  });
}

/**
 * @param {AudioContext} context
 * @param {ArrayBuffer} pcm
 * @returns {AudioBuffer}
 */
function pcm16ToAudioBuffer(context, pcm) {
  const samples = new Int16Array(pcm);
  const frames = (samples.length / 2) | 0;
  const buffer = context.createBuffer(2, frames, OPL_SAMPLE_RATE);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let i = 0; i < frames; i++) {
    left[i] = samples[i * 2] / 32768;
    right[i] = samples[i * 2 + 1] / 32768;
  }

  return buffer;
}

/** @param {Uint8Array} data */
function toArrayBuffer(data) {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return /** @type {ArrayBuffer} */ (data.buffer);
  }
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

/** @param {Uint8Array} data */
export function isMusLump(data) {
  return MusParser.isMus(data);
}
