import { VIEWHEIGHT } from './core/renderConstants.js';
import { SoftwareRenderer } from './render/SoftwareRenderer.js';
import { CanvasVideoOutput } from './platform/video/CanvasVideoOutput.js';
import { WadFile } from './wad/WadFile.js';
import { GameAssets } from './wad/GameAssets.js';
import { TextureManager } from './render/TextureManager.js';
import { GameLoop } from './app/GameLoop.js';
import { Game } from './app/Game.js';
import { KeyboardInput } from './platform/input/KeyboardInput.js';
import { MouseLook, sensitivityFromMenuSetting } from './platform/input/MouseLook.js';
import { SpritePatches, PspriteRenderer } from './wad/SpritePatches.js';
import { BillboardRenderer } from './render/BillboardRenderer.js';
import { StatusBar } from './render/StatusBar.js';
import { SoundSystem } from './audio/SoundSystem.js';
import { MusicSystem } from './audio/MusicSystem.js';
import { createSoundDriver, soundDriverFromQuery } from './platform/sound/createSoundDriver.js';
import { promptForWadFile } from './ui/WadLoaderPrompt.js';
import { isNetMode, defaultRelayUrl } from './net/netMode.js';
import { NetGameSession } from './net/NetGameSession.js';
import { NetLobby } from './ui/NetLobby.js';

const WAD_PATHS = ['./doom.wad', './assets/doom.wad', '../doom.wad'];
const BUILD_TAG = '2026-07-16-netlockstep';
const SOUND_DRIVER = soundDriverFromQuery();
/** If true, open the multiplayer panel once at startup (still optional). */
const NET_LOBBY_START_OPEN = isNetMode();

const canvas = document.getElementById('screen');
const output = new CanvasVideoOutput(canvas);
const renderer = new SoftwareRenderer();

/** @type {Game|null} */
let game = null;
/** @type {KeyboardInput|null} */
let input = null;
/** @type {MouseLook|null} */
let mouseLook = null;
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

    // Net is always available via a discreet top-right toggle; SP is default.
    const net = new NetGameSession({ url: defaultRelayUrl() });
    game.setNetSession(net);
    const lobby = new NetLobby(net, { startOpen: NET_LOBBY_START_OPEN });
    lobby.mount();
    net.onMatchStart = (msg) => {
      lobby.hide();
      game.beginNetMatch(msg);
    };
    console.log(
      `DoomJS multiplayer toggle (top-right). Relay ${defaultRelayUrl()}`
      + (NET_LOBBY_START_OPEN ? ' — lobby opened (?net=1).' : ''),
    );

    input = new KeyboardInput();
    input.attachCanvas(canvas);

    const canCaptureMouse = () => {
      if (!game) {
        return false;
      }
      // Release only for the in-game pause menu; keep capture through intro/wipe.
      if (game.phase === 'playing' && game.menu.active) {
        return false;
      }
      return game.phase === 'title'
        || game.phase === 'levelIntro'
        || game.phase === 'intermission'
        || game.phase === 'wipe'
        || game.phase === 'playing';
    };
    const canMouseLook = () => game?.phase === 'playing' && !game.menu.active;

    input.setCombatEnabled(canMouseLook);
    const getMouseSensitivity = () => sensitivityFromMenuSetting(game?.menu.mouseSensitivity ?? 5);
    mouseLook = new MouseLook(canvas, canCaptureMouse, canMouseLook, getMouseSensitivity);
    input.setMouseLook(mouseLook);
    input.setEnabled(true);

    canvas.addEventListener('mousedown', () => {
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
      `DoomJS ${BUILD_TAG} — WASD move, mouse look, LMB fire, RMB use, Tab toggles automap. `
      + `Sound: ${soundSystem?.driverId ?? 'none'} (?sound=webaudio|howler|null). `
      + `${output.gameWidth}×${output.gameHeight} @ ${output.pixelScale}×.`,
    );

    gameLoop = new GameLoop({
      onTick: () => {
        if (game && input) {
          if (mouseLook && !canCaptureMouse()) {
            mouseLook.leaveCapture();
            input.clearMouseButtons();
          }
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
