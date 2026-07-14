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
import { MF_COUNTITEM, MF_COUNTKILL } from '../game/mobjFlags.js';
import { tickPlayerPowers, thinkPlayerSpecialSector } from '../game/PlayerPowers.js';

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
      collision: this.collision,
      onExitLevel: options.onExitLevel,
      playerMo: player.mo,
    };
    this.collision.specCtx = this.specCtx;

    // Intermission stats (wi_stuff.c single-player subset).
    this.totalKills = this.things.filter((t) => (t.flags & MF_COUNTKILL) !== 0).length;
    this.totalItems = this.things.filter((t) => (t.flags & MF_COUNTITEM) !== 0).length;
    this.totalSecrets = level.sectors.filter((s) => s.special === 9).length;

    this.kills = 0;
    this.items = 0;
    this.secrets = 0;
    /** @type {Set<number>} */
    this.foundSecretSectors = new Set();
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

    // Floor/plat/door thinkers before movement (p_tick.c — P_RunThinkers before P_MobjThinker).
    this.thinkers.runAll();

    collision.xyMovement(player.mo, cmd);
    collision.zMovement(player);
    PlayerMovement.calcHeight(player);
    tickPlayerPowers(player);
    thinkPlayerSpecialSector(player);
    thinkUse(player, this.specCtx, collision);
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

    // Update intermission counters.
    for (const thing of this.things) {
      if ((thing.flags & MF_COUNTKILL) !== 0 && (thing.health ?? 1) <= 0 && !thing._countedKill) {
        thing._countedKill = true;
        this.kills++;
      }
      if ((thing.flags & MF_COUNTITEM) !== 0 && thing.removed && !thing._countedItem) {
        thing._countedItem = true;
        this.items++;
      }
    }

    const sectorIndex = player.mo.subsector?.sector?.index;
    if (typeof sectorIndex === 'number') {
      const sec = this.level.sectors[sectorIndex];
      if (sec?.special === 9 && !this.foundSecretSectors.has(sectorIndex)) {
        this.foundSecretSectors.add(sectorIndex);
        this.secrets++;
      }
    }
  }

  /** @returns {{ x: number, y: number, z: number, angle: number, extralight: number }} */
  view() {
    return this.player.view();
  }

  /**
   * Minimal end-of-level stats snapshot for intermission.
   * Doom has richer bookkeeping (kills/items/secrets totals), but DoomJS
   * doesn't track those yet — we approximate what we can from live mobjs.
   */
  endStats() {
    return {
      kills: { killed: this.kills, total: this.totalKills },
      items: { found: this.items, total: this.totalItems },
      secrets: { found: this.secrets, total: this.totalSecrets },
      timeTics: this.player.leveltime,
    };
  }
}
