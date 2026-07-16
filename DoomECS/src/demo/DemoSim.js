import { World } from '../ecs/World.js';
import { Frame } from '../frame/Frame.js';
import { decodeTicCmd } from '../input/TicCmdCodec.js';

/**
 * Tiny shared demo world used by relay e2e / browser net demo.
 * Not Doom — proves deterministic checksums across peers.
 */

export const DEMO_COMPONENTS = {
  /** @type {{ createDefault: () => { x: number, y: number }, cloneValue: (v: {x:number,y:number}) => {x:number,y:number} }} */
  position: {
    createDefault: () => ({ x: 0, y: 0 }),
    cloneValue: (v) => ({ x: v.x, y: v.y }),
  },
};

/** @returns {World} */
export function createDemoWorld() {
  const world = new World();
  world.registerComponent('position', DEMO_COMPONENTS.position);
  return world;
}

/**
 * @param {number} [seed=1]
 * @returns {Frame}
 */
export function createDemoFrame(seed = 1) {
  return Frame.create(0, { seed, world: createDemoWorld() });
}

/**
 * Each seated player's forwardmove adds to that player's entity x.
 * RNG advances once per tick (shared) so checksums stay locked.
 *
 * @type {import('../session/SimulationSession.js').SimulateFn}
 */
export function demoSimulate(frame, inputs, playerMask) {
  const store = frame.world.store('position');
  /** @type {number[]} */
  let entities = frame.world.getResource('playerEntities');
  if (!entities) {
    entities = [];
    for (let p = 0; p < inputs.length; p++) {
      if ((playerMask & (1 << p)) === 0) {
        entities.push(-1);
        continue;
      }
      const id = frame.world.createEntity();
      store.set(id, { x: 0, y: 0 });
      entities.push(id);
    }
    frame.world.setResource('playerEntities', entities);
  }

  // Shared RNG step so both peers stay in lockstep even with idle players.
  const bump = frame.rng.nextInt(5);

  for (let p = 0; p < inputs.length; p++) {
    if ((playerMask & (1 << p)) === 0) {
      continue;
    }
    const entity = entities[p];
    const cmd = decodeTicCmd(inputs[p]);
    const pos = store.get(entity);
    pos.x += cmd.forwardmove;
    pos.y += bump;
    store.set(entity, pos);
  }
}

/**
 * @param {Frame} frame
 * @param {number} playerMask
 * @returns {{ tick: number, checksum: number, positions: { playerId: number, x: number, y: number }[] }}
 */
export function demoSnapshot(frame, playerMask) {
  const entities = frame.world.getResource('playerEntities') ?? [];
  const store = frame.world.stores.has('position') ? frame.world.store('position') : null;
  /** @type {{ playerId: number, x: number, y: number }[]} */
  const positions = [];
  if (store) {
    for (let p = 0; p < entities.length; p++) {
      if ((playerMask & (1 << p)) === 0 || entities[p] < 0) {
        continue;
      }
      const pos = store.get(entities[p]);
      positions.push({ playerId: p, x: pos.x, y: pos.y });
    }
  }
  return {
    tick: frame.tick,
    checksum: frame.checksum(),
    positions,
  };
}
