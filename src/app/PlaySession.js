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

/**
 * Active play state: player simulation + view for rendering.
 */
export class PlaySession {
  /**
   * @param {import('../game/Level.js').Level} level
   * @param {import('../game/Player.js').Player} player
   * @param {import('../audio/SoundSystem.js').SoundSystem|null} [sound]
   */
  constructor(level, player, sound = null) {
    this.level = level;
    this.player = player;
    this.things = spawnMapThings(level);
    this.pickups = new ItemPickup(sound);
    this.collision = new MapCollision(level, this.things, this.pickups, player.mo);
    this.puffs = new PuffManager();
    this.hitscan = new Hitscan(this.collision, this.puffs, player);
    this.psprites = new Psprites(this.hitscan, sound, level);
    this.psprites.setup(player);
    this.thinkers = new ThinkerList();
    this.doorCtx = {
      thinkers: this.thinkers,
      sectors: level.sectors,
      sound,
    };
  }

  /** @param {import('../game/TicCmd.js').TicCmd} cmd */
  tick(cmd) {
    const { player, collision } = this;

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
    thinkUse(player, this.doorCtx, collision);
    this.thinkers.runAll();
    thinkWeaponChange(player);
    this.psprites.think(player);
    tickMonsters(this.things, {
      player,
      collision,
      hitscan: this.hitscan,
    });
    this.puffs.tick();
  }

  /** @returns {{ x: number, y: number, z: number, angle: number, extralight: number }} */
  view() {
    return this.player.view();
  }
}
