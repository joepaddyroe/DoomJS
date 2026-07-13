import { TICRATE } from '../core/gameConstants.js';
import { SCREENHEIGHT, SCREENWIDTH } from '../core/renderConstants.js';
import { PatchRenderer } from '../render/PatchRenderer.js';
import { IntermissionPatches, parseEpisodeMap } from '../ui/WadUiPatches.js';

const WI_TITLEY = 2;
const SP_STATSX = 50;
const SP_STATSY = 50;
const SP_TIMEX = 16;
const SP_TIMEY = SCREENHEIGHT - 32;

/**
 * Single-player intermission stats (wi_stuff.c — WI_initStats/WI_updateStats/WI_drawStats).
 * Uses the original WAD patches (WINUM*, WIPCNT, WIF, etc.) and staged count-up with sounds.
 */
export class IntermissionStatsScene {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   * @param {string} mapName
   * @param {{ kills: { killed: number, total: number }, items: { found: number, total: number }, secrets: { found: number, total: number }, timeTics: number }} stats
   * @param {import('../audio/SoundSystem.js').SoundSystem|null} [sound]
   */
  constructor(wad, mapName, stats, sound = null) {
    const parsed = parseEpisodeMap(mapName);
    this.patches = parsed ? new IntermissionPatches(wad, parsed.epsd, parsed.map) : null;
    this.stats = stats;
    this.sound = sound;
    this.tics = 0;

    // wi_stuff.c counters and state machine.
    this.spState = 1;
    this.pause = TICRATE;
    this.bcnt = 0;
    this.accelerate = false;

    this.cntKills = -1;
    this.cntItems = -1;
    this.cntSecrets = -1;
    this.cntTime = -1;
    this.cntPar = -1;

    this.finalKills = percent(stats.kills.killed, stats.kills.total);
    this.finalItems = percent(stats.items.found, stats.items.total);
    this.finalSecrets = percent(stats.secrets.found, stats.secrets.total);
    this.finalTime = (stats.timeTics / TICRATE) | 0;
    this.finalPar = -1; // TODO: add par times later (wbs->partime)

    // Load WI_* stat patches.
    this.finished = loadPatch(wad, 'WIF');
    this.kills = loadPatch(wad, 'WIOSTK');
    this.items = loadPatch(wad, 'WIOSTI');
    this.secret = loadPatch(wad, 'WISCRT2');
    this.time = loadPatch(wad, 'WITIME');
    this.par = loadPatch(wad, 'WIPAR');
    this.percent = loadPatch(wad, 'WIPCNT');
    this.colon = loadPatch(wad, 'WICOLON');
    this.sucks = loadPatch(wad, 'WISUCKS');
    this.minus = loadPatch(wad, 'WIMINUS');
    this.nums = Array.from({ length: 10 }, (_, i) => loadPatch(wad, `WINUM${i}`));
  }

  /** @param {import('../platform/input/KeyboardInput.js').KeyboardInput} input */
  tick(input) {
    this.tics++;
    this.bcnt++;
    if (this.patches) {
      this.patches.tickAnimations(this.tics);
    }

    if (input.consumeJustPressed('Enter') || input.consumeJustPressed('Space')) {
      this.accelerate = true;
    }

    this.updateStatsStateMachine();
    return this.spState === 10 && this.accelerate;
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer */
  draw(renderer) {
    renderer.clear(0x1d);
    if (this.patches) {
      const { background, animDefs, animFrames, animCounters } = this.patches;
      renderer.drawPatch(0, 0, background.header, background.data);
      for (let i = 0; i < animDefs.length; i++) {
        const frame = animFrames[i][animCounters[i]];
        const anim = animDefs[i];
        renderer.drawPatch(anim.x, anim.y, frame.header, frame.data);
      }
    }

    this.drawLF(renderer);
    this.drawStats(renderer);
  }

  updateStatsStateMachine() {
    // WI_updateStats: accelerate jumps to end and plays barexp.
    if (this.accelerate && this.spState !== 10) {
      this.accelerate = false;
      this.cntKills = this.finalKills;
      this.cntItems = this.finalItems;
      this.cntSecrets = this.finalSecrets;
      this.cntTime = this.finalTime;
      this.cntPar = this.finalPar;
      this.sound?.start('barexp');
      this.spState = 10;
      return;
    }

    // Odd states are delays.
    if (this.spState & 1) {
      if (--this.pause <= 0) {
        this.spState++;
        this.pause = TICRATE;
      }
      return;
    }

    // Counting states.
    if (this.spState === 2) {
      this.cntKills += 2;
      if ((this.bcnt & 3) === 0) this.sound?.start('pistol');
      if (this.cntKills >= this.finalKills) {
        this.cntKills = this.finalKills;
        this.sound?.start('barexp');
        this.spState++;
      }
      return;
    }

    if (this.spState === 4) {
      this.cntItems += 2;
      if ((this.bcnt & 3) === 0) this.sound?.start('pistol');
      if (this.cntItems >= this.finalItems) {
        this.cntItems = this.finalItems;
        this.sound?.start('barexp');
        this.spState++;
      }
      return;
    }

    if (this.spState === 6) {
      this.cntSecrets += 2;
      if ((this.bcnt & 3) === 0) this.sound?.start('pistol');
      if (this.cntSecrets >= this.finalSecrets) {
        this.cntSecrets = this.finalSecrets;
        this.sound?.start('barexp');
        this.spState++;
      }
      return;
    }

    if (this.spState === 8) {
      if ((this.bcnt & 3) === 0) this.sound?.start('pistol');
      this.cntTime += 3;
      if (this.cntTime >= this.finalTime) this.cntTime = this.finalTime;
      // No par times yet: finish as soon as time hits.
      if (this.cntTime >= this.finalTime) {
        this.sound?.start('barexp');
        this.spState++;
      }
      return;
    }
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer */
  drawLF(renderer) {
    if (!this.patches || !this.finished) return;
    let y = WI_TITLEY;
    const levelName = this.patches.levelName;
    renderer.drawPatch(((SCREENWIDTH - levelName.header.width) / 2) | 0, y, levelName.header, levelName.data);
    y += ((5 * levelName.header.height) / 4) | 0;
    renderer.drawPatch(((SCREENWIDTH - this.finished.header.width) / 2) | 0, y, this.finished.header, this.finished.data);
  }

  /** @param {import('../render/SoftwareRenderer.js').SoftwareRenderer} renderer */
  drawStats(renderer) {
    if (!this.kills || !this.items || !this.secret) return;
    const lh = ((3 * this.nums[0].header.height) / 2) | 0;

    renderer.drawPatch(SP_STATSX, SP_STATSY, this.kills.header, this.kills.data);
    this.drawPercent(renderer, SCREENWIDTH - SP_STATSX, SP_STATSY, this.cntKills);

    renderer.drawPatch(SP_STATSX, SP_STATSY + lh, this.items.header, this.items.data);
    this.drawPercent(renderer, SCREENWIDTH - SP_STATSX, SP_STATSY + lh, this.cntItems);

    renderer.drawPatch(SP_STATSX, SP_STATSY + 2 * lh, this.secret.header, this.secret.data);
    this.drawPercent(renderer, SCREENWIDTH - SP_STATSX, SP_STATSY + 2 * lh, this.cntSecrets);

    if (this.time) {
      renderer.drawPatch(SP_TIMEX, SP_TIMEY, this.time.header, this.time.data);
      this.drawTime(renderer, (SCREENWIDTH / 2 - SP_TIMEX) | 0, SP_TIMEY, this.cntTime);
    }
  }

  drawPercent(renderer, x, y, p) {
    if (p < 0 || !this.percent) return;
    renderer.drawPatch(x, y, this.percent.header, this.percent.data);
    this.drawNum(renderer, x, y, p, -1);
  }

  drawNum(renderer, x, y, n, digits) {
    const fontWidth = this.nums[0].header.width;
    if (digits < 0) {
      if (!n) {
        digits = 1;
      } else {
        digits = 0;
        let temp = Math.abs(n);
        while (temp) {
          temp = (temp / 10) | 0;
          digits++;
        }
      }
    }

    const neg = n < 0;
    if (neg) n = -n;
    if (n === 1994) return 0;

    while (digits--) {
      x -= fontWidth;
      const d = n % 10;
      const patch = this.nums[d];
      renderer.drawPatch(x, y, patch.header, patch.data);
      n = (n / 10) | 0;
    }
    if (neg && this.minus) {
      x -= 8;
      renderer.drawPatch(x, y, this.minus.header, this.minus.data);
    }
    return x;
  }

  drawTime(renderer, x, y, t) {
    if (t < 0) return;
    if (t <= 61 * 59) {
      let div = 1;
      do {
        const n = ((t / div) | 0) % 60;
        x = this.drawNum(renderer, x, y, n, 2) - (this.colon?.header.width ?? 0);
        div *= 60;
        if ((div === 60 || (t / div) | 0) && this.colon) {
          renderer.drawPatch(x, y, this.colon.header, this.colon.data);
        }
      } while ((t / div) | 0);
    } else if (this.sucks) {
      renderer.drawPatch(x - this.sucks.header.width, y, this.sucks.header, this.sucks.data);
    }
  }
}

function loadPatch(wad, name) {
  return PatchRenderer.parsePatch(wad.readLumpByName(name));
}

function percent(found, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.floor((found / total) * 100)));
}

