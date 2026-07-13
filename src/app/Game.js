import { BT_ATTACK } from '../core/inputButtons.js';
import { MapLoader } from '../game/MapLoader.js';
import { Level } from '../game/Level.js';
import { Player } from '../game/Player.js';
import { startPlayerDeath, tickPlayerDeath } from '../game/PlayerDeath.js';
import { PlaySession } from './PlaySession.js';
import { SkillMenuScene } from './SkillMenuScene.js';
import { LevelIntroScene } from './LevelIntroScene.js';
import { BspRenderer } from '../render/BspRenderer.js';
import { createTrigTables } from '../math/tables.js';
import { nextMapName } from '../game/MapNames.js';

/** @typedef {'skillMenu' | 'levelIntro' | 'playing'} GamePhase */

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
    this.phase = 'skillMenu';
    /** @type {import('./SkillMenuScene.js').GameSkill} */
    this.skill = 3;

    this.skillMenu = new SkillMenuScene(this.wad, this.sound);
    /** @type {LevelIntroScene|null} */
    this.levelIntro = null;

    /** @type {import('../game/MapLoader.js').DoomMap|null} */
    this.map = null;
    /** @type {import('../render/BspRenderer.js').BspRenderer|null} */
    this.bspRenderer = null;
    /** @type {PlaySession|null} */
    this.playSession = null;
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tick(input) {
    switch (this.phase) {
      case 'skillMenu':
        if (this.skillMenu.tick(input)) {
          this.skill = this.skillMenu.selected;
          this.beginLevelIntro();
        }
        break;

      case 'levelIntro':
        if (this.levelIntro?.tick(input)) {
          this.beginPlay();
        }
        break;

      case 'playing':
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

      default:
        break;
    }

    input.endFrame();
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  frame(input) {
    switch (this.phase) {
      case 'skillMenu':
        this.skillMenu.draw(this.renderer);
        break;

      case 'levelIntro':
        this.levelIntro?.draw(this.renderer);
        break;

      case 'playing':
        this.renderPlay();
        break;

      default:
        break;
    }
  }

  renderPlay() {
    if (!this.bspRenderer || !this.playSession) {
      return;
    }

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
    this.phase = 'playing';
  }

  /**
   * Finish current map and advance (g_game.c — G_ExitLevel / G_WorldDone).
   * @param {boolean} [secret=false]
   */
  completeLevel(secret = false) {
    const next = nextMapName(this.mapName, secret);
    if (!next) {
      this.mapName = 'E1M1';
      this.phase = 'skillMenu';
      this.map = null;
      this.playSession = null;
      this.bspRenderer = null;
      return;
    }

    this.mapName = next;
    this.map = null;
    this.playSession = null;
    this.bspRenderer = null;
    this.beginLevelIntro();
  }
}
