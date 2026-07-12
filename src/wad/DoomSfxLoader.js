/**
 * @typedef {import('../audio/SoundDriver.js').SfxClip} SfxClip
 */

/**
 * Parse a Doom SFX lump (i_sound.c — getsfx / WAD ds* format).
 * @param {Uint8Array} lump
 * @returns {SfxClip}
 */
export function parseDoomSfx(lump) {
  if (lump.length < 8) {
    throw new Error('SFX lump too small');
  }

  const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);
  const sampleRate = view.getInt16(2, true);
  const sampleCount = view.getInt16(4, true);
  const end = Math.min(lump.length, 8 + sampleCount);

  if (sampleRate <= 0 || sampleCount <= 0 || end <= 8) {
    throw new Error('Invalid SFX header');
  }

  return {
    sampleRate,
    sampleCount: end - 8,
    pcm: lump.subarray(8, end),
  };
}

/**
 * @param {SfxClip} sfx
 * @param {AudioContext} context
 * @returns {AudioBuffer}
 */
export function sfxToAudioBuffer(sfx, context) {
  const buffer = context.createBuffer(1, sfx.sampleCount, sfx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < sfx.sampleCount; i++) {
    channel[i] = (sfx.pcm[i] - 128) / 128;
  }
  return buffer;
}

/**
 * Build an 8-bit mono WAV blob for libraries that expect URLs (Howler).
 * @param {SfxClip} sfx
 * @returns {Blob}
 */
export function sfxToWavBlob(sfx) {
  const dataSize = sfx.sampleCount;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sfx.sampleRate, true);
  view.setUint32(28, sfx.sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  const out = new Uint8Array(buffer, 44);
  out.set(sfx.pcm);

  return new Blob([buffer], { type: 'audio/wav' });
}
