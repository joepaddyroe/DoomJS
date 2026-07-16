import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  World,
  Frame,
  DeterministicRng,
  encodeTicCmd,
  decodeTicCmd,
  SimulationSession,
  ReplayRecorder,
  ReplayPlayer,
} from '../src/index.js';

function registerDemo(world) {
  world.registerComponent('position', {
    createDefault: () => ({ x: 0, y: 0 }),
    cloneValue: (v) => ({ x: v.x, y: v.y }),
  });
}

/**
 * Demo sim: player 0's forwardmove adds to entity position.x; RNG bumps y.
 * @type {import('../src/session/SimulationSession.js').SimulateFn}
 */
function demoSimulate(frame, inputs) {
  const store = frame.world.store('position');
  let entity = frame.world.getResource('playerEntity');
  if (entity === undefined) {
    entity = frame.world.createEntity();
    store.set(entity, { x: 0, y: 0 });
    frame.world.setResource('playerEntity', entity);
  }
  const cmd = decodeTicCmd(inputs[0]);
  const pos = store.get(entity);
  pos.x += cmd.forwardmove;
  pos.y += frame.rng.nextInt(3);
  store.set(entity, pos);
}

describe('DeterministicRng', () => {
  it('is reproducible from seed', () => {
    const a = new DeterministicRng(42);
    const b = new DeterministicRng(42);
    const seqA = Array.from({ length: 20 }, () => a.nextU32());
    const seqB = Array.from({ length: 20 }, () => b.nextU32());
    assert.deepEqual(seqA, seqB);
  });
});

describe('TicCmdCodec', () => {
  it('round-trips', () => {
    const raw = encodeTicCmd({
      forwardmove: -20,
      sidemove: 15,
      angleturn: 1200,
      consistancy: 99,
      chatchar: 65,
      buttons: 5,
    });
    assert.equal(raw.length, 8);
    assert.deepEqual(decodeTicCmd(raw), {
      forwardmove: -20,
      sidemove: 15,
      angleturn: 1200,
      consistancy: 99,
      chatchar: 65,
      buttons: 5,
    });
  });
});

describe('World / Frame', () => {
  it('clone is independent and checksum-stable', () => {
    const world = new World();
    registerDemo(world);
    const e = world.createEntity();
    world.store('position').set(e, { x: 3, y: 4 });
    const frame = Frame.create(0, { seed: 7, world });
    const copy = frame.clone();
    assert.equal(frame.checksum(), copy.checksum());
    copy.world.store('position').get(e).x = 99;
    assert.notEqual(frame.checksum(), copy.checksum());
    assert.equal(frame.world.store('position').get(e).x, 3);
  });
});

describe('SimulationSession + replay', () => {
  it('verified path matches replay checksums', () => {
    const world = new World();
    registerDemo(world);

    const session = new SimulationSession({
      maxPlayers: 1,
      playerMask: 1,
      simulate: demoSimulate,
    });
    session.reset(Frame.create(0, { seed: 123, world }));

    const recorder = new ReplayRecorder();
    recorder.begin({ seed: 123, maxPlayers: 1, playerMask: 1 });

    const moves = [10, 5, -3, 8];
    for (let i = 0; i < moves.length; i++) {
      const tick = i + 1;
      const inputs = [encodeTicCmd({ forwardmove: moves[i] })];
      session.stepVerified(tick, inputs);
      recorder.recordConfirmed(tick, inputs);
    }

    const liveChecksum = session.checksum();
    const { checksums } = new ReplayPlayer(recorder.toJSON(), demoSimulate, {
      createWorld: () => {
        const w = new World();
        registerDemo(w);
        return w;
      },
    }).run();

    assert.equal(checksums[checksums.length - 1], liveChecksum);
  });

  it('rollback corrects mispredicted remote input', () => {
    const world = new World();
    registerDemo(world);

    let remotePred = encodeTicCmd({ forwardmove: 0 });
    const session = new SimulationSession({
      maxPlayers: 2,
      localPlayer: 0,
      playerMask: 0b11,
      simulate: (frame, inputs) => {
        // sum both players' forwardmove into x
        const store = frame.world.store('position');
        let entity = frame.world.getResource('playerEntity');
        if (entity === undefined) {
          entity = frame.world.createEntity();
          store.set(entity, { x: 0, y: 0 });
          frame.world.setResource('playerEntity', entity);
        }
        const pos = store.get(entity);
        pos.x += decodeTicCmd(inputs[0]).forwardmove + decodeTicCmd(inputs[1]).forwardmove;
        store.set(entity, pos);
      },
      predictRemoteInput: () => new Uint8Array(remotePred),
    });
    session.reset(Frame.create(0, { seed: 1, world }));

    session.submitLocalInput(encodeTicCmd({ forwardmove: 1 }));
    session.predict(); // predicted remote = 0 → x = 1

    // Confirmed remote was actually +5
    session.confirmFrame(1, [
      encodeTicCmd({ forwardmove: 1 }),
      encodeTicCmd({ forwardmove: 5 }),
    ]);

    assert.ok(session.rollbackCount >= 1);
    assert.equal(session.verifiedFrame.world.store('position').get(
      session.verifiedFrame.world.getResource('playerEntity'),
    ).x, 6);
  });
});
