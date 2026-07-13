import { VIEWHEIGHT } from './core/renderConstants.js';
import { SoftwareRenderer } from './render/SoftwareRenderer.js';
import { CanvasVideoOutput } from './platform/video/CanvasVideoOutput.js';
import { WadFile } from './wad/WadFile.js';
import { GameAssets } from './wad/GameAssets.js';
import { TextureManager } from './render/TextureManager.js';
import { GameLoop } from './app/GameLoop.js';
import { Game } from './app/Game.js';
import { KeyboardInput } from './platform/input/KeyboardInput.js';
import { SpritePatches, PspriteRenderer } from './wad/SpritePatches.js';
import { BillboardRenderer } from './render/BillboardRenderer.js';
import { StatusBar } from './render/StatusBar.js';
import { SoundSystem } from './audio/SoundSystem.js';
import { MusicSystem } from './audio/MusicSystem.js';
import { createSoundDriver, soundDriverFromQuery } from './platform/sound/createSoundDriver.js';
import { promptForWadFile } from './ui/WadLoaderPrompt.js';

const WAD_PATHS = ['./doom.wad', './assets/doom.wad', '../doom.wad'];
const BUILD_TAG = '2026-07-13-renderfix';
const SOUND_DRIVER = soundDriverFromQuery();

const canvas = document.getElementById('screen');
const output = new CanvasVideoOutput(canvas);
const renderer = new SoftwareRenderer();

/** @type {Game|null} */
let game = null;
/** @type {KeyboardInput|null} */
let input = null;
/** @type {GameLoop|null} */
let gameLoop = null;
/** @type {SoundSystem|null} */
let soundSystem = null;
/** @type {MusicSystem|null} */
let musicSystem = null;

async function loadWadFromPaths() {
  let lastError = null;
  for (const path of WAD_PATHS) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await WadFile.load(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Could not load doom.wad from project folder');
}

/** Try local paths first; fall back to a file picker (GitHub Pages). */
async function acquireWad() {
  try {
    return await loadWadFromPaths();
  } catch {
    return promptForWadFile();
  }
}

async function start() {
  try {
    const wad = await acquireWad();
    const assets = new GameAssets(wad);
    const textures = new TextureManager(wad);

    renderer.setColormaps(assets.colormaps);
    renderer.initBuffer(renderer.screenWidth, VIEWHEIGHT);
    output.setPalette(assets.palette);

    const spritePatches = new SpritePatches(wad);
    const pspriteRenderer = new PspriteRenderer(renderer, spritePatches, assets.colormaps);
    const billboardRenderer = new BillboardRenderer(renderer, spritePatches, assets.colormaps);
    const statusBar = new StatusBar(wad);

    soundSystem = new SoundSystem(createSoundDriver(SOUND_DRIVER));
    await soundSystem.load(wad);
    musicSystem = new MusicSystem(wad);

    game = new Game({
      wad,
      assets,
      textures,
      renderer,
      spritePatches,
      billboardRenderer,
      pspriteRenderer,
      statusBar,
      sound: soundSystem,
      music: musicSystem,
      mapName: 'E1M1',
    });

    input = new KeyboardInput();
    input.setEnabled(true);

    canvas.addEventListener('click', () => {
      input.setEnabled(true);
      void soundSystem?.unlock();
      void musicSystem?.unlock();
      canvas.focus();
    });
    canvas.setAttribute('tabindex', '0');

    renderer.clear(0x70);
    game.frame(input);
    output.present(renderer.pixels);

    console.log(
      `DoomJS ${BUILD_TAG} — Press any key at title, then New Game. `
      + `Sound: ${soundSystem?.driverId ?? 'none'} (?sound=webaudio|howler|null). `
      + `${output.gameWidth}×${output.gameHeight} @ ${output.pixelScale}×.`,
    );

    gameLoop = new GameLoop({
      onTick: () => {
        if (game && input) {
          game.tick(input);
        }
      },
      onFrame: () => {
        if (game && input) {
          game.frame(input);
          output.setPalette(game.getFramePalette());
          output.present(renderer.pixels);
        }
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
  output.resize(window.innerWidth, window.innerHeight);
  if (game && input) {
    game.frame(input);
    output.setPalette(game.getFramePalette());
    output.present(renderer.pixels);
  }
});

start();

export { renderer, output, game };
