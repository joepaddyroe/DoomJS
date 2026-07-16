/**
 * Two-client deterministic demo over DoomJSRelay + DoomECS.
 * Usage: node demo/twoPlayerDemo.js
 * (starts its own relay on an ephemeral port)
 */

import { createRelayServer } from '../src/server.js';
import { RelayClient } from '../src/RelayClient.js';
import { MessageType } from '../src/protocol.js';
import {
  SimulationSession,
  NetPlayController,
  encodeTicCmd,
  createDemoFrame,
  demoSimulate,
  demoSnapshot,
} from '../../DoomECS/src/index.js';

const TICKS = 24;
const SEED = 42;
const ROOM = 'demo-room';

async function main() {
  const server = createRelayServer({ port: 0 });
  const port = server.wss.address().port;
  const url = `ws://127.0.0.1:${port}`;
  console.log(`[demo] relay on ${url}`);

  const host = new RelayClient(url);
  const guest = new RelayClient(url);
  await host.connect();
  await guest.connect();

  const joinHost = host.waitFor(MessageType.JOIN_ROOM);
  host.createRoom(ROOM);
  await joinHost;

  const joinGuest = guest.waitFor(MessageType.JOIN_ROOM);
  guest.joinRoom(ROOM);
  await joinGuest;

  host.setup({ map: 'DEMO', seed: SEED, deathmatch: 0 });
  await host.waitFor(MessageType.ROOM_STATE, (m) => m.setup?.seed === SEED);

  host.ready(true);
  guest.ready(true);
  await host.waitFor(MessageType.ROOM_STATE, (m) => m.players?.every((p) => p.ready));

  const startP = Promise.all([
    host.waitFor(MessageType.START),
    guest.waitFor(MessageType.START),
  ]);
  host.start();
  const [startMsg] = await startP;
  const playerMask = startMsg.playerMask;

  /** @type {NetPlayController[]} */
  const controllers = [];
  const clients = [host, guest];

  for (let i = 0; i < 2; i++) {
    const client = clients[i];
    const session = new SimulationSession({
      maxPlayers: 4,
      localPlayer: client.playerId,
      playerMask,
      simulate: demoSimulate,
    });
    const controller = new NetPlayController({
      session,
      sendInput: (tick, cmd) => client.sendInput(tick, cmd),
      recordReplay: i === 0,
    });
    controller.begin(createDemoFrame(SEED), { seed: SEED, playerMask });
    client.onMessage = (msg) => {
      if (msg.type === MessageType.CONFIRMED) {
        controller.onConfirmed(msg);
      }
    };
    controllers.push(controller);
  }

  /** @type {Promise<void>[]} */
  const confirmedWaits = [];

  for (let t = 1; t <= TICKS; t++) {
    const waits = clients.map((c) => c.waitFor(
      MessageType.CONFIRMED,
      (m) => m.tick === t,
    ));
    // Stagger local cmds so prediction may differ briefly
    controllers[0].localTick(encodeTicCmd({ forwardmove: (t % 5) + 1 }));
    controllers[1].localTick(encodeTicCmd({ forwardmove: -((t % 3) + 1) }));
    await Promise.all(waits);
    confirmedWaits.push(Promise.resolve());
  }

  const snap0 = demoSnapshot(controllers[0].session.verifiedFrame, playerMask);
  const snap1 = demoSnapshot(controllers[1].session.verifiedFrame, playerMask);

  console.log('[demo] host   ', snap0);
  console.log('[demo] guest  ', snap1);
  console.log('[demo] rollbacks', controllers.map((c) => c.session.rollbackCount));

  if (snap0.checksum !== snap1.checksum) {
    throw new Error(`Desync! ${snap0.checksum} !== ${snap1.checksum}`);
  }

  console.log(`[demo] OK — ${TICKS} ticks in sync, checksum=${snap0.checksum}`);

  host.close();
  guest.close();
  await server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
