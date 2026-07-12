import { MapCollision } from '../game/MapCollision.js';
import { PlayerMovement } from '../game/PlayerMovement.js';

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
  }

  /** @param {import('../game/TicCmd.js').TicCmd} cmd */
  tick(cmd) {
    const { player, collision } = this;

    if (player.reactiontime > 0) {
      player.reactiontime--;
    } else {
      PlayerMovement.move(player, cmd);
    }

    collision.xyMovement(player.mo, cmd);
    collision.zMovement(player);
    PlayerMovement.calcHeight(player);
  }

  /** @returns {{ x: number, y: number, z: number, angle: number }} */
  view() {
    return this.player.view();
  }
}
