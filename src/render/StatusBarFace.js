import { ANG180, ANG45 } from '../core/angles.js';
import { TICRATE } from '../core/gameConstants.js';
import { gameRandom } from '../game/GameRandom.js';
import { pointToAngle2 } from '../math/viewMath.js';
import { createTrigTables } from '../math/tables.js';
import { PatchRenderer } from './PatchRenderer.js';

/** st_stuff.c */
const ST_NUMPAINFACES = 5;
const ST_NUMSTRAIGHTFACES = 3;
const ST_NUMTURNFACES = 2;
const ST_NUMSPECIALFACES = 3;
const ST_FACESTRIDE = ST_NUMSTRAIGHTFACES + ST_NUMTURNFACES + ST_NUMSPECIALFACES;
const ST_NUMEXTRAFACES = 2;
const ST_NUMFACES = ST_FACESTRIDE * ST_NUMPAINFACES + ST_NUMEXTRAFACES;

const ST_TURNOFFSET = ST_NUMSTRAIGHTFACES;
const ST_OUCHOFFSET = ST_TURNOFFSET + ST_NUMTURNFACES;
const ST_EVILGRINOFFSET = ST_OUCHOFFSET + 1;
const ST_RAMPAGEOFFSET = ST_EVILGRINOFFSET + 1;
const ST_GODFACE = ST_NUMPAINFACES * ST_FACESTRIDE;
const ST_DEADFACE = ST_GODFACE + 1;

const ST_EVILGRINCOUNT = 2 * TICRATE;
const ST_STRAIGHTFACECOUNT = TICRATE / 2;
const ST_TURNCOUNT = TICRATE;
const ST_RAMPAGEDELAY = 2 * TICRATE;
const ST_MUCHPAIN = 20;

const tables = createTrigTables();

/**
 * Status-bar face widget (st_stuff.c — ST_updateFaceWidget).
 */
export class StatusBarFace {
  /**
   * @param {import('../wad/WadFile.js').WadFile} wad
   */
  constructor(wad) {
    /** @type {Array<{ header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }>} */
    this.faces = [];
    let facenum = 0;

    for (let i = 0; i < ST_NUMPAINFACES; i++) {
      for (let j = 0; j < ST_NUMSTRAIGHTFACES; j++) {
        this.faces[facenum++] = PatchRenderer.parsePatch(
          wad.readLumpByName(`STFST${i}${j}`),
        );
      }
      this.faces[facenum++] = PatchRenderer.parsePatch(wad.readLumpByName(`STFTR${i}0`));
      this.faces[facenum++] = PatchRenderer.parsePatch(wad.readLumpByName(`STFTL${i}0`));
      this.faces[facenum++] = PatchRenderer.parsePatch(wad.readLumpByName(`STFOUCH${i}`));
      this.faces[facenum++] = PatchRenderer.parsePatch(wad.readLumpByName(`STFEVL${i}`));
      this.faces[facenum++] = PatchRenderer.parsePatch(wad.readLumpByName(`STFKILL${i}`));
    }
    this.faces[facenum++] = PatchRenderer.parsePatch(wad.readLumpByName('STFGOD0'));
    this.faces[facenum++] = PatchRenderer.parsePatch(wad.readLumpByName('STFDEAD0'));

    if (this.faces.length !== ST_NUMFACES) {
      throw new Error(`StatusBarFace: expected ${ST_NUMFACES} faces, got ${this.faces.length}`);
    }

    this.faceIndex = 0;
    this.faceCount = 0;
    this.oldHealth = -1;
    this.calcHealth = -1;
    this.painOffset = 0;
    this.priority = 0;
    this.lastAttackDown = -1;
    /** @type {boolean[]} */
    this.oldWeaponsOwned = new Array(8).fill(false);
  }

  /** @param {import('../game/Player.js').Player} player */
  calcPainOffset(player) {
    const health = player.health > 100 ? 100 : player.health;
    if (health !== this.calcHealth) {
      this.painOffset = (ST_FACESTRIDE * (((100 - health) * ST_NUMPAINFACES) / 101)) | 0;
      this.calcHealth = health;
    }
    return this.painOffset;
  }

  /** @param {import('../game/Player.js').Player} player */
  tick(player) {
    let priority = 0;

    if (priority < 10 && player.health <= 0) {
      priority = 9;
      this.faceIndex = ST_DEADFACE;
      this.faceCount = 1;
    }

    if (priority < 9 && player.bonuscount > 0) {
      let evilGrin = false;
      for (let i = 0; i < player.weaponowned.length; i++) {
        if (this.oldWeaponsOwned[i] !== player.weaponowned[i]) {
          evilGrin = true;
          this.oldWeaponsOwned[i] = player.weaponowned[i];
        }
      }
      if (evilGrin) {
        priority = 8;
        this.faceCount = ST_EVILGRINCOUNT;
        this.faceIndex = this.calcPainOffset(player) + ST_EVILGRINOFFSET;
      }
    }

    if (priority < 8 && player.damagecount > 0 && player.attacker && player.attacker !== player.mo) {
      priority = 7;
      if (this.oldHealth >= 0 && this.oldHealth - player.health > ST_MUCHPAIN) {
        this.faceCount = ST_TURNCOUNT;
        this.faceIndex = this.calcPainOffset(player) + ST_OUCHOFFSET;
      } else {
        const badAngle = pointToAngle2(
          player.mo.x,
          player.mo.y,
          player.attacker.x,
          player.attacker.y,
          tables.tantoangle,
        );
        let turnLeft;
        let diffAng;
        if (badAngle > player.mo.angle) {
          diffAng = badAngle - player.mo.angle;
          turnLeft = diffAng > ANG180;
        } else {
          diffAng = player.mo.angle - badAngle;
          turnLeft = diffAng <= ANG180;
        }

        this.faceCount = ST_TURNCOUNT;
        this.faceIndex = this.calcPainOffset(player);
        if (diffAng < ANG45) {
          this.faceIndex += ST_RAMPAGEOFFSET;
        } else if (turnLeft) {
          this.faceIndex += ST_TURNOFFSET;
        } else {
          this.faceIndex += ST_TURNOFFSET + 1;
        }
      }
    }

    if (priority < 7 && player.damagecount > 0) {
      if (this.oldHealth >= 0 && this.oldHealth - player.health > ST_MUCHPAIN) {
        priority = 7;
        this.faceCount = ST_TURNCOUNT;
        this.faceIndex = this.calcPainOffset(player) + ST_OUCHOFFSET;
      } else {
        priority = 6;
        this.faceCount = ST_TURNCOUNT;
        this.faceIndex = this.calcPainOffset(player) + ST_RAMPAGEOFFSET;
      }
    }

    if (priority < 6 && player.attacker && player.attacker !== player.mo) {
      if (this.lastAttackDown === -1) {
        this.lastAttackDown = ST_RAMPAGEDELAY;
      } else {
        this.lastAttackDown--;
      }
      if (this.lastAttackDown === 0) {
        priority = 5;
        this.faceIndex = this.calcPainOffset(player) + ST_RAMPAGEOFFSET;
        this.lastAttackDown = -1;
      }
    } else {
      this.lastAttackDown = -1;
    }

    if (priority < 5 && (this.faceCount === 0 || priority > 0)) {
      this.faceIndex = this.calcPainOffset(player) + (gameRandom() % ST_NUMSTRAIGHTFACES);
      this.faceCount = ST_STRAIGHTFACECOUNT;
    }

    if (player.health > 100) {
      this.faceIndex = ST_GODFACE;
    }

    this.priority = priority;
    if (this.faceCount > 0) {
      this.faceCount--;
    }

    this.oldHealth = player.health;
  }

  /** @returns {{ header: import('./PatchRenderer.js').PatchHeader, data: Uint8Array }} */
  currentFace() {
    const index = Math.max(0, Math.min(ST_NUMFACES - 1, this.faceIndex | 0));
    return this.faces[index];
  }
}
