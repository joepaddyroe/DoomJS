# DoomECS

Deterministic ECS and **Quantum-style input session** for DoomJS.

This package is **optional**. The existing browser game under `src/` does not import it. Use it when wiring multiplayer, lockstep, or action replay.

## Goals

- **Deterministic simulation** — same inputs → same frames (checksum / replay)
- **Inputs only on the wire** — world state is local; relay fans out confirmed inputs
- **Predict / rollback** — simulate ahead with predicted remote inputs; restore verified frame when the relay confirms
- **Action replay** — record confirmed input streams and play them back offline

## Layout

```
DoomECS/src/
  ecs/          World, sparse component stores (TypedArray-backed)
  frame/        Frame snapshots (cloneable for rollback)
  input/        Binary input commands + buffers
  session/      SimulationSession (verified + predicted)
  rng/          Seeded deterministic PRNG
  checksum/     FNV-1a over frame blobs
```

## Quick mental model (Photon Quantum–like)

1. Each client runs the same sim systems.
2. Local input is predicted immediately.
3. `DoomJSRelay` confirms ordered inputs per frame.
4. On mismatch with prediction → restore last **verified** frame → re-simulate.
5. Replay = feed the same confirmed input tape into a fresh session.

## Usage (standalone)

```js
import {
  World,
  Frame,
  SimulationSession,
  encodeTicCmd,
  decodeTicCmd,
  DeterministicRng,
} from '@doomjs/ecs';

function simulate(frame, inputs) {
  // Your game systems mutate frame.world using inputs[playerId]
  frame.tick += 1;
}

const session = new SimulationSession({
  maxPlayers: 4,
  simulate,
  predictRemoteInput: () => encodeTicCmd({ forwardmove: 0, sidemove: 0, angleturn: 0, buttons: 0 }),
});

session.reset(Frame.create(0, { seed: 1 }));
session.submitLocalInput(0, encodeTicCmd({ forwardmove: 10, sidemove: 0, angleturn: 0, buttons: 0 }));
session.predict(); // advance predicted head
session.confirmFrame(0, [/* Uint8Array per player */]);
```

## Tests

```bash
cd DoomECS
npm test
```

## Relay e2e

See `DoomJSRelay` (`npm run demo`) for a two-client checksum lockstep run using `demoSimulate`.

## Non-goals (v0.1)

- Not hooked into `Game.js` / `PlaySession` yet
- Not a full Doom mobj ECS migration
- Relay transport lives in sibling package `DoomJSRelay/`
