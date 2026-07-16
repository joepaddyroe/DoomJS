# DoomJSRelay

Thin **WebSocket input relay** for DoomJS Quantum-style multiplayer.

Does **not** run the Doom simulation. Clients run `DoomECS` / game logic locally; this process only:

1. Creates / joins rooms (max 4 players)
2. Host publishes setup (map, skill, seed, deathmatch, …)
3. Collects per-tick input blobs from every seat
4. Broadcasts **confirmed** input sets when a tick is complete

## Run

```bash
cd DoomJSRelay
npm install
npm start
```

Listens on `ws://127.0.0.1:7777` (override with `PORT`).

## Protocol (JSON)

| Type | Direction | Purpose |
|------|-----------|---------|
| `hello` | S→C | `clientId`, protocol version |
| `createRoom` / `joinRoom` | C→S | Lobby |
| `roomState` | S→C | Players, host, setup, mask |
| `setup` | C→S | Host-only match config |
| `ready` / `start` | C→S | Lobby → match |
| `input` | C→S | `{ tick, cmd: number[8] }` |
| `confirmed` | S→C | `{ tick, inputs, playerMask }` |
| `leave` / `error` / `ping`/`pong` | — | Lifecycle |

`cmd` is the 8-byte ticcmd from `DoomECS` (`encodeTicCmd`) as a JSON array.

## With DoomECS

```
Client predict → send input(tick, cmd)
Relay waits for all players on tick
Relay broadcasts confirmed
Client SimulationSession.confirmFrame(tick, inputs)
  → rollback if prediction wrong
```

## Two-player demo (automated)

Starts an ephemeral relay, connects host + guest, runs 24 demo-sim ticks, asserts checksums match:

```bash
npm run demo
# or
npm test
```

## Browser demos

Serve from **DoomJS root** (folder with `index.html`), not this package:

```bash
cd DoomJSRelay && npm start          # terminal A
cd DoomJS && python -m http.server 8080   # terminal B
```

| Demo | URL |
|------|-----|
| Toy ECS checksum | http://127.0.0.1:8080/demo/net-demo.html |
| Real Doom lockstep | http://127.0.0.1:8080/index.html?net=1 |

**Doom lockstep:** Connect → Create/Join → Ready → Start (host). Both peers load the map and exchange ticcmds each tick.

## Tests

```bash
npm test
```
