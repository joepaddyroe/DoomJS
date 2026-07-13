import { TextRenderer } from '../render/TextRenderer.js';
import { MenuPatches, drawFullScreenPatch } from './WadUiPatches.js';
import {
  detectGamemode,
  episodeMenuCount,
  mapNameForEpisode,
} from './Gamemode.js';

const LINE_HEIGHT = 16;
const SKULL_X_OFF = -32;
const SKULL_Y_OFF = -5;
const MENU_TEXT_COLOR = 0x50;

/** @typedef {'main' | 'episode' | 'newGame' | 'options' | 'sound' | 'load' | 'save' | 'read1' | 'read2'} MenuId */

/** @typedef {{ type: 'startGame', skill: number, mapName: string } | { type: 'returnTitle' } | null} MenuAction */

const QUIT_MESSAGES = [
  "please don't leave, there's more\ndemons to toast!",
  "let's beat it -- this is turning\ninto a bloodbath!",
  "i wouldn't leave if i were you.\ndos is much worse.",
  "you're trying to say you like dos\nbetter than me, right?",
  "don't leave yet -- there's a\ndemon around that corner!",
  "ya know, next time you come in here\ni'll be waiting for you...",
  "you're leaving already?\nwhat a wimp!",
];

/**
 * Menu row with optional gap (status -1) — matches OptionsMenu in m_menu.c.
 * @typedef {{ status: -1|1|2, patch?: string, hotkey?: string, slider?: string, thermoWidth?: number, action?: string }} MenuSlotDef
 */

/** options_e / OptionsMenu — thermos sit on the row below each slider label. */
const OPTIONS_SLOTS = [
  { status: 1, patch: 'M_ENDGAM', hotkey: 'e', action: 'endgame' },
  { status: 1, patch: 'M_MESSG', hotkey: 'm', action: 'messages' },
  { status: 1, patch: 'M_DETAIL', hotkey: 'g', action: 'detail' },
  { status: 2, patch: 'M_SCRNSZ', hotkey: 's', slider: 'screenSize', thermoWidth: 9 },
  { status: -1 },
  { status: 2, patch: 'M_MSENS', hotkey: 'm', slider: 'mouseSensitivity', thermoWidth: 10 },
  { status: -1 },
  { status: 1, patch: 'M_SVOL', hotkey: 's', action: 'soundMenu' },
];

/** sound_e / SoundMenu */
const SOUND_SLOTS = [
  { status: 2, patch: 'M_SFXVOL', hotkey: 's', slider: 'sfxVolume', thermoWidth: 16 },
  { status: -1 },
  { status: 2, patch: 'M_MUSVOL', hotkey: 'm', slider: 'musicVolume', thermoWidth: 16 },
  { status: -1 },
];

/**
 * Vanilla startup menu flow (m_menu.c).
 */
export class MenuController {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {import('../audio/SoundSystem.js').SoundSystem|null} [sound]
   */
  constructor(wad, sound = null) {
    this.patches = new MenuPatches(wad);
    this.sound = sound;
    this.gamemode = detectGamemode(wad);
    this.usergame = false;

    /** @type {boolean} */
    this.active = false;
    /** @type {MenuId} */
    this.currentMenu = 'main';
    this.itemOn = 0;
    /** @type {Record<string, number>} */
    this.lastOn = {
      main: 0,
      episode: 0,
      newGame: 2,
      options: 0,
      sound: 0,
      load: 0,
      save: 0,
      read1: 0,
      read2: 0,
    };

    this.whichSkull = 0;
    this.skullAnimCounter = 8;
    this.selectedEpisode = 0;

    this.showMessages = true;
    this.detailLevel = 0;
    this.screenSize = 0;
    this.mouseSensitivity = 5;
    this.sfxVolume = 15;
    this.musicVolume = 15;

    /** @type {string[]} */
    this.savegameStrings = Array.from({ length: 6 }, () => 'empty slot');

    /** @type {{ listSlotNames?: () => string[], saveSlot?: (slot: number) => void, loadSlot?: (slot: number) => void }|null} */
    this.saveSystem = null;

    /** @type {{ text: string, needsInput: boolean, onResponse?: (accepted: boolean) => void }|null} */
    this.message = null;
    /** @type {MenuAction} */
    this.pendingAction = null;
  }

  /** @param {boolean} inGame */
  setUsergame(inGame) {
    this.usergame = inGame;
  }

  /** Apply current SFX volume to the sound system. */
  applySfxVolume() {
    if (this.sound) {
      this.sound.setSfxVolume(this.sfxVolume / 15);
    }
  }

  open() {
    if (this.active) {
      return;
    }
    this.active = true;
    this.currentMenu = 'main';
    this.itemOn = this.lastOn.main;
    this.message = null;
    this.applySfxVolume();

    // Refresh slot labels on open so the menu reflects latest saves.
    this.refreshSaveStrings();
  }

  close() {
    this.active = false;
    this.message = null;
    this.lastOn[this.currentMenu] = this.itemOn;
  }

  /** @param {{ listSlotNames?: () => string[], saveSlot?: (slot: number) => void, loadSlot?: (slot: number) => void }|null} sys */
  setSaveSystem(sys) {
    this.saveSystem = sys;
    this.refreshSaveStrings();
  }

  refreshSaveStrings() {
    const names = this.saveSystem?.listSlotNames?.();
    if (names && names.length >= this.savegameStrings.length) {
      this.savegameStrings = names.slice(0, this.savegameStrings.length);
    }
  }

  /** @returns {MenuAction} */
  consumeAction() {
    const action = this.pendingAction;
    this.pendingAction = null;
    return action;
  }

  /** @returns {number} */
  get mainMenuItemCount() {
    return this.gamemode === 'commercial' ? 5 : 6;
  }

  /** @returns {number} */
  get episodeItemCount() {
    return episodeMenuCount(this.gamemode);
  }

  /** @returns {number} */
  get skillItemCount() {
    return this.patches.skills.length;
  }

  /** @returns {number} */
  itemCountForCurrentMenu() {
    const slots = this.getSlots(this.currentMenu);
    if (slots) {
      return slots.length;
    }

    switch (this.currentMenu) {
      case 'main':
        return this.mainMenuItemCount;
      case 'episode':
        return this.episodeItemCount;
      case 'newGame':
        return this.skillItemCount;
      case 'load':
      case 'save':
        return 6;
      case 'read1':
      case 'read2':
        return 1;
      default:
        return 0;
    }
  }

  /** @param {MenuId} menuId @returns {MenuSlotDef[]|null} */
  getSlots(menuId) {
    if (menuId === 'options') {
      return OPTIONS_SLOTS;
    }
    if (menuId === 'sound') {
      return SOUND_SLOTS;
    }
    return null;
  }

  /** @param {MenuId} menuId @param {number} index @returns {MenuSlotDef|null} */
  getSlot(menuId, index) {
    const slots = this.getSlots(menuId);
    return slots?.[index] ?? null;
  }

  /** @param {string} slider */
  getSliderValue(slider) {
    switch (slider) {
      case 'screenSize':
        return this.screenSize;
      case 'mouseSensitivity':
        return this.mouseSensitivity;
      case 'sfxVolume':
        return this.sfxVolume;
      case 'musicVolume':
        return this.musicVolume;
      default:
        return 0;
    }
  }

  popMenu() {
    const prev = this.parentMenu(this.currentMenu);
    if (!prev) {
      return;
    }
    this.lastOn[this.currentMenu] = this.itemOn;
    this.currentMenu = prev;
    this.itemOn = this.lastOn[prev] ?? 0;
  }

  /** @param {MenuId} menuId */
  pushMenu(menuId) {
    this.lastOn[this.currentMenu] = this.itemOn;
    this.currentMenu = menuId;
    this.itemOn = this.lastOn[menuId] ?? 0;
  }

  /** @param {MenuId} menuId @returns {MenuId|null} */
  parentMenu(menuId) {
    switch (menuId) {
      case 'main':
        return null;
      case 'episode':
      case 'load':
      case 'save':
      case 'read1':
        return 'main';
      case 'newGame':
        return this.gamemode === 'commercial' ? 'main' : 'episode';
      case 'options':
        return 'main';
      case 'sound':
        return 'options';
      case 'read2':
        return 'read1';
      default:
        return null;
    }
  }

  /** @param {string} text @param {boolean} [needsInput=false] @param {(accepted: boolean) => void} [onResponse] */
  startMessage(text, needsInput = false, onResponse) {
    this.message = { text, needsInput, onResponse };
  }

  dismissMessage() {
    this.message = null;
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tick(input) {
    this.tickSkull();

    if (this.message) {
      return this.tickMessage(input);
    }

    if (!this.active) {
      return false;
    }

    // Vanilla (m_menu.c):
    // - Escape closes the entire menu (M_ClearMenus + sfx_swtchx)
    // - Backspace goes back one menu level (sfx_swtchn)
    if (input.consumeJustPressed('Escape')) {
      this.sound?.start('swtchx');
      this.close();
      return true;
    }

    if (input.consumeJustPressed('Backspace')) {
      if (this.parentMenu(this.currentMenu)) {
        this.sound?.start('swtchn');
        this.popMenu();
      }
      return true;
    }

    if (input.consumeJustPressed('ArrowUp')) {
      this.moveSelection(-1);
      return true;
    }
    if (input.consumeJustPressed('ArrowDown')) {
      this.moveSelection(1);
      return true;
    }

    const slider = this.currentSlider();
    if (slider && input.consumeJustPressed('ArrowLeft')) {
      this.adjustSlider(slider, -1);
      return true;
    }
    if (slider && input.consumeJustPressed('ArrowRight')) {
      this.adjustSlider(slider, 1);
      return true;
    }

    if (input.consumeJustPressed('Enter') || input.consumeJustPressed('Space')) {
      this.activateItem(this.itemOn);
      return true;
    }

    const hotkey = input.consumeMenuHotkey();
    if (hotkey !== null) {
      this.handleHotkey(hotkey);
      return true;
    }

    return false;
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tickMessage(input) {
    if (!this.message) {
      return false;
    }

    if (this.message.needsInput) {
      if (input.consumeJustPressed('KeyY')) {
        this.message.onResponse?.(true);
        this.dismissMessage();
        return true;
      }
      if (input.consumeJustPressed('KeyN') || input.consumeJustPressed('Escape')) {
        this.message.onResponse?.(false);
        this.dismissMessage();
        return true;
      }
      return false;
    }

    if (input.consumeAnyKey()) {
      this.message.onResponse?.(false);
      this.dismissMessage();
      return true;
    }
    return false;
  }

  tickSkull() {
    if (--this.skullAnimCounter <= 0) {
      this.whichSkull ^= 1;
      this.skullAnimCounter = 8;
    }
  }

  /** @returns {{ kind: string, width: number }|null} */
  currentSlider() {
    const slot = this.getSlot(this.currentMenu, this.itemOn);
    if (!slot || slot.status !== 2 || !slot.slider) {
      return null;
    }
    return { kind: slot.slider, width: slot.thermoWidth ?? 16 };
  }

  /** @param {{ kind: string, width: number }} slider @param {number} delta */
  adjustSlider(slider, delta) {
    this.sound?.start('stnmov');
    const clamp = (value, max) => Math.max(0, Math.min(max, value + delta));
    switch (slider.kind) {
      case 'screenSize':
        this.screenSize = clamp(this.screenSize, 8);
        break;
      case 'mouseSensitivity':
        this.mouseSensitivity = clamp(this.mouseSensitivity, 9);
        break;
      case 'sfxVolume':
        this.sfxVolume = clamp(this.sfxVolume, 15);
        this.applySfxVolume();
        break;
      case 'musicVolume':
        this.musicVolume = clamp(this.musicVolume, 15);
        break;
      default:
        break;
    }
  }

  /** @param {number} delta */
  moveSelection(delta) {
    const slots = this.getSlots(this.currentMenu);
    const count = this.itemCountForCurrentMenu();
    if (count <= 0) {
      return;
    }

    if (slots) {
      let next = this.itemOn;
      const start = next;
      do {
        next = (next + delta + count) % count;
      } while (slots[next].status === -1 && next !== start);
      if (slots[next].status !== -1) {
        this.itemOn = next;
        this.sound?.start('pstop');
      }
      return;
    }

    this.itemOn = (this.itemOn + delta + count) % count;
    this.sound?.start('pstop');
  }

  /** @param {string} hotkey */
  handleHotkey(hotkey) {
    if (this.currentMenu === 'load' || this.currentMenu === 'save') {
      const slot = Number(hotkey) - 1;
      if (slot >= 0 && slot < 6) {
        this.itemOn = slot;
        this.sound?.start('pstop');
        this.activateItem(slot);
      }
      return;
    }

    const slots = this.getSlots(this.currentMenu);
    if (slots) {
      for (let i = this.itemOn + 1; i < slots.length; i++) {
        if (slots[i].hotkey === hotkey && slots[i].status !== -1) {
          this.itemOn = i;
          this.sound?.start('pstop');
          this.activateItem(i);
          return;
        }
      }
      for (let i = 0; i <= this.itemOn; i++) {
        if (slots[i].hotkey === hotkey && slots[i].status !== -1) {
          this.itemOn = i;
          this.sound?.start('pstop');
          this.activateItem(i);
          return;
        }
      }
      return;
    }

    const hotkeys = this.hotkeysForCurrentMenu();
    const index = hotkeys.indexOf(hotkey);
    if (index >= 0) {
      this.itemOn = index;
      this.sound?.start('pstop');
      this.activateItem(index);
    }
  }

  /** @returns {string[]} */
  hotkeysForCurrentMenu() {
    switch (this.currentMenu) {
      case 'main':
        return this.gamemode === 'commercial'
          ? ['n', 'o', 'l', 's', 'q']
          : ['n', 'o', 'l', 's', 'r', 'q'];
      case 'episode':
        return ['k', 't', 'i', 't'].slice(0, this.episodeItemCount);
      case 'newGame':
        return ['i', 'h', 'h', 'u', 'n'].slice(0, this.skillItemCount);
      default:
        return [];
    }
  }

  /** @param {number} index */
  activateItem(index) {
    switch (this.currentMenu) {
      case 'main':
        this.activateMainItem(index);
        break;
      case 'episode':
        this.activateEpisode(index);
        break;
      case 'newGame':
        this.activateSkill(index);
        break;
      case 'options':
        this.activateOptionsItem(index);
        break;
      case 'sound': {
        const slot = this.getSlot('sound', index);
        if (slot?.status === 2 && slot.slider) {
          this.adjustSlider({ kind: slot.slider, width: slot.thermoWidth ?? 16 }, 1);
        }
        break;
      }
      case 'load':
        this.activateLoadSlot(index);
        break;
      case 'save':
        this.activateSaveSlot(index);
        break;
      case 'read1':
        this.pushMenu('read2');
        break;
      case 'read2':
        this.currentMenu = 'main';
        this.itemOn = this.lastOn.main ?? 0;
        this.sound?.start('swtchn');
        break;
      default:
        break;
    }
  }

  /** @param {number} index */
  activateMainItem(index) {
    if (this.gamemode === 'commercial') {
      switch (index) {
        case 0:
          this.sound?.start('pistol');
          this.pushMenu('newGame');
          break;
        case 1:
          this.sound?.start('pistol');
          this.pushMenu('options');
          break;
        case 2:
          this.sound?.start('pistol');
          this.pushMenu('load');
          break;
        case 3:
          this.activateSaveFromMain();
          break;
        case 4:
          this.confirmQuit();
          break;
        default:
          break;
      }
      return;
    }

    switch (index) {
      case 0:
        this.sound?.start('pistol');
        this.pushMenu('episode');
        break;
      case 1:
        this.sound?.start('pistol');
        this.pushMenu('options');
        break;
      case 2:
        this.sound?.start('pistol');
        this.pushMenu('load');
        break;
      case 3:
        this.activateSaveFromMain();
        break;
      case 4:
        this.sound?.start('pistol');
        this.pushMenu('read1');
        break;
      case 5:
        this.confirmQuit();
        break;
      default:
        break;
    }
  }

  activateSaveFromMain() {
    if (!this.usergame) {
      this.sound?.start('oof');
      this.startMessage("you can't save if you aren't playing!\n\npress a key.");
      return;
    }
    this.sound?.start('pistol');
    this.pushMenu('save');
  }

  /** @param {number} index */
  activateEpisode(index) {
    if (this.gamemode === 'shareware' && index > 0) {
      this.startMessage(
        'this is the shareware version of doom.\n\n'
        + 'you need to order the entire trilogy.\n\npress a key.',
      );
      return;
    }

    this.selectedEpisode = index;
    this.sound?.start('pistol');
    this.pushMenu('newGame');
  }

  /** @param {number} index */
  activateSkill(index) {
    if (index === 4 && this.skillItemCount >= 5) {
      this.startMessage(
        'are you sure? this skill level\nisn\'t even remotely fair.\n\npress y or n.',
        true,
        (accepted) => {
          if (accepted) {
            this.startNewGame(index);
          }
        },
      );
      return;
    }
    this.startNewGame(index);
  }

  /** @param {number} skillIndex 0-based menu choice */
  startNewGame(skillIndex) {
    this.sound?.start('pistol');
    const skill = skillIndex + 1;
    let mapName = 'E1M1';

    if (this.gamemode === 'commercial') {
      mapName = 'MAP01';
    } else {
      mapName = mapNameForEpisode(this.selectedEpisode + 1, 1);
    }

    this.pendingAction = { type: 'startGame', skill, mapName };
    this.close();
  }

  /** @param {number} index */
  activateOptionsItem(index) {
    const slot = this.getSlot('options', index);
    if (!slot || slot.status === -1) {
      return;
    }

    if (slot.status === 2 && slot.slider) {
      this.adjustSlider({ kind: slot.slider, width: slot.thermoWidth ?? 16 }, 1);
      return;
    }

    switch (slot.action) {
      case 'endgame':
        if (!this.usergame) {
          this.sound?.start('oof');
          return;
        }
        this.startMessage('are you sure you want to end the game?\n\npress y or n.', true, (accepted) => {
          if (accepted) {
            this.pendingAction = { type: 'returnTitle' };
            this.close();
          }
        });
        break;
      case 'messages':
        this.showMessages = !this.showMessages;
        this.sound?.start('stnmov');
        break;
      case 'detail':
        this.detailLevel = 1 - this.detailLevel;
        this.sound?.start('stnmov');
        break;
      case 'soundMenu':
        this.sound?.start('pistol');
        this.pushMenu('sound');
        break;
      default:
        break;
    }
  }

  /** @param {number} index */
  activateLoadSlot(index) {
    this.refreshSaveStrings();
    if (!this.saveSystem?.loadSlot) {
      this.startMessage('save/load is not implemented yet.\n\npress a key.');
      return;
    }
    if (this.savegameStrings[index] === 'empty slot') {
      this.sound?.start('oof');
      return;
    }
    this.sound?.start('pistol');
    this.saveSystem.loadSlot(index);
  }

  /** @param {number} index */
  activateSaveSlot(index) {
    this.refreshSaveStrings();
    if (!this.saveSystem?.saveSlot) {
      this.startMessage('save/load is not implemented yet.\n\npress a key.');
      return;
    }
    this.sound?.start('pistol');
    this.saveSystem.saveSlot(index);
    this.refreshSaveStrings();
  }

  confirmQuit() {
    const message = QUIT_MESSAGES[Math.floor(Math.random() * QUIT_MESSAGES.length)];
    this.startMessage(`${message}\n\n(press y to quit)`, true, (accepted) => {
      if (accepted) {
        this.pendingAction = { type: 'returnTitle' };
        this.close();
      }
    });
  }

  /**
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   */
  draw(renderer) {
    if (this.message) {
      TextRenderer.drawCenteredBlock(renderer.pixels, this.message.text, MENU_TEXT_COLOR);
      return;
    }

    if (!this.active) {
      return;
    }

    this.drawMenuHeader(renderer);
    this.drawMenuItems(renderer);
    this.drawSkull(renderer);
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer */
  drawMenuHeader(renderer) {
    switch (this.currentMenu) {
      case 'main':
        if (this.patches.doomLogo) {
          renderer.drawPatch(94, 2, this.patches.doomLogo.header, this.patches.doomLogo.data);
        }
        break;
      case 'newGame':
        renderer.drawPatch(96, 14, this.patches.newGame.header, this.patches.newGame.data);
        renderer.drawPatch(54, 38, this.patches.chooseSkill.header, this.patches.chooseSkill.data);
        break;
      case 'episode':
        if (this.patches.episodeTitle) {
          renderer.drawPatch(54, 38, this.patches.episodeTitle.header, this.patches.episodeTitle.data);
        }
        break;
      case 'options':
        if (this.patches.optionsTitle) {
          renderer.drawPatch(108, 15, this.patches.optionsTitle.header, this.patches.optionsTitle.data);
        }
        this.drawOptionsExtras(renderer);
        this.drawSliderThermos(renderer, 'options');
        break;
      case 'sound':
        if (this.patches.soundTitle) {
          renderer.drawPatch(60, 38, this.patches.soundTitle.header, this.patches.soundTitle.data);
        }
        this.drawSliderThermos(renderer, 'sound');
        break;
      case 'load':
        if (this.patches.loadTitle) {
          renderer.drawPatch(72, 28, this.patches.loadTitle.header, this.patches.loadTitle.data);
        }
        this.drawSaveSlots(renderer, 80, 54);
        break;
      case 'save':
        if (this.patches.saveTitle) {
          renderer.drawPatch(72, 28, this.patches.saveTitle.header, this.patches.saveTitle.data);
        }
        this.drawSaveSlots(renderer, 80, 54);
        break;
      case 'read1':
        this.drawHelpScreen(renderer, 1);
        break;
      case 'read2':
        this.drawHelpScreen(renderer, 2);
        break;
      default:
        break;
    }
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer */
  drawOptionsExtras(renderer) {
    const baseX = 60;
    const baseY = 37;
    const detailPatch = this.detailLevel ? this.patches.detailLow : this.patches.detailHigh;
    const msgPatch = this.showMessages ? this.patches.msgOn : this.patches.msgOff;
    if (detailPatch) {
      renderer.drawPatch(baseX + 175, baseY + LINE_HEIGHT * 2, detailPatch.header, detailPatch.data);
    }
    if (msgPatch) {
      renderer.drawPatch(baseX + 120, baseY + LINE_HEIGHT, msgPatch.header, msgPatch.data);
    }
  }

  /**
   * Draw slider thermometers on the row below each slider label (M_DrawThermo).
   * @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer
   * @param {'options' | 'sound'} menuId
   */
  drawSliderThermos(renderer, menuId) {
    const slots = this.getSlots(menuId);
    if (!slots) {
      return;
    }

    const { x, y } = this.menuPosition();
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.status !== 2 || !slot.slider) {
        continue;
      }
      this.drawThermo(
        renderer,
        x,
        y + LINE_HEIGHT * (i + 1),
        slot.thermoWidth ?? 16,
        this.getSliderValue(slot.slider),
      );
    }
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer @param {number} x @param {number} y @param {number} width @param {number} dot */
  drawThermo(renderer, x, y, width, dot) {
    const { thermoLeft, thermoMid, thermoRight, thermoDot } = this.patches;
    if (!thermoLeft || !thermoMid || !thermoRight || !thermoDot) {
      return;
    }

    let xx = x;
    renderer.drawPatch(xx, y, thermoLeft.header, thermoLeft.data);
    xx += 8;
    for (let i = 0; i < width; i++) {
      renderer.drawPatch(xx, y, thermoMid.header, thermoMid.data);
      xx += 8;
    }
    renderer.drawPatch(xx, y, thermoRight.header, thermoRight.data);
    renderer.drawPatch(x + 8 + dot * 8, y, thermoDot.header, thermoDot.data);
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer @param {number} x @param {number} y */
  drawSaveSlots(renderer, x, y) {
    for (let i = 0; i < 6; i++) {
      this.drawSaveBorder(renderer, x, y + i * LINE_HEIGHT);
      TextRenderer.drawString(renderer.pixels, x, y + i * LINE_HEIGHT, this.savegameStrings[i], MENU_TEXT_COLOR);
    }
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer @param {number} x @param {number} y */
  drawSaveBorder(renderer, x, y) {
    const { saveBorderLeft, saveBorderMid, saveBorderRight } = this.patches;
    if (!saveBorderLeft || !saveBorderMid || !saveBorderRight) {
      return;
    }

    let xx = x - 8;
    renderer.drawPatch(xx, y + 7, saveBorderLeft.header, saveBorderLeft.data);
    for (let i = 0; i < 24; i++) {
      renderer.drawPatch(xx, y + 7, saveBorderMid.header, saveBorderMid.data);
      xx += 8;
    }
    renderer.drawPatch(xx, y + 7, saveBorderRight.header, saveBorderRight.data);
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer @param {1|2} page */
  drawHelpScreen(renderer, page) {
    let patch = null;
    if (page === 1) {
      patch = this.gamemode === 'commercial' ? this.patches.help : this.patches.help1;
    } else if (this.gamemode === 'retail' || this.gamemode === 'commercial') {
      patch = this.patches.credit;
    } else {
      patch = this.patches.help2;
    }
    if (patch) {
      drawFullScreenPatch(renderer, patch);
    }
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer */
  drawMenuItems(renderer) {
    const { x, y } = this.menuPosition();
    const slots = this.getSlots(this.currentMenu);
    if (slots) {
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.status === -1 || !slot.patch) {
          continue;
        }
        const patch = this.patches.getPatch(slot.patch);
        if (patch) {
          renderer.drawPatch(x, y + i * LINE_HEIGHT, patch.header, patch.data);
        }
      }
      return;
    }

    const patches = this.patchesForCurrentMenu();
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (patch) {
        renderer.drawPatch(x, y + i * LINE_HEIGHT, patch.header, patch.data);
      }
    }
  }

  /** @returns {{ x: number, y: number }} */
  menuPosition() {
    switch (this.currentMenu) {
      case 'main':
        return { x: 97, y: this.gamemode === 'commercial' ? 72 : 64 };
      case 'episode':
      case 'newGame':
        return { x: 48, y: 63 };
      case 'options':
        return { x: 60, y: 37 };
      case 'sound':
        return { x: 80, y: 64 };
      default:
        return { x: 0, y: 0 };
    }
  }

  /** @returns {Array<{ header: object, data: Uint8Array }|null>} */
  patchesForCurrentMenu() {
    switch (this.currentMenu) {
      case 'main': {
        const names = this.gamemode === 'commercial'
          ? ['M_NGAME', 'M_OPTION', 'M_LOADG', 'M_SAVEG', 'M_QUITG']
          : ['M_NGAME', 'M_OPTION', 'M_LOADG', 'M_SAVEG', 'M_RDTHIS', 'M_QUITG'];
        return names
          .map((name) => this.patches.mainItems[name])
          .filter((patch) => patch !== null);
      }
      case 'episode':
        return this.patches.episodes.slice(0, this.episodeItemCount);
      case 'newGame':
        return this.patches.skills.slice(0, this.skillItemCount);
      default:
        return [];
    }
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer */
  drawSkull(renderer) {
    if (this.currentMenu === 'read1' || this.currentMenu === 'read2') {
      return;
    }

    let x;
    let y;
    if (this.currentMenu === 'load' || this.currentMenu === 'save') {
      x = 80;
      y = 54;
    } else {
      const slots = this.getSlots(this.currentMenu);
      const patches = this.patchesForCurrentMenu();
      if (!slots && patches.length === 0) {
        return;
      }
      ({ x, y } = this.menuPosition());
    }

    const skull = this.patches.skulls[this.whichSkull];
    renderer.drawPatch(
      x + SKULL_X_OFF,
      y + SKULL_Y_OFF + this.itemOn * LINE_HEIGHT,
      skull.header,
      skull.data,
    );
  }
}
