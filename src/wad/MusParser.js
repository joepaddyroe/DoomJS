/**
 * Doom MUS format parser + MUS→MIDI converter.
 *
 * MUS is the compact event format used by Doom/Heretic/Hexen (DMX).
 * Header: "MUS" 0x1A then little-endian fields.
 *
 * This module does NOT play audio. It is a data converter you can plug into
 * a future music subsystem (SoundFont synth, OPL emu, etc).
 */
export class MusParser {
  /**
   * Quick header check.
   * @param {Uint8Array} data
   */
  static isMus(data) {
    return data.length >= 4
      && data[0] === 0x4d // M
      && data[1] === 0x55 // U
      && data[2] === 0x53 // S
      && data[3] === 0x1a;
  }

  /**
   * Parse a MUS lump into a high-level event stream.
   * @param {Uint8Array} data MUS lump bytes
   * @returns {{
   *   header: { scoreLen: number, scoreStart: number, channels: number, secChannels: number, instrumentCount: number, instruments: number[] },
   *   events: Array<{ dt: number, kind: string, channel: number, a?: number, b?: number }>,
   * }}
   */
  static parse(data) {
    if (!MusParser.isMus(data)) {
      throw new Error('Not a MUS lump');
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const scoreLen = view.getUint16(4, true);
    const scoreStart = view.getUint16(6, true);
    const channels = view.getUint16(8, true);
    const secChannels = view.getUint16(10, true);
    const instrumentCount = view.getUint16(12, true);
    // uint16 dummy at 14

    const instruments = [];
    let insOff = 16;
    for (let i = 0; i < instrumentCount; i++) {
      if (insOff + 2 > data.length) break;
      instruments.push(view.getUint16(insOff, true));
      insOff += 2;
    }

    const header = {
      scoreLen,
      scoreStart,
      channels,
      secChannels,
      instrumentCount,
      instruments,
    };

    const events = [];

    let off = scoreStart;
    const end = Math.min(data.length, scoreStart + scoreLen);

    let pendingDt = 0;

    while (off < end) {
      const b = data[off++];
      const last = (b & 0x80) !== 0;
      const eventType = (b >> 4) & 0x07;
      const channel = b & 0x0f;

      // MUS has up to 9 channels; channel 15 is sometimes used but DMX remaps.
      // We keep the raw channel and remap later in MIDI conversion.
      switch (eventType) {
        case 0: { // release note
          const note = data[off++] & 0x7f;
          events.push({ dt: pendingDt, kind: 'noteOff', channel, a: note });
          pendingDt = 0;
          break;
        }
        case 1: { // play note
          const noteByte = data[off++];
          const note = noteByte & 0x7f;
          let vol = null;
          if (noteByte & 0x80) {
            vol = data[off++] & 0x7f;
          }
          events.push({ dt: pendingDt, kind: 'noteOn', channel, a: note, b: vol ?? -1 });
          pendingDt = 0;
          break;
        }
        case 2: { // pitch wheel
          const wheel = data[off++] & 0x7f;
          events.push({ dt: pendingDt, kind: 'pitch', channel, a: wheel });
          pendingDt = 0;
          break;
        }
        case 3: { // system event
          const sys = data[off++] & 0x7f;
          events.push({ dt: pendingDt, kind: 'system', channel, a: sys });
          pendingDt = 0;
          break;
        }
        case 4: { // change controller
          const ctrl = data[off++] & 0x7f;
          const val = data[off++] & 0x7f;
          events.push({ dt: pendingDt, kind: 'controller', channel, a: ctrl, b: val });
          pendingDt = 0;
          break;
        }
        case 6: { // end
          events.push({ dt: pendingDt, kind: 'end', channel });
          pendingDt = 0;
          return { header, events };
        }
        default: {
          // 5 = unused, 7 = reserved
          throw new Error(`Unknown MUS event type ${eventType} at offset ${off - 1}`);
        }
      }

      if (last) {
        const { value, nextOffset } = readMusVarLen(data, off, end);
        off = nextOffset;
        pendingDt += value;
      }
    }

    return { header, events };
  }

  /**
   * Convert a MUS lump into a standard MIDI file (format 0, single track).
   *
   * Notes:
   * - MUS clock is 140 Hz (tics). MIDI uses ticks-per-quarter-note; we choose PPQN=70
   *   and tempo 500000 (120 BPM). That makes 1 MUS tic ≈ 1 MIDI tick if you treat
   *   quarter note as 0.5s: 70 ticks/0.5s = 140 Hz.
   * - This is “good enough” for testing; exact tempo mapping can be tweaked later.
   *
   * @param {Uint8Array} musData
   * @returns {Uint8Array} MIDI file bytes
   */
  static toMidi(musData) {
    const { events } = MusParser.parse(musData);

    const ppqn = 70;
    const track = [];

    // Meta: tempo 120 BPM (500000 microseconds / quarter note)
    pushVarLen(track, 0);
    track.push(0xff, 0x51, 0x03, 0x07, 0xa1, 0x20);

    // Meta: time signature 4/4
    pushVarLen(track, 0);
    track.push(0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

    // Track state: last velocity per channel (MUS “reuse volume” semantics)
    const lastVol = new Uint8Array(16);
    lastVol.fill(64);

    // MUS controller mapping to MIDI controller numbers.
    // MUS controller ids:
    //  0 = program change (value = instrument)
    //  1 = bank select? (rare)
    //  2 = modulation
    //  3 = volume
    //  4 = pan
    //  5 = expression
    //  6 = reverb depth
    //  7 = chorus depth
    //  8 = sustain pedal
    //  9 = soft pedal
    const ctrlMap = {
      2: 1,
      3: 7,
      4: 10,
      5: 11,
      6: 91,
      7: 93,
      8: 64,
      9: 67,
    };

    let absTick = 0;

    for (const ev of events) {
      absTick += ev.dt;
      const dt = ev.dt; // we emit per-event dt; conversion keeps 1 tic -> 1 tick
      const midiCh = musChannelToMidiChannel(ev.channel);

      switch (ev.kind) {
        case 'noteOff': {
          pushVarLen(track, dt);
          track.push(0x80 | midiCh, ev.a & 0x7f, 64);
          break;
        }
        case 'noteOn': {
          const note = ev.a & 0x7f;
          let vol = ev.b;
          if (vol === -1 || vol == null) {
            vol = lastVol[midiCh];
          } else {
            lastVol[midiCh] = clamp7(vol);
          }
          pushVarLen(track, dt);
          track.push(0x90 | midiCh, note, clamp7(vol));
          break;
        }
        case 'pitch': {
          // MUS pitch is 0..127, center 64. Map to MIDI 14-bit pitch wheel.
          const v = clamp7(ev.a ?? 64);
          const bend = ((v - 64) * 128) + 8192; // rough
          const lo = bend & 0x7f;
          const hi = (bend >> 7) & 0x7f;
          pushVarLen(track, dt);
          track.push(0xe0 | midiCh, lo, hi);
          break;
        }
        case 'system': {
          // Map a few MUS system events to MIDI:
          // 10 = all sounds off, 11 = all notes off, 12 = mono, 13 = poly, 14 = reset all controllers
          const sys = ev.a ?? 0;
          let cc = null;
          let val = 0;
          if (sys === 10) cc = 120;
          else if (sys === 11) cc = 123;
          else if (sys === 14) cc = 121;
          if (cc != null) {
            pushVarLen(track, dt);
            track.push(0xb0 | midiCh, cc, val);
          }
          break;
        }
        case 'controller': {
          const ctrl = ev.a ?? 0;
          const val = ev.b ?? 0;
          if (ctrl === 0) {
            // program change
            pushVarLen(track, dt);
            track.push(0xc0 | midiCh, clamp7(val));
          } else if (ctrl === 1) {
            // bank select (CC 0)
            pushVarLen(track, dt);
            track.push(0xb0 | midiCh, 0x00, clamp7(val));
          } else {
            const cc = ctrlMap[ctrl];
            if (cc != null) {
              pushVarLen(track, dt);
              track.push(0xb0 | midiCh, cc, clamp7(val));
            }
          }
          break;
        }
        case 'end': {
          // End-of-track
          pushVarLen(track, dt);
          track.push(0xff, 0x2f, 0x00);
          return buildMidiFile(track, ppqn);
        }
        default:
          break;
      }
    }

    // Fallback: ensure end-of-track exists.
    pushVarLen(track, 0);
    track.push(0xff, 0x2f, 0x00);
    return buildMidiFile(track, ppqn);
  }
}

/**
 * Read MUS variable-length delta time.
 * MUS uses 7 bits per byte; high bit indicates “more”.
 */
function readMusVarLen(data, offset, end) {
  let value = 0;
  let shift = 0;
  let off = offset;
  while (off < end) {
    const b = data[off++];
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value, nextOffset: off };
}

function clamp7(n) {
  n |= 0;
  if (n < 0) return 0;
  if (n > 127) return 127;
  return n;
}

/**
 * MUS channels map to MIDI channels:
 * - MUS channel 0..8 map to MIDI 0..8 except channel 8 is percussion (MIDI 9).
 * - Channels >= 9 are shifted by +1 to keep MIDI ch 9 reserved for drums.
 */
function musChannelToMidiChannel(musCh) {
  const ch = musCh & 0x0f;
  if (ch === 8) return 9; // drums
  if (ch >= 9) return Math.min(15, ch + 1);
  return ch;
}

function pushVarLen(out, value) {
  // Standard MIDI VLQ (big-endian 7-bit chunks).
  let v = value >>> 0;
  const bytes = [];
  bytes.push(v & 0x7f);
  v >>>= 7;
  while (v) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  for (let i = bytes.length - 1; i >= 0; i--) out.push(bytes[i]);
}

function buildMidiFile(trackBytes, ppqn) {
  const header = [];
  // MThd
  header.push(0x4d, 0x54, 0x68, 0x64);
  header.push(0x00, 0x00, 0x00, 0x06);
  // format 0, 1 track
  header.push(0x00, 0x00, 0x00, 0x01);
  // division
  header.push((ppqn >> 8) & 0xff, ppqn & 0xff);

  const trackHeader = [];
  // MTrk
  trackHeader.push(0x4d, 0x54, 0x72, 0x6b);
  const len = trackBytes.length;
  trackHeader.push((len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff);

  const out = new Uint8Array(header.length + trackHeader.length + len);
  out.set(header, 0);
  out.set(trackHeader, header.length);
  out.set(new Uint8Array(trackBytes), header.length + trackHeader.length);
  return out;
}

