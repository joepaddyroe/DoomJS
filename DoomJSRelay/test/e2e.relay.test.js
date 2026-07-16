import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRelayServer } from '../src/server.js';
import { RelayClient } from '../src/RelayClient.js';
import { MessageType } from '../src/protocol.js';
import {
  SimulationSession,
  NetPlayController,
  encodeTicCmd,
  createDemoFrame,
  demoSimulate,
} from '../../DoomECS/src/index.js';

describe('relay e2e two-player demo sim', () => {
  it('keeps both peers checksum-equal over confirmed ticks', async () => {
    const server = createRelayServer({ port: 0 });
    const port = server.wss.address().port;
    const url = `ws://127.0.0.1:${port}`;

    const host = new RelayClient(url);
    const guest = new RelayClient(url);
    await host.connect();
    await guest.connect();

    const roomId = `e2e-${Date.now()}`;
    const joinedHost = host.waitFor(MessageType.JOIN_ROOM);
    host.createRoom(roomId);
    await joinedHost;

    const joinedGuest = guest.waitFor(MessageType.JOIN_ROOM);
    guest.joinRoom(roomId);
    await joinedGuest;

    const SEED = 99;
    host.setup({ seed: SEED, map: 'DEMO' });
    await host.waitFor(MessageType.ROOM_STATE, (m) => m.setup?.seed === SEED);

    host.ready(true);
    guest.ready(true);
    await host.waitFor(MessageType.ROOM_STATE, (m) => m.players?.length === 2 && m.players.every((p) => p.ready));

    const starts = Promise.all([
      host.waitFor(MessageType.START),
      guest.waitFor(MessageType.START),
    ]);
    host.start();
    const [startMsg] = await starts;
    const playerMask = startMsg.playerMask;

    const makeController = (client) => {
      const session = new SimulationSession({
        maxPlayers: 4,
        localPlayer: client.playerId,
        playerMask,
        simulate: demoSimulate,
      });
      const controller = new NetPlayController({
        session,
        sendInput: (tick, cmd) => client.sendInput(tick, cmd),
      });
      controller.begin(createDemoFrame(SEED), { seed: SEED, playerMask });
      client.onMessage = (msg) => {
        if (msg.type === MessageType.CONFIRMED) {
          controller.onConfirmed(msg);
        }
      };
      return controller;
    };

    const c0 = makeController(host);
    const c1 = makeController(guest);

    const TICKS = 16;
    for (let t = 1; t <= TICKS; t++) {
      const waits = [
        host.waitFor(MessageType.CONFIRMED, (m) => m.tick === t),
        guest.waitFor(MessageType.CONFIRMED, (m) => m.tick === t),
      ];
      c0.localTick(encodeTicCmd({ forwardmove: t }));
      c1.localTick(encodeTicCmd({ forwardmove: -t }));
      await Promise.all(waits);
    }

    assert.equal(c0.session.verifiedTick, TICKS);
    assert.equal(c1.session.verifiedTick, TICKS);
    assert.equal(c0.session.checksum(), c1.session.checksum());

    host.close();
    guest.close();
    await server.close();
  });
});
