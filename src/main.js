import { SoftwareRenderer } from './render/SoftwareRenderer.js';
import { CanvasVideoOutput, DEFAULT_PIXEL_SCALE } from './platform/video/CanvasVideoOutput.js';
import { VIEWHEIGHT } from './core/renderConstants.js';
import { WadFile } from './wad/WadFile.js';
import { GameAssets } from './wad/GameAssets.js';
import { MapLoader } from './game/MapLoader.js';
import { Level } from './game/Level.js';
import { TextureManager } from './render/TextureManager.js';
import { BspRenderer } from './render/BspRenderer.js';
import { Player } from './game/Player.js';
import { PlaySession } from './app/PlaySession.js';
import { GameLoop } from './app/GameLoop.js';
import { KeyboardInput } from './platform/input/KeyboardInput.js';
import { SpritePatches, PspriteRenderer } from './wad/SpritePatches.js';
import { BillboardRenderer } from './render/BillboardRenderer.js';
import { StatusBar } from './render/StatusBar.js';
import { createTrigTables } from './math/tables.js';
import { SoundSystem } from './audio/SoundSystem.js';
import { createSoundDriver, soundDriverFromQuery } from './platform/sound/createSoundDriver.js';

const WAD_PATHS = ['./doom.wad', './assets/doom.wad', '../doom.wad'];
const MAP_NAME = 'E1M1';
const BUILD_TAG = '2026-07-12-sound2';
const SOUND_DRIVER = soundDriverFromQuery();

const canvas = document.getElementById('screen');
const output = new CanvasVideoOutput(canvas, undefined, undefined, DEFAULT_PIXEL_SCALE);
const renderer = new SoftwareRenderer();

renderer.initBuffer(renderer.screenWidth, VIEWHEIGHT);

/** @type {BspRenderer|null} */
let bspRenderer = null;
/** @type {PlaySession|null} */
let playSession = null;
/** @type {KeyboardInput|null} */
let input = null;
/** @type {GameLoop|null} */
let gameLoop = null;
/** @type {PspriteRenderer|null} */
let pspriteRenderer = null;
/** @type {BillboardRenderer|null} */
let billboardRenderer = null;
/** @type {StatusBar|null} */
let statusBar = null;
/** @type {SoundSystem|null} */
let soundSystem = null;
const trigTables = createTrigTables();

async function loadWad() {
  let lastError = null;
  for (const path of WAD_PATHS) {
    try {
      return await WadFile.load(path);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Could not load doom.wad');
}

async function start() {
  try {
    const wad = await loadWad();
    const assets = new GameAssets(wad);
    const textures = new TextureManager(wad);
    const map = MapLoader.load(wad, MAP_NAME);
    const level = Level.fromMap(map, textures, map.blockmap);
    const playerStart = MapLoader.findPlayerStart(map);

    renderer.setColormaps(assets.colormaps);
    output.setPalette(assets.palette);

    bspRenderer = new BspRenderer(level, textures, renderer, assets.colormaps);
    const spritePatches = new SpritePatches(wad);
    pspriteRenderer = new PspriteRenderer(renderer, spritePatches, assets.colormaps);
    billboardRenderer = new BillboardRenderer(renderer, spritePatches, assets.colormaps);
    statusBar = new StatusBar(wad);

    soundSystem = new SoundSystem(createSoundDriver(SOUND_DRIVER));
    soundSystem.load(wad);

    if (!playerStart) {
      throw new Error('No player start found on map');
    }

    const player = Player.fromStart(playerStart, level);
    playSession = new PlaySession(level, player, soundSystem);
    input = new KeyboardInput();

    canvas.addEventListener('click', () => {
      input.setEnabled(true);
      void soundSystem?.unlock();
      canvas.focus();
    });
    canvas.setAttribute('tabindex', '0');

    bspRenderer.renderView(playSession.view());
    output.present(renderer.pixels);

    const pos = player.mapPosition();
    console.log(
      `DoomJS ${BUILD_TAG} — ${MAP_NAME} at (${pos.x}, ${pos.y}). `
      + `Sound: ${soundSystem?.driverId ?? 'none'} (?sound=webaudio|howler|null). `
      + `320×200 @ ${DEFAULT_PIXEL_SCALE}× scale. Click canvas, WASD + arrows, 1/2/3 weapons, Ctrl/Space fire.`,
    );

    gameLoop = new GameLoop({
      onTick: () => {
        if (!playSession || !input) {
          return;
        }
        playSession.tick(input.buildTicCmd());
      },
      onFrame: () => {
        if (!bspRenderer || !playSession) {
          return;
        }
        bspRenderer.renderView(playSession.view());
        if (billboardRenderer) {
          billboardRenderer.drawPuffs(
            playSession.puffs.puffs,
            playSession.view(),
            bspRenderer.ctx.viewSetup,
            trigTables,
            playSession.player.extralight,
          );
        }
        if (pspriteRenderer) {
          pspriteRenderer.draw(playSession.player, playSession.player.extralight);
        }
        if (statusBar) {
          statusBar.draw(renderer, playSession.player);
        }
        output.present(renderer.pixels);
      },
    });
    gameLoop.start();
  } catch (error) {
    console.error(error);
    renderer.clear(0x2d);
    output.setPalette(CanvasVideoOutput.createDemoPalette());
    output.present(renderer.pixels);
  }
}

window.addEventListener('resize', () => {
  if (playSession && bspRenderer) {
    bspRenderer.renderView(playSession.view());
    if (billboardRenderer) {
      billboardRenderer.drawPuffs(
        playSession.puffs.puffs,
        playSession.view(),
        bspRenderer.ctx.viewSetup,
        trigTables,
        playSession.player.extralight,
      );
    }
    if (pspriteRenderer) {
      pspriteRenderer.draw(playSession.player, playSession.player.extralight);
    }
    if (statusBar) {
      statusBar.draw(renderer, playSession.player);
    }
    output.present(renderer.pixels);
  }
});

start();

export { renderer, output, bspRenderer, playSession };
