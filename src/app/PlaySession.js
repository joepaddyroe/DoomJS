import { MapCollision } from '../game/MapCollision.js';
import { PlayerMovement } from '../game/PlayerMovement.js';
import { Hitscan } from '../game/Hitscan.js';
import { Psprites } from '../game/weapons/Psprites.js';
import { thinkWeaponChange } from '../game/PlayerThink.js';
import { PuffManager } from '../render/BillboardRenderer.js';

/**
 * Active play state: player simulation + view for rendering.
 */
export class PlaySession {
  /**
   * @param {import('../game/Level.js').Level} level
   * @param {import('../game/Player.js').Player} player
   */
  constructor(level, player) {
    this.level = level;
    this.player = player;
    this.collision = new MapCollision(level);
    this.puffs = new PuffManager();
    this.hitscan = new Hitscan(this.collision, this.puffs);
    this.psprites = new Psprites(this.hitscan);
    this.psprites.setup(player);
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
    thinkWeaponChange(player);
    this.psprites.think(player);
    this.puffs.tick();
  }

  /** @returns {{ x: number, y: number, z: number, angle: number, extralight: number }} */
  view() {
    return this.player.view();
  }
}
