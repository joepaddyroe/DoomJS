import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/Room.js';
import { MessageType } from '../src/protocol.js';

function fakeWs() {
  return { readyState: 1, send() {} };
}

describe('Room', () => {
  it('assigns slots and confirms when all inputs arrive', () => {
    const room = new Room('test');
    const a = room.addClient('a', fakeWs());
    const b = room.addClient('b', fakeWs());
    assert.equal(a.playerId, 0);
    assert.equal(b.playerId, 1);
    assert.equal(room.playerMask, 0b11);

    room.setSetup('a', { map: 'E1M1', seed: 1, deathmatch: 0 });
    room.setReady('a');
    room.setReady('b');
    room.start('a');

    assert.deepEqual(room.submitInput('a', 1, [1, 0, 0, 0, 0, 0, 0, 0]), []);
    const confirmed = room.submitInput('b', 1, [2, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0].type, MessageType.CONFIRMED);
    assert.equal(confirmed[0].tick, 1);
    assert.deepEqual(confirmed[0].inputs[0], [1, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(confirmed[0].inputs[1], [2, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(room.tick, 1);
  });

  it('buffers ahead-of-time inputs and drains in order', () => {
    const room = new Room('burst');
    room.addClient('a', fakeWs());
    room.addClient('b', fakeWs());
    room.setSetup('a', { seed: 1 });
    room.setReady('a');
    room.setReady('b');
    room.start('a');

    // Host bursts ticks 1–3 before guest replies.
    assert.deepEqual(room.submitInput('a', 1, [1, 0, 0, 0, 0, 0, 0, 0]), []);
    assert.deepEqual(room.submitInput('a', 2, [2, 0, 0, 0, 0, 0, 0, 0]), []);
    assert.deepEqual(room.submitInput('a', 3, [3, 0, 0, 0, 0, 0, 0, 0]), []);

    assert.deepEqual(room.submitInput('b', 1, [10, 0, 0, 0, 0, 0, 0, 0]), [
      {
        type: MessageType.CONFIRMED,
        roomId: 'burst',
        tick: 1,
        inputs: [[1, 0, 0, 0, 0, 0, 0, 0], [10, 0, 0, 0, 0, 0, 0, 0], null, null],
        playerMask: 0b11,
      },
    ]);

    const rest = room.submitInput('b', 2, [20, 0, 0, 0, 0, 0, 0, 0]);
    // Only tick 2 completes; tick 3 still waiting for guest.
    assert.equal(rest.length, 1);
    assert.equal(rest[0].tick, 2);

    const last = room.submitInput('b', 3, [30, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(last.length, 1);
    assert.equal(last[0].tick, 3);
    assert.equal(room.tick, 3);
  });

  it('rejects non-host start', () => {
    const room = new Room('t2');
    room.addClient('a', fakeWs());
    room.addClient('b', fakeWs());
    room.setSetup('a', { seed: 1 });
    room.setReady('a');
    room.setReady('b');
    assert.throws(() => room.start('b'));
  });
});
