import { SCREENHEIGHT, SCREENWIDTH, SBARHEIGHT } from '../core/renderConstants.js';
import { BT_ATTACK } from '../core/inputButtons.js';
import { MapLoader } from '../game/MapLoader.js';
import { Level } from '../game/Level.js';
import { Player } from '../game/Player.js';
import { startPlayerDeath, tickPlayerDeath } from '../game/PlayerDeath.js';
import { PlaySession } from './PlaySession.js';
import { TitleScene } from './TitleScene.js';
import { LevelIntroScene } from './LevelIntroScene.js';
import { IntermissionStatsScene } from './IntermissionStatsScene.js';
import { BspRenderer } from '../render/BspRenderer.js';
import { Automap } from '../render/Automap.js';
import { ViewBorder } from '../render/ViewBorder.js';
import { computeViewSize, screenBlocksFromMenuSize } from '../render/ViewSize.js';
import { createTrigTables } from '../math/tables.js';
import { nextMapName } from '../game/MapNames.js';
import { MenuController } from '../ui/MenuController.js';
import { WipeMelt } from '../ui/WipeMelt.js';
import { SaveGameStore } from './SaveGameStore.js';
import { spawnMapThing } from '../game/MapThingSpawner.js';
import { FRACUNIT } from '../core/renderConstants.js';
import { statusPaletteIndex } from '../render/StatusPalette.js';
import { SFX_VOLUME } from '../audio/SfxRegistry.js';
import { resetGameRandom } from '../game/GameRandom.js';

/** @typedef {'title' | 'levelIntro' | 'intermission' | 'playing' | 'wipe'} GamePhase */

/**
 * Top-level game state machine (g_game.c subset).
 */
export class Game {
  /**
   * @param {object} deps
   * @param {import('../wad/WadFile.js').WadFile} deps.wad
   * @param {import('../wad/GameAssets.js').GameAssets} deps.assets
   * @param {import('../render/TextureManager.js').TextureManager} deps.textures
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} deps.renderer
   * @param {import('../wad/SpritePatches.js').SpritePatches} deps.spritePatches
   * @param {import('../render/BillboardRenderer.js').BillboardRenderer} deps.billboardRenderer
   * @param {import('../wad/SpritePatches.js').PspriteRenderer} deps.pspriteRenderer
   * @param {import('../render/StatusBar.js').StatusBar} deps.statusBar
   * @param {import('../audio/SoundSystem.js').SoundSystem|null} deps.sound
   * @param {import('../audio/MusicSystem.js').MusicSystem|null} [deps.music]
   * @param {string} [deps.mapName='E1M1']
   */
  constructor(deps) {
    this.wad = deps.wad;
    this.assets = deps.assets;
    this.textures = deps.textures;
    this.renderer = deps.renderer;
    this.spritePatches = deps.spritePatches;
    this.billboardRenderer = deps.billboardRenderer;
    this.pspriteRenderer = deps.pspriteRenderer;
    this.statusBar = deps.statusBar;
    this.sound = deps.sound;
    this.music = deps.music ?? null;
    this.mapName = deps.mapName ?? 'E1M1';
    this.trigTables = createTrigTables();

    /** @type {GamePhase} */
    this.phase = 'title';
    this.skill = 3;

    this.menu = new MenuController(this.wad, this.sound, this.music);
    this.saveStore = new SaveGameStore();
    this.menu.setSaveSystem({
      listSlotNames: () => this.saveStore.listSlotNames(),
      saveSlot: (slot) => this.saveToSlot(slot),
      loadSlot: (slot) => this.loadFromSlot(slot),
    });
    this.titleScene = new TitleScene(this.wad, this.menu);
    /** @type {LevelIntroScene|null} */
    this.levelIntro = null;
    /** @type {IntermissionStatsScene|null} */
    this.intermission = null;

    /** @type {{ effect: WipeMelt, nextPhase: GamePhase }|null} */
    this.wipe = null;

    /** @type {import('../game/MapLoader.js').DoomMap|null} */
    this.map = null;
    /** @type {import('../render/BspRenderer.js').BspRenderer|null} */
    this.bspRenderer = null;
    /** @type {PlaySession|null} */
    this.playSession = null;

    this.automap = new Automap();
    this.automapVisible = false;
    /** @type {string|null} */
    this._viewLayoutKey = null;
    this.viewLayout = computeViewSize(
      screenBlocksFromMenuSize(this.menu.screenSize),
      this.menu.detailLevel,
    );
    this.viewBorder = new ViewBorder(this.wad, this.textures);

    /** @type {import('../net/NetGameSession.js').NetGameSession|null} */
    this.net = null;

    // Start title music (will begin after unlock).
    this.music?.startMenuMusic();
  }

  /**
   * Attach optional net lockstep session (?net=1).
   * @param {import('../net/NetGameSession.js').NetGameSession} session
   */
  setNetSession(session) {
    this.net = session;
  }

  /**
   * Both peers call this when relay broadcasts `start`.
   * @param {object} msg
   */
  beginNetMatch(msg) {
    const setup = msg.setup ?? {};
    this.mapName = setup.map || this.mapName || 'E1M1';
    this.skill = setup.skill ?? this.skill ?? 3;
    this.menu.close();
    // Same P_Random stream on every peer before any sim tic.
    resetGameRandom(setup.seed ?? msg.seed ?? 0);
    this.map = MapLoader.load(this.wad, this.mapName);
    this.beginPlay();
    this.phase = 'playing';
    this.music?.startLevelMusic(this.mapName);
  }

  saveToSlot(slot) {
    if (this.phase !== 'playing' || !this.playSession) {
      this.sound?.start('oof');
      return;
    }

    const payload = this.serializeSave();
    const name = `${payload.mapName} ${formatTime((payload.player.leveltime / 35) | 0)}`;
    this.saveStore.save(slot, name, payload);
    this.sound?.start('itemup');
  }

  loadFromSlot(slot) {
    const payload = this.saveStore.load(slot);
    if (!payload) {
      this.sound?.start('oof');
      return;
    }
    try {
      this.deserializeSave(payload);
      this.sound?.start('itemup');
    } catch (e) {
      console.error(e);
      this.sound?.start('oof');
    }
  }

  serializeSave() {
    const ps = this.playSession;
    const player = ps.player;
    const mo = player.mo;

    return {
      version: 1,
      mapName: this.mapName,
      skill: this.skill,
      player: {
        x: mo.x,
        y: mo.y,
        z: mo.z,
        angle: mo.angle,
        health: player.health,
        armorpoints: player.armorpoints,
        armortype: player.armortype,
        backpack: player.backpack,
        ammo: [...player.ammo],
        maxammo: [...player.maxammo],
        weaponowned: [...player.weaponowned],
        readyweapon: player.readyweapon,
        pendingweapon: player.pendingweapon,
        cards: [...player.cards],
        leveltime: player.leveltime,
      },
      things: ps.things.map((t) => ({
        mapType: t.mapType ?? null,
        x: t.x,
        y: t.y,
        z: t.z,
        angle: t.angle,
        momx: t.momx,
        momy: t.momy,
        health: t.health,
        removed: t.removed,
        flags: t.flags,
        radius: t.radius,
        height: t.height,
        sprite: t.sprite,
        frame: t.frame,
        monsterType: t.monsterType,
        state: t.state,
        stateTics: t.stateTics,
      })),
      stats: {
        kills: ps.kills,
        items: ps.items,
        secrets: ps.secrets,
        foundSecretSectors: [...ps.foundSecretSectors],
      },
    };
  }

  deserializeSave(payload) {
    this.skill = payload.skill ?? 3;
    this.mapName = payload.mapName ?? 'E1M1';

    // Rebuild map + runtime level.
    this.map = MapLoader.load(this.wad, this.mapName);
    const level = Level.fromMap(this.map, this.textures, this.map.blockmap);
    const playerStart = MapLoader.findPlayerStart(this.map);
    if (!playerStart) {
      throw new Error('No player start found on map');
    }

    // Ensure gameplay view size for RenderContext.
    this._viewLayoutKey = null;

    const player = Player.fromStart(playerStart, level);
    this.bspRenderer = new BspRenderer(level, this.textures, this.renderer, this.assets.colormaps);
    this.automap = new Automap();
    this.automapVisible = false;
    this.applyViewLayout();
    this.automap.seedPlayer(player);
    this.playSession = new PlaySession(level, player, this.sound, this.skill, {
      textures: this.textures,
      onExitLevel: (secret) => this.completeLevel(secret),
      mapName: this.mapName,
    });

    // Apply player snapshot.
    const p = payload.player ?? {};
    Object.assign(player, {
      health: p.health ?? player.health,
      armorpoints: p.armorpoints ?? player.armorpoints,
      armortype: p.armortype ?? player.armortype,
      backpack: p.backpack ?? player.backpack,
      readyweapon: p.readyweapon ?? player.readyweapon,
      pendingweapon: p.pendingweapon ?? player.pendingweapon,
      leveltime: p.leveltime ?? player.leveltime,
    });
    if (Array.isArray(p.ammo)) player.ammo = [...p.ammo];
    if (Array.isArray(p.maxammo)) player.maxammo = [...p.maxammo];
    if (Array.isArray(p.weaponowned)) player.weaponowned = [...p.weaponowned];
    if (Array.isArray(p.cards)) player.cards = [...p.cards];

    player.mo.x = p.x ?? player.mo.x;
    player.mo.y = p.y ?? player.mo.y;
    player.mo.angle = p.angle ?? player.mo.angle;
    player.mo.subsector = level.findSubsector(player.mo.x, player.mo.y);
    player.mo.floorz = player.mo.subsector?.sector?.floorHeight ?? player.mo.floorz;
    player.mo.ceilingz = player.mo.subsector?.sector?.ceilingHeight ?? player.mo.ceilingz;
    // Snap to floor to avoid embedding in geometry when loading (p_mobj.c / P_ZMovement).
    player.mo.z = player.mo.floorz;
    player.viewz = player.mo.z + player.viewheight;

    // Apply thing snapshots by index (Phase 1 assumption: spawn order matches).
    if (Array.isArray(payload.things)) {
      const baseCount = this.playSession.things.length;
      const applyThing = (dst, src) => {
        Object.assign(dst, src);
        dst.subsector = level.findSubsector(dst.x, dst.y);
        dst.floorz = dst.subsector?.sector?.floorHeight ?? dst.floorz;
        dst.ceilingz = dst.subsector?.sector?.ceilingHeight ?? dst.ceilingz;
        if (typeof dst.z === 'number') {
          if (dst.z < dst.floorz) dst.z = dst.floorz;
          if (dst.z + dst.height > dst.ceilingz) dst.z = dst.ceilingz - dst.height;
        }
      };

      // Apply to existing spawned things (map things).
      const count = Math.min(baseCount, payload.things.length);
      for (let i = 0; i < count; i++) {
        applyThing(this.playSession.things[i], payload.things[i]);
      }

      // If the save contains additional things (e.g. dropped pickups), recreate them.
      for (let i = baseCount; i < payload.things.length; i++) {
        const src = payload.things[i];
        const mapType = src?.mapType;
        if (typeof mapType !== 'number') {
          continue;
        }
        // Spawn a matching thing and then apply the saved runtime fields.
        const spawned = spawnMapThing(level, {
          x: src.x / FRACUNIT,
          y: src.y / FRACUNIT,
          angle: 0,
          type: mapType,
          options: 0,
        });
        if (spawned) {
          applyThing(spawned, src);
          this.playSession.things.push(spawned);
        }
      }
    }

    // Restore counters (so intermission stats stay consistent after load).
    const st = payload.stats ?? {};
    this.playSession.kills = st.kills ?? this.playSession.kills;
    this.playSession.items = st.items ?? this.playSession.items;
    this.playSession.secrets = st.secrets ?? this.playSession.secrets;
    if (Array.isArray(st.foundSecretSectors)) {
      this.playSession.foundSecretSectors = new Set(st.foundSecretSectors);
    }

    this.statusBar.resetForPlayer(player);
    this.menu.setUsergame(true);
    this.phase = 'playing';
    this.menu.close();
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tick(input) {
    // Vanilla: Escape pops up the menu from most game states.
    if (!this.menu.active && input.consumeJustPressed('Escape')) {
      this.menu.open();
      this.sound?.start('swtchn');
    }

    switch (this.phase) {
      case 'title':
        this.titleScene.tick(input);
        this.menu.tick(input);
        this.handleMenuAction(this.menu.consumeAction());
        break;

      case 'levelIntro':
        this.menu.tick(input);
        this.handleMenuAction(this.menu.consumeAction());
        if (!this.menu.active && this.levelIntro?.tick(input)) {
          // Build the play session first so the wipe target is the actual 3D view.
          this.beginPlay();
          this.startWipeTo('playing', () => this.renderPlay());
        }
        break;

      case 'intermission':
        this.menu.tick(input);
        this.handleMenuAction(this.menu.consumeAction());
        if (!this.menu.active && this.intermission?.tick(input)) {
          this.intermission = null;
          this.beginLevelIntro();
          this.startWipeTo('levelIntro', () => {
            this.renderer.initBuffer(SCREENWIDTH, SCREENHEIGHT);
            this.levelIntro?.draw(this.renderer);
          });
        }
        break;

      case 'playing':
        this.menu.tick(input);
        this.handleMenuAction(this.menu.consumeAction());
        if (this.menu.active) {
          break;
        }
        if (this.playSession) {
          const player = this.playSession.player;
          if (!this.menu.active) {
            this.automap.notePlayerSector(player);
            if (input.consumeJustPressed('Tab')) {
              this.automapVisible = !this.automapVisible;
            }
          }
          const cmd = input.buildTicCmd();
          player.attacking = (cmd.buttons & BT_ATTACK) !== 0;

          if (this.net?.active) {
            this.tickNetPlaying(cmd);
          } else if (!player.dead) {
            const damageBefore = player.damagecount;
            this.playSession.tick(cmd);
            if (player.damagecount > damageBefore) {
              this.sound?.start('plpain', { volume: SFX_VOLUME.plpain });
            }
            this.statusBar.tick(player);
            if (player.health <= 0) {
              startPlayerDeath(player, this.playSession.psprites, this.sound);
            }
          } else {
            this.statusBar.tick(player);
            if (tickPlayerDeath(player, cmd, this.playSession.psprites)) {
              this.beginPlay();
            }
          }
        }
        break;

      case 'wipe':
        this.wipe?.effect.tick(1);
        if (this.wipe?.effect.done) {
          this.phase = this.wipe.nextPhase;
          this.wipe = null;
        }
        break;

      default:
        break;
    }

    input.endFrame();
  }

  /** @param {import('../ui/MenuController.js').MenuAction} action */
  handleMenuAction(action) {
    if (!action) {
      return;
    }

    if (action.type === 'startGame') {
      // Fresh new game requested from any state.
      this.wipe = null;
      this.intermission = null;
      this.levelIntro = null;
      this.playSession = null;
      this.bspRenderer = null;
      this.map = null;
      this.menu.setUsergame(false);

      this.skill = action.skill;
      this.mapName = action.mapName;
      this.beginLevelIntro();
      return;
    }

    if (action.type === 'returnTitle') {
      this.returnToTitle();
    }
  }

  /** @returns {Uint8ClampedArray} PLAYPAL entry for the current frame. */
  getFramePalette() {
    if (this.phase === 'playing' && this.playSession) {
      return this.assets.getPalette(statusPaletteIndex(this.playSession.player));
    }
    return this.assets.palette;
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  frame(input) {
    switch (this.phase) {
      case 'title':
        this.renderer.initBuffer(SCREENWIDTH, SCREENHEIGHT);
        this.titleScene.draw(this.renderer);
        break;

      case 'levelIntro':
        this.renderer.initBuffer(SCREENWIDTH, SCREENHEIGHT);
        this.levelIntro?.draw(this.renderer);
        this.menu.draw(this.renderer);
        break;

      case 'intermission':
        this.renderer.initBuffer(SCREENWIDTH, SCREENHEIGHT);
        this.intermission?.draw(this.renderer);
        this.menu.draw(this.renderer);
        break;

      case 'playing':
        this.renderPlay(input);
        this.menu.draw(this.renderer);
        break;

      case 'wipe':
        this.renderer.initBuffer(SCREENWIDTH, SCREENHEIGHT);
        if (this.wipe) {
          this.wipe.effect.draw(this.renderer.pixels);
        }
        break;

      default:
        break;
    }
  }

  /**
   * Create a melt wipe from the current screen to a target screen.
   * @param {GamePhase} nextPhase
   * @param {() => void} drawTarget
   */
  startWipeTo(nextPhase, drawTarget) {
    const startPixels = new Uint8Array(this.renderer.pixels);

    // Draw target once into the same framebuffer and snapshot it.
    drawTarget();
    const endPixels = new Uint8Array(this.renderer.pixels);

    this.wipe = { effect: new WipeMelt(startPixels, endPixels), nextPhase };
    this.phase = 'wipe';
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} [input] */
  renderPlay(input) {
    if (!this.bspRenderer || !this.playSession) {
      return;
    }

    const layout = this.applyViewLayout();
    const automapActive = !this.menu.active && this.automapVisible;

    this.renderer.clear(0);

    if (automapActive) {
      const mapHeight = layout.showStatusBar ? SCREENHEIGHT - SBARHEIGHT : SCREENHEIGHT;
      this.automap.draw(
        this.renderer,
        this.playSession.level,
        this.playSession.player,
        this.playSession.things,
        mapHeight,
      );
    } else {
      if (layout.scaledViewWidth < SCREENWIDTH) {
        this.viewBorder.draw(this.renderer.pixels, layout);
      }

      this.renderer.initBuffer(layout.scaledViewWidth, layout.viewHeight);
      this.renderer.setViewMetrics(layout.detailShift, layout.viewWidth);

      this.bspRenderer.renderView(this.playSession.view());

      const { drawSegs, drawSegCount } = this.bspRenderer.ctx;
      const view = this.playSession.view();
      const extralight = this.playSession.player.extralight;

      this.billboardRenderer.drawThings(
        [
          ...this.playSession.things,
          ...this.playSession.missiles.missiles,
          ...this.playSession.remotePlayerMobjs(),
        ],
        view,
        this.bspRenderer.ctx.viewSetup,
        this.trigTables,
        drawSegs,
        drawSegCount,
        this.bspRenderer.walls,
        extralight,
      );
      this.billboardRenderer.drawPuffs(
        this.playSession.puffs.puffs,
        view,
        this.bspRenderer.ctx.viewSetup,
        this.trigTables,
        drawSegs,
        drawSegCount,
        this.bspRenderer.walls,
        extralight,
      );

      this.bspRenderer.walls.renderAllMaskedSegs();

      if (!this.playSession.player.dead) {
        this.pspriteRenderer.draw(this.playSession.player, extralight);
      }
    }

    if (layout.showStatusBar) {
      this.statusBar.draw(this.renderer, this.playSession.player);
    }
  }

  applyViewLayout() {
    const layout = computeViewSize(
      screenBlocksFromMenuSize(this.menu.screenSize),
      this.menu.detailLevel,
    );
    const key = `${layout.scaledViewWidth},${layout.viewHeight},${layout.detailShift},${layout.viewWidth}`;
    if (this._viewLayoutKey !== key) {
      if (this.bspRenderer) {
        this.bspRenderer.resizeView(layout.viewWidth, layout.viewHeight, layout.detailShift);
      }
      this._viewLayoutKey = key;
    }
    this.viewLayout = layout;
    return layout;
  }

  beginLevelIntro() {
    this.map = MapLoader.load(this.wad, this.mapName);
    this.levelIntro = new LevelIntroScene(this.wad, this.mapName);
    this.phase = 'levelIntro';
    this.music?.startLevelMusic(this.mapName);
  }

  /**
   * @param {import('../game/TicCmd.js').TicCmd} localCmd
   */
  tickNetPlaying(localCmd) {
    const net = this.net;
    const session = this.playSession;
    if (!net || !session) {
      return;
    }

    net.offerLocalCmd(localCmd);
    const verified = net.pollVerified();
    if (!verified) {
      // Stall sim until all peers' inputs for this tick are confirmed.
      this.statusBar.tick(session.player);
      return;
    }

    const player = session.player;
    const damageBefore = player.damagecount;
    session.tick(verified.cmds);

    for (const p of session.players) {
      if (!p || p.dead) {
        continue;
      }
      if (p.health <= 0) {
        startPlayerDeath(p, session.psprites, this.sound);
      }
    }

    if (player.damagecount > damageBefore) {
      this.sound?.start('plpain', { volume: SFX_VOLUME.plpain });
    }
    this.statusBar.tick(player);
  }

  beginPlay() {
    if (!this.map) {
      this.map = MapLoader.load(this.wad, this.mapName);
    }

    // Ensure the renderer view size matches gameplay before creating RenderContext.
    this._viewLayoutKey = null;
    this.automap = new Automap();
    this.automapVisible = false;

    const level = Level.fromMap(this.map, this.textures, this.map.blockmap);

    /** @type {(import('../game/Player.js').Player|null)[]} */
    let players;
    let localIndex = 0;

    if (this.net?.active) {
      const starts = MapLoader.findPlayerStarts(this.map);
      const fallback = starts.find(Boolean) ?? MapLoader.findPlayerStart(this.map);
      if (!fallback) {
        throw new Error('No player start found on map');
      }
      const mask = this.net.playerMask;
      localIndex = this.net.localPlayer;
      players = [];
      for (let i = 0; i < 4; i++) {
        if ((mask & (1 << i)) === 0) {
          players.push(null);
          continue;
        }
        const thing = starts[i] ?? {
          ...fallback,
          x: fallback.x + i * 32,
          y: fallback.y,
        };
        players.push(Player.fromStart(thing, level));
      }
    } else {
      const playerStart = MapLoader.findPlayerStart(this.map);
      if (!playerStart) {
        throw new Error('No player start found on map');
      }
      players = [Player.fromStart(playerStart, level)];
    }

    const player = players[localIndex];
    if (!player) {
      throw new Error('Local player seat missing');
    }

    this.bspRenderer = new BspRenderer(level, this.textures, this.renderer, this.assets.colormaps);
    this.applyViewLayout();
    this.automap.seedPlayer(player);
    this.playSession = new PlaySession(level, player, this.sound, this.skill, {
      textures: this.textures,
      onExitLevel: (secret) => this.completeLevel(secret),
      players,
      localPlayerIndex: localIndex,
      mapName: this.mapName,
    });

    this.statusBar.resetForPlayer(player);
    this.menu.setUsergame(true);
    this.menu.applySfxVolume();
    this.menu.applyMusicVolume();
    this.phase = 'playing';
  }

  returnToTitle() {
    this.phase = 'title';
    this.mapName = 'E1M1';
    this.map = null;
    this.playSession = null;
    this.bspRenderer = null;
    this.levelIntro = null;
    this.menu.setUsergame(false);
    this.menu.close();
    this.music?.startMenuMusic();
  }

  /**
   * Finish current map and advance (g_game.c — G_ExitLevel / G_WorldDone).
   * @param {boolean} [secret=false]
   */
  completeLevel(secret = false) {
    const stats = this.playSession?.endStats?.() ?? null;
    const next = nextMapName(this.mapName, secret);
    if (!next) {
      this.returnToTitle();
      return;
    }

    this.music?.startIntermissionMusic();

    this.mapName = next;
    this.map = null;
    this.bspRenderer = null;

    // Show a stats intermission before the next map intro.
    this.intermission = new IntermissionStatsScene(this.wad, this.mapName, stats ?? {
      kills: { killed: 0, total: 0 },
      items: { found: 0, total: 0 },
      secrets: { found: 0, total: 0 },
      timeTics: 0,
    }, this.sound);
    this.playSession = null;
    this.startWipeTo('intermission', () => {
      this.renderer.initBuffer(SCREENWIDTH, SCREENHEIGHT);
      this.intermission?.draw(this.renderer);
    });
  }
}

function formatTime(totalSec) {
  const m = (totalSec / 60) | 0;
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
