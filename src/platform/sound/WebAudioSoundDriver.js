import { SoundDriver } from '../../audio/SoundDriver.js';
import { sfxToAudioBuffer } from '../../wad/DoomSfxLoader.js';

const MAX_CHANNELS = 8;

/**
 * Web Audio API SFX driver (i_sound.c mixer via AudioBufferSourceNode).
 * AudioContext is created on first unlock() after a user gesture.
 */
export class WebAudioSoundDriver extends SoundDriver {
  constructor() {
    super();
    /** @type {AudioContext|null} */
    this.context = null;
    /** @type {Map<string, AudioBuffer>} */
    this.buffers = new Map();
    /** @type {{ source: AudioBufferSourceNode, gain: GainNode }[]} */
    this.channels = [];
  }

  get id() {
    return 'webaudio';
  }

  /** @param {Map<string, import('../../audio/SoundDriver.js').SfxClip>} clips */
  async bindClips(clips) {
    if (!this.context) {
      this.context = new AudioContext();
    }

    this.buffers.clear();
    for (const [name, clip] of clips) {
      this.buffers.set(name, sfxToAudioBuffer(clip, this.context));
    }
  }

  async unlock() {
    if (!this.context) {
      return;
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /** @param {string} name @param {{ volume?: number, pan?: number }} [options] */
  start(name, options = {}) {
    if (!this.context || this.context.state !== 'running') {
      return;
    }

    const buffer = this.buffers.get(name);
    if (!buffer) {
      return;
    }

    while (this.channels.length >= MAX_CHANNELS) {
      const oldest = this.channels.shift();
      try {
        oldest.source.stop();
      } catch {
        // Already stopped.
      }
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gain = this.context.createGain();
    gain.gain.value = options.volume ?? 1;

    const pan = options.pan ?? 0;
    if (this.context.createStereoPanner) {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      source.connect(gain);
      gain.connect(panner);
      panner.connect(this.context.destination);
    } else {
      source.connect(gain);
      gain.connect(this.context.destination);
    }

    source.onended = () => {
      const idx = this.channels.findIndex((ch) => ch.source === source);
      if (idx >= 0) {
        this.channels.splice(idx, 1);
      }
    };

    this.channels.push({ source, gain });
    source.start(0);
  }

  stopAll() {
    for (const channel of this.channels) {
      try {
        channel.source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.channels.length = 0;
  }
}
