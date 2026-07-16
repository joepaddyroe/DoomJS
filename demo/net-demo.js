/**
 * Browser demo: DoomJSRelay + DoomECS demo sim.
 * Open two tabs; host creates room, guest joins; both Ready; host Start; Send ticks.
 */
import { RelayClient } from '../src/net/RelayBridge.js';
import {
  SimulationSession,
  NetPlayController,
  encodeTicCmd,
  createDemoFrame,
  demoSimulate,
  demoSnapshot,
} from '../DoomECS/src/index.js';

const els = {
  url: document.getElementById('url'),
  room: document.getElementById('room'),
  connect: document.getElementById('connect'),
  create: document.getElementById('create'),
  join: document.getElementById('join'),
  ready: document.getElementById('ready'),
  start: document.getElementById('start'),
  tick: document.getElementById('tick'),
  status: document.getElementById('status'),
};

/** @type {RelayClient|null} */
let client = null;
/** @type {NetPlayController|null} */
let controller = null;
let playerMask = 1;
const SEED = 42;
/** @type {object[]} */
const log = [];

function setStatus(text, cls = '') {
  els.status.className = `status ${cls}`.trim();
  els.status.textContent = text;
}

function append(line) {
  log.push(line);
  if (log.length > 40) {
    log.shift();
  }
  setStatus(log.join('\n'));
}

els.connect.addEventListener('click', async () => {
  try {
    client = new RelayClient(els.url.value.trim());
    client.onMessage = onMsg;
    const hello = await client.connect();
    append(`Connected as ${hello.clientId}`);
    els.create.disabled = false;
    els.join.disabled = false;
  } catch (err) {
    setStatus(String(err), 'bad');
  }
});

els.create.addEventListener('click', () => {
  client?.createRoom(els.room.value.trim() || 'demo');
});

els.join.addEventListener('click', () => {
  client?.joinRoom(els.room.value.trim() || 'demo');
});

els.ready.addEventListener('click', () => {
  client?.send({ type: 'ready', ready: true });
});

els.start.addEventListener('click', () => {
  client?.send({
    type: 'setup',
    setup: { map: 'DEMO', seed: SEED, deathmatch: 0 },
  });
  client?.send({ type: 'start' });
});

els.tick.addEventListener('click', async () => {
  if (!controller || !client) {
    return;
  }
  els.tick.disabled = true;
  try {
    // Burst-send is OK now (relay buffers), but wait so the log stays readable
    // and both tabs stay aligned if one side is slower.
    for (let i = 0; i < 8; i++) {
      const fwd = (client.playerId === 0 ? 1 : -1) * ((i % 4) + 1);
      const tick = controller.localTick(encodeTicCmd({ forwardmove: fwd }));
      await controller.waitForTick(tick);
    }
  } catch (err) {
    append(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    els.tick.disabled = false;
  }
});

/** @param {object} msg */
function onMsg(msg) {
  if (msg.type === 'joinRoom') {
    client.roomId = msg.roomId;
    client.playerId = msg.playerId;
    client.host = !!msg.host;
    append(`Joined room ${msg.roomId} as player ${msg.playerId}${msg.host ? ' (host)' : ''}`);
    els.ready.disabled = false;
    els.start.disabled = !msg.host;
    return;
  }

  if (msg.type === 'roomState') {
    append(`Room: ${msg.players?.length ?? 0} players, started=${msg.started}`);
    return;
  }

  if (msg.type === 'start') {
    playerMask = msg.playerMask;
    const session = new SimulationSession({
      maxPlayers: 4,
      localPlayer: client.playerId,
      playerMask,
      simulate: demoSimulate,
    });
    controller = new NetPlayController({
      session,
      sendInput: (tick, cmd) => client.sendInput(tick, cmd),
      recordReplay: true,
    });
    controller.begin(createDemoFrame(msg.seed ?? SEED), {
      seed: msg.seed ?? SEED,
      playerMask,
    });
    controller.onVerified = (snap) => {
      const detail = demoSnapshot(controller.session.verifiedFrame, playerMask);
      append(
        `tick ${snap.tick} checksum=${snap.checksum} rollbacks=${snap.rollbacks} `
        + JSON.stringify(detail.positions),
      );
    };
    append(`Match started seed=${msg.seed} mask=${playerMask}`);
    els.tick.disabled = false;
    return;
  }

  if (msg.type === 'confirmed') {
    controller?.onConfirmed(msg);
    return;
  }

  if (msg.type === 'error') {
    append(`ERROR: ${msg.message}`, 'bad');
  }
}
