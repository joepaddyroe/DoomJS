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
import { tickCorpseDebug } from '../game/debug/CorpseDebug.js';
import { createTicCmd } from '../game/TicCmd.js';

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
   * @param {import('../game/Player.js').Player[]} [options.players]
   * @param {number} [options.localPlayerIndex]
   * @param {string} [options.mapName]
   */
  constructor(level, player, sound = null, skill = 3, options = {}) {
    this.level = level;
    /** @type {(import('../game/Player.js').Player|null)[]} */
    this.players = options.players?.length ? options.players : [player];
    this.localPlayerIndex = options.localPlayerIndex ?? 0;
    this.player = this.players[this.localPlayerIndex] ?? player;
    this.mapName = options.mapName ?? 'E1M1';

    this.things = spawnMapThings(level, skill);
    this.pickups = new ItemPickup(sound);
    const playerMos = this.players.filter((p) => p).map((p) => p.mo);
    this.collision = new MapCollision(level, this.things, this.pickups, playerMos);
    this.collision.damagePlayer = this.player;
    this.collision.dropCtx = { level, things: this.things };
    this.missiles = new MissileManager(level, this.collision, sound, this.things, this.player);
    this.puffs = new PuffManager();
    this.hitscan = new Hitscan(this.collision, this.puffs, this.player);
    this.psprites = new Psprites(this.hitscan, sound, level, this.missiles);
    for (const p of this.players) {
      if (p) {
        this.psprites.setup(p);
      }
    }
    this.thinkers = new ThinkerList();
    this.specCtx = {
      thinkers: this.thinkers,
      sectors: level.sectors,
      textures: options.textures,
      switchPairs: options.textures ? buildSwitchPairs(options.textures) : new Map(),
      sound,
      collision: this.collision,
      onExitLevel: options.onExitLevel,
      playerMo: this.player.mo,
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

  /**
   * @param {import('../game/TicCmd.js').TicCmd| (import('../game/TicCmd.js').TicCmd|null)[]} cmdOrCmds
   */
  tick(cmdOrCmds) {
    const cmds = Array.isArray(cmdOrCmds) ? cmdOrCmds : [cmdOrCmds];

    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      if (!player || player.dead) {
        continue;
      }
      const cmd = cmds[i] ?? createTicCmd();
      player.cmd = cmd;
      player.leveltime++;
      if (player.reactiontime > 0) {
        player.reactiontime--;
      } else {
        PlayerMovement.move(player, cmd);
      }
    }

    // Floor/plat/door thinkers before movement (p_tick.c — P_RunThinkers before P_MobjThinker).
    this.thinkers.runAll();

    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      if (!player || player.dead) {
        continue;
      }
      const cmd = cmds[i] ?? createTicCmd();
      this.collision.damagePlayer = player;
      this.specCtx.playerMo = player.mo;
      this.hitscan.player = player;
      this.missiles.player = player;

      this.collision.xyMovement(player.mo, cmd);
      this.collision.zMovement(player);
      PlayerMovement.calcHeight(player);
      tickPlayerPowers(player);
      thinkPlayerSpecialSector(player);
      thinkUse(player, this.specCtx, this.collision);
      thinkWeaponChange(player);

      const monsterCtx = {
        player,
        collision: this.collision,
        hitscan: this.hitscan,
        missiles: this.missiles,
        things: this.things,
        sound: this.specCtx.sound,
        mapName: this.mapName,
        specCtx: this.specCtx,
        onExitLevel: () => this.specCtx.onExitLevel?.(false),
      };
      this.hitscan.monsterDeathCtx = monsterCtx;
      this.missiles.monsterDeathCtx = monsterCtx;

      this.psprites.think(player);
    }

    // Monsters once; look at all seats in order (deterministic for net).
    const local = this.player;
    const monsterCtx = {
      player: local,
      players: this.players,
      collision: this.collision,
      hitscan: this.hitscan,
      missiles: this.missiles,
      things: this.things,
      sound: this.specCtx.sound,
      mapName: this.mapName,
      specCtx: this.specCtx,
      onExitLevel: () => this.specCtx.onExitLevel?.(false),
    };
    this.hitscan.monsterDeathCtx = monsterCtx;
    this.missiles.monsterDeathCtx = monsterCtx;
    this.hitscan.player = local;
    this.missiles.player = local;

    tickMonsters(this.things, monsterCtx);
    this.missiles.tick(local);
    this.puffs.tick();
    tickCorpseDebug(this.things);

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

    const sectorIndex = local.mo.subsector?.sector?.index;
    if (typeof sectorIndex === 'number') {
      const sec = this.level.sectors[sectorIndex];
      if (sec?.special === 9 && !this.foundSecretSectors.has(sectorIndex)) {
        this.foundSecretSectors.add(sectorIndex);
        this.secrets++;
      }
    }
  }

  /** Remote player mobjs for billboards (exclude local). */
  remotePlayerMobjs() {
    /** @type {import('../game/Mobj.js').Mobj[]} */
    const list = [];
    for (let i = 0; i < this.players.length; i++) {
      if (i === this.localPlayerIndex) {
        continue;
      }
      const p = this.players[i];
      if (p?.mo && !p.dead) {
        list.push(p.mo);
      }
    }
    return list;
  }

  /** @returns {{ x: number, y: number, z: number, angle: number, extralight: number }} */
  view() {
    return this.player.view();
  }

  /**
   * Minimal end-of-level stats snapshot for intermission.
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
