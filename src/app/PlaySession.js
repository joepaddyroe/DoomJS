import { MapCollision } from '../game/MapCollision.js';
import { PlayerMovement } from '../game/PlayerMovement.js';
import { Hitscan } from '../game/Hitscan.js';
import { Psprites } from '../game/weapons/Psprites.js';
import { thinkUse, thinkWeaponChange } from '../game/PlayerThink.js';
import { ThinkerList } from '../game/spec/ThinkerList.js';
import { PuffManager } from '../render/BillboardRenderer.js';
import { spawnMapThings } from '../game/MapThingSpawner.js';
import { ItemPickup } from '../game/ItemPickup.js';
import { tickMonsters } from '../game/monster/MonsterThink.js';
import { MissileManager } from '../game/monster/MissileManager.js';
import { buildSwitchPairs } from '../game/spec/SwitchList.js';

/**
 * Active play state: player simulation + view for rendering.
 */
export class PlaySession {
  /**
   * @param {import('../game/Level.js').Level} level
   * @param {import('../game/Player.js').Player} player
   * @param {import('../audio/SoundSystem.js').SoundSystem|null} [sound]
   * @param {number} [skill=3]
   * @param {object} [options]
   * @param {import('../render/TextureManager.js').TextureManager} [options.textures]
   * @param {(secret?: boolean) => void} [options.onExitLevel]
   */
  constructor(level, player, sound = null, skill = 3, options = {}) {
    this.level = level;
    this.player = player;
    this.things = spawnMapThings(level, skill);
    this.pickups = new ItemPickup(sound);
    this.collision = new MapCollision(level, this.things, this.pickups, player.mo);
    this.collision.damagePlayer = player;
    this.collision.dropCtx = { level, things: this.things };
    this.missiles = new MissileManager(level, this.collision, sound);
    this.puffs = new PuffManager();
    this.hitscan = new Hitscan(this.collision, this.puffs, player);
    this.psprites = new Psprites(this.hitscan, sound, level);
    this.psprites.setup(player);
    this.thinkers = new ThinkerList();
    this.specCtx = {
      thinkers: this.thinkers,
      sectors: level.sectors,
      textures: options.textures,
      switchPairs: options.textures ? buildSwitchPairs(options.textures) : new Map(),
      sound,
      onExitLevel: options.onExitLevel,
    };
    this.collision.specCtx = this.specCtx;
  }

  /** @param {import('../game/TicCmd.js').TicCmd} cmd */
  tick(cmd) {
    const { player, collision } = this;

    if (player.dead) {
      return;
    }

    player.cmd = cmd;
    player.leveltime++;

    if (player.reactiontime > 0) {
      player.reactiontime--;
    } else {
      PlayerMovement.move(player, cmd);
    }

    collision.xyMovement(player.mo, cmd);
    collision.zMovement(player);
    PlayerMovement.calcHeight(player);
    thinkUse(player, this.specCtx, collision);
    this.thinkers.runAll();
    thinkWeaponChange(player);
    this.psprites.think(player);
    tickMonsters(this.things, {
      player,
      collision,
      hitscan: this.hitscan,
      missiles: this.missiles,
      things: this.things,
      sound: this.specCtx.sound,
    });
    this.missiles.tick(player);
    this.puffs.tick();
  }

  /** @returns {{ x: number, y: number, z: number, angle: number, extralight: number }} */
  view() {
    return this.player.view();
  }
}
