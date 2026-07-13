import { SCREENHEIGHT, SCREENWIDTH, VIEWHEIGHT } from '../core/renderConstants.js';
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
import { createTrigTables } from '../math/tables.js';
import { nextMapName } from '../game/MapNames.js';
import { MenuController } from '../ui/MenuController.js';
import { WipeMelt } from '../ui/WipeMelt.js';

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
    this.mapName = deps.mapName ?? 'E1M1';
    this.trigTables = createTrigTables();

    /** @type {GamePhase} */
    this.phase = 'title';
    this.skill = 3;

    this.menu = new MenuController(this.wad, this.sound);
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
        if (!this.menu.active && this.levelIntro?.tick(input)) {
          // Build the play session first so the wipe target is the actual 3D view.
          this.beginPlay();
          this.startWipeTo('playing', () => this.renderPlay());
        }
        break;

      case 'intermission':
        this.menu.tick(input);
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
        if (this.menu.active) {
          break;
        }
        if (this.playSession) {
          const player = this.playSession.player;
          const cmd = input.buildTicCmd();
          player.attacking = (cmd.buttons & BT_ATTACK) !== 0;

          if (!player.dead) {
            this.playSession.tick(cmd);
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
      this.skill = action.skill;
      this.mapName = action.mapName;
      this.beginLevelIntro();
      return;
    }

    if (action.type === 'returnTitle') {
      this.returnToTitle();
    }
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
        this.renderPlay();
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

  renderPlay() {
    if (!this.bspRenderer || !this.playSession) {
      return;
    }

    this.renderer.initBuffer(SCREENWIDTH, VIEWHEIGHT);
    this.bspRenderer.renderView(this.playSession.view());

    const { drawSegs, drawSegCount } = this.bspRenderer.ctx;
    const view = this.playSession.view();
    const extralight = this.playSession.player.extralight;

    this.billboardRenderer.drawThings(
      [...this.playSession.things, ...this.playSession.missiles.missiles],
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

    this.statusBar.draw(this.renderer, this.playSession.player);
  }

  beginLevelIntro() {
    this.map = MapLoader.load(this.wad, this.mapName);
    this.levelIntro = new LevelIntroScene(this.wad, this.mapName);
    this.phase = 'levelIntro';
  }

  beginPlay() {
    if (!this.map) {
      this.map = MapLoader.load(this.wad, this.mapName);
    }

    // Ensure the renderer view size matches gameplay before creating RenderContext.
    // RenderContext caches viewWidth/viewHeight in its ViewSetup tables.
    this.renderer.initBuffer(SCREENWIDTH, VIEWHEIGHT);

    const level = Level.fromMap(this.map, this.textures, this.map.blockmap);
    const playerStart = MapLoader.findPlayerStart(this.map);
    if (!playerStart) {
      throw new Error('No player start found on map');
    }

    const player = Player.fromStart(playerStart, level);
    this.bspRenderer = new BspRenderer(level, this.textures, this.renderer, this.assets.colormaps);
    this.playSession = new PlaySession(level, player, this.sound, this.skill, {
      textures: this.textures,
      onExitLevel: (secret) => this.completeLevel(secret),
    });
    this.statusBar.resetForPlayer(player);
    this.menu.setUsergame(true);
    this.menu.applySfxVolume();
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
