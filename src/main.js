import { SoftwareRenderer } from './render/SoftwareRenderer.js';
import { CanvasVideoOutput, DEFAULT_PIXEL_SCALE } from './platform/video/CanvasVideoOutput.js';
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

const WAD_PATHS = ['./doom.wad', './assets/doom.wad', '../doom.wad'];
const MAP_NAME = 'E1M1';
const BUILD_TAG = '2026-07-12-weapons1';

const canvas = document.getElementById('screen');
const output = new CanvasVideoOutput(canvas, undefined, undefined, DEFAULT_PIXEL_SCALE);
const renderer = new SoftwareRenderer();

renderer.initBuffer(renderer.screenWidth, renderer.screenHeight);

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

    if (!playerStart) {
      throw new Error('No player start found on map');
    }

    const player = Player.fromStart(playerStart, level);
    playSession = new PlaySession(level, player);
    input = new KeyboardInput();

    canvas.addEventListener('click', () => {
      input.setEnabled(true);
      canvas.focus();
    });
    canvas.setAttribute('tabindex', '0');

    bspRenderer.renderView(playSession.view());
    output.present(renderer.pixels);

    const pos = player.mapPosition();
    console.log(
      `DoomJS ${BUILD_TAG} — ${MAP_NAME} at (${pos.x}, ${pos.y}). `
      + `320×200 @ ${DEFAULT_PIXEL_SCALE}× scale. Click canvas, WASD + arrows, Ctrl/Space to fire.`,
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
        if (pspriteRenderer) {
          pspriteRenderer.draw(playSession.player, playSession.player.extralight);
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
    if (pspriteRenderer) {
      pspriteRenderer.draw(playSession.player, playSession.player.extralight);
    }
    output.present(renderer.pixels);
  }
});

start();

export { renderer, output, bspRenderer, playSession };
