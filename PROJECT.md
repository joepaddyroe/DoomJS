# DoomJS — Project Guide

Canonical instructions for building and maintaining this port. **Read this file before making structural changes.** Update it when architecture, conventions, or port status change.

**Reference source (read-only):** `../DOOM-master/linuxdoom-1.10/`

---

## Quick start for agents (context recovery)

If you are picking up this project with no chat history:

1. Read **§12 Port status** — what works vs what vanilla still has.
2. Read **§13 Priority roadmap** — suggested order of work.
3. Use **§14 Key file map** to jump to the right module.
4. Respect **§2–3** (SOLID + layers) before editing.
5. After completing work, update **§12**, **§7**, and **§15 Changelog**.

**Current maturity (2026-07-15):** Playable **single-player Doom 1 slice** — E1M1-style maps run with software rendering, all 8 weapons, 3 monster types, core doors/floors/plats, menus, music/SFX, wipes, JSON saves, intermission stats. **Corpse physics** and **in-game automap** (`am_map.c` subset) aligned with vanilla. **Not** a full vanilla port yet.

### Recent progress (2026-07-14 – 2026-07-15)

| Area | Done |
|------|------|
| **Corpse hover** | Reverted non-vanilla collision hacks; fixed `momz` init, immediate `killMobj` death state, monster tick order (XY → Z → state); optional `[corpse]` console debug (`CorpseDebug.js`) |
| **Automap** | Fixed int32 overflow in line projection (`fixedMul`); auto-scale to level bounds; vanilla `player_arrow` via `AM_drawLineCharacter`; player glyph **WHITE** (`0xD1`); `am_map.c` palette indices for walls/things |
| **Rendering polish** | Low-detail sprites; view border flats + `BRDR_*` bevel (`ViewBorder.js`); screen-size / detail menu wired |
| **UI / flow** | Wipe-melt transitions (menu ↔ game ↔ intermission); intermission stats with live kill/item/secret counts + WI patches |
| **Menu** | In-game pause/responder closer to vanilla; save/load slots wired via `Game.setSaveSystem` |
| **Audio** | `MusParser.js` for MUS → OPL playback |
| **Debug** | `localStorage.setItem('doomjs-corpse-debug','0')` disables corpse Z logging |

### Remaining tasks (priority order)

Use **§13** for file-level detail. Summary of what is **not** done yet:

| Priority | Task | Status |
|----------|------|--------|
| **P0** | Key-locked doors (`player.cards` checks) | Not started |
| **P0** | Teleports (`p_telept.c`) | Not started |
| **P1** | Power-ups — light amp / berserk fist damage / full palette effects | Partial |
| **P1** | Shotgun guy + demon monsters | Not started |
| **P2** | Crushing ceilings | Not started |
| **P2** | Raise floor / stairs specials | Not started |
| **P2** | Spectre spawn (fuzz draw exists) | Not started |
| **P3** | Automap polish (pan/zoom/follow keys) | Partial (overlay + player arrow; no pan/zoom UI) |
| **P3** | Save completeness (thinkers, sectors, RNG, line state) | Partial (JSON subset) |
| **P3** | E2–E4 map names + `MAP02+` progression | Partial (E1 only) |
| **P3** | Per-episode skies (SKY2/SKY3) | Not started |
| **P4** | Remaining Doom 1 monsters (cacodemon, baron, …) | Not started |
| **P4** | Cheats (`m_cheat.c`) | Not started |
| **P4** | Finale screens (`f_finale.c`) | Not started |
| **P4** | Center-screen pickup messages (`hu_stuff.c`) | Not started |
| **P4** | Intermission par times + animated map walk | Not started |
| **P5** | Doom II `MAP##` progression | Not started |
| **P5** | Nightmare mode (fast + respawn) | Not started |
| **—** | Multiplayer, demos, DeHackEd | Explicit non-goals |

---

## 1. Mission

Port the original Doom engine to JavaScript so it runs in a browser via `index.html`.

| Goal | Detail |
|------|--------|
| Fidelity | Preserve original game logic and data flow; behaviour should match the C source where practical |
| Structure | Sound OOP / SOLID — not a line-by-line transliteration of C globals |
| Runtime | Plain ES modules; no build step for local dev (static serve + `index.html`) |
| Display | Full-viewport canvas; internal 320×200 (classic) scaled to viewport |
| Reference | `DOOM-master/` is **read-only** — never edit it |

---

## 2. SOLID Rules (Mandatory)

### Single Responsibility (SRP)
One class/module = one reason to change. Example: `WadFile` reads lumps; `TextureManager` owns textures; `BspRenderer` draws — not one god object.

### Open/Closed (OCP)
Extend via new implementations. Example: `WebAudioSoundDriver` / `HowlerSoundDriver` implement `SoundDriver` without changing `GameLoop`.

### Liskov Substitution (LSP)
Subtypes honour interface contracts. Example: any video output must support the same present contract.

### Interface Segregation (ISP)
Small interfaces. Example: keyboard polling is separate from ticcmd building.

### Dependency Inversion (DIP)
Game code depends on abstractions, not browser APIs. `Game` receives sound/input/video via wiring in `main.js`.

---

## 3. Layer model (dependencies flow downward only)

```
index.html / main.js          ← bootstrap, wiring
        ↓
app/                          ← Game, GameLoop, PlaySession, scenes, saves
        ↓
game/ render/ audio/ ui/ wad/  ← subsystems
        ↓
core/ math/                   ← constants, fixed-point, geometry
        ↓
platform/                     ← canvas, input, sound drivers
        ↓
Browser APIs
```

**Rule:** `src/game/` and `src/render/` must not import `document`/`window` directly.

### C source → DoomJS mapping

| C prefix / files | DoomJS |
|------------------|--------|
| `i_*` | `src/platform/` |
| `m_*` (fixed, random, menu, cheat) | `src/math/`, `src/ui/` |
| `w_wad` | `src/wad/` |
| `p_*` (play, mobj, map, spec) | `src/game/` |
| `r_*` | `src/render/` |
| `s_*` | `src/audio/` |
| `g_game`, `d_main` | `src/app/` |
| `hu_*`, `st_*`, `wi_*`, `f_*` | `src/ui/`, `src/app/` |
| `doomdef`, `info` | `src/core/`, `src/game/mobjInfo.js`, `monsterInfo.js` |

When porting a C function, identify which **class owns the data** it mutates.

---

## 4. Directory layout (actual)

```
DoomJS/
├── index.html
├── PROJECT.md
├── src/
│   ├── main.js                 # Composition root
│   ├── app/
│   │   ├── Game.js             # State machine, save/load, level flow
│   │   ├── GameLoop.js         # 35 Hz tic accumulator
│   │   ├── PlaySession.js      # One level: tick order, thinkers, combat
│   │   ├── TitleScene.js, LevelIntroScene.js, IntermissionStatsScene.js
│   │   └── SaveGameStore.js    # localStorage JSON saves
│   ├── core/                   # gameConstants, renderConstants, inputButtons
│   ├── math/                   # fixed, tables, mapGeometry, viewMath
│   ├── wad/                    # WadFile, GameAssets, MusParser
│   ├── game/
│   │   ├── MapLoader.js, Level.js, Blockmap.js, MapCollision.js
│   │   ├── Player.js, PlayerMovement.js, PlayerThink.js, PlayerDeath.js
│   │   ├── PlayerPowers.js, ItemPickup.js, Hitscan.js, Mobj.js
│   │   ├── spec/               # Doors, FloorMovers, Plats, specials
│   │   ├── weapons/            # Psprites.js, weaponConstants.js
│   │   ├── debug/              # CorpseDebug.js (optional Z diagnostics)
│   │   └── monster/            # AI, missiles, combat (3 types only)
│   ├── render/                 # SoftwareRenderer, BSP, walls, planes, sprites, HUD
│   ├── audio/                  # SoundSystem, MusicSystem, OPL backend
│   ├── ui/                     # MenuController, WipeMelt, Gamemode
│   └── platform/               # Canvas, keyboard, mouse, sound drivers
└── assets/                     # Optional WAD (often gitignored)
```

---

## 5. Coding conventions

- ES modules; `camelCase` methods, `PascalCase` classes, `UPPER_SNAKE` for C-macro-style constants
- JSDoc on public APIs
- **Keep:** 35 tics/sec, fixed-point, WAD layouts, deterministic RNG for gameplay
- **Modernize:** manual memory → GC; function pointers → method dispatch; `byte*` → `Uint8Array`
- Native render buffer: **320×200** gameplay height (status bar uses lower portion per vanilla layout)
- Fail fast on missing WAD/lumps during development

---

## 6. Porting workflow

1. Locate C source in `linuxdoom-1.10/`
2. Identify data ownership (globals → instance fields)
3. Design JS class/interface
4. Port one vertical slice
5. Verify against vanilla behaviour on a known map
6. Update **§7** checklist and **§12** port status in this file

Do **not** bulk-translate entire `.c` files. One subsystem per change.

---

## 7. Implementation phases (accurate status)

Legend: `[x]` done · `[~]` partial · `[ ]` not started

### Phase 0 — Shell
- [x] Full-viewport canvas, ES module bootstrap
- [x] `GameLoop` with 35 Hz tic accumulator
- [x] `CanvasVideoOutput` — 320×200 buffer + scale-to-fit

### Phase 1 — Data
- [x] `WadFile` — WAD directory and lump I/O
- [x] `GameAssets` — PLAYPAL, COLORMAP, flats
- [x] `TextureManager`, sprite patches
- [x] User WAD file picker (`WadLoaderPrompt.js`) when fetch fails

### Phase 2 — Map
- [x] `MapLoader` — THINGS, LINEDEFS, SSECTORS, etc.
- [x] `Level`, `Blockmap`
- [x] Playable automap (`Automap.js`) — Tab toggle; explored sectors; `pw_allmap`; vanilla line colors; `player_arrow` (WHITE); auto-scale; safe fixed-point projection

### Phase 3 — Render
- [x] Software column/span/patch draw (`SoftwareRenderer`, `ColumnRenderer`, `SpanRenderer`)
- [x] BSP traverse (`BspRenderer`, `BspTraverser`, `WallDrawer`)
- [x] Floors/ceilings (`PlaneDrawer`), sky (single texture)
- [x] Sprites + psprites (`BillboardRenderer`, `SpritePatches`)
- [x] Palette / colormap / distance lighting / weapon `extralight`
- [x] Low detail wired (`ViewSize.js`, menu detail → walls, spans, **sprites**)
- [x] Screen-size menu wired (`ViewSize.js`, `Game.applyViewLayout`)
- [x] View border flats + bevel patches (`ViewBorder.js`, `R_DrawViewBorder`)
- [x] Fuzz draw for `MF_SHADOW` sprites (`PatchRenderer.drawPatchScaledFuzz`, invis power)
- [ ] Per-episode sky (`r_sky.c` SKY1/2/3)

### Phase 4 — Play simulation
- [x] `Mobj`, player spawn, `TicCmd`
- [x] Player movement (`PlayerMovement.js` — thrust, bob, view height)
- [x] Collision (`MapCollision.js` — tryMove, slide, hitscan, gravity/Z movement)
- [x] Corpse physics aligned with vanilla (`killMobj` immediate state, `momz`, `P_MobjThinker` tick order)
- [x] All 8 weapons (`Psprites.js`, `weaponConstants.js`, player missiles)
- [x] Item pickup (`ItemPickup.js`) — weapons, ammo, health, armor, keys, backpack
- [~] Player powers — invuln/berserk/invis/automap work; light amp (`pw_infrared`) not yet
- [x] Player death + use-to-respawn (reload level)
- [~] Monsters — **zombieman, imp, barrel only**
- [~] Map specials — doors/floors/plats subset (see §12.4)
- [x] Sector damage (nukage/slime/hellslime)
- [x] Exits (normal + secret)
- [ ] Key-locked doors (specials exist, **no card checks**)
- [ ] Teleports (`p_telept.c`)
- [ ] Crushers (`p_ceilng.c`)
- [ ] Light thinkers (`p_lights.c`)
- [ ] Stairs / many floor raise types
- [ ] Nightmare mode (fast monsters, respawn)
- [ ] Skill-based damage reduction (baby/HMP)

### Phase 5 — UI / meta
- [x] Status bar (`StatusBar.js`, `StatusBarFace.js`)
- [x] Menus (`MenuController.js`) — main, episode, skills, options, load/save slots
- [x] Title, level intro (E#M#), wipe melts (`WipeMelt.js` — menu/game/intermission)
- [~] Intermission — live stats + WI patches + count-up; **no par times**, no animated map walk
- [ ] Finale screens (`f_finale.c`)
- [ ] Center-screen pickup messages (`hu_stuff.c`)

### Phase 6 — Audio
- [x] SFX (`SoundSystem`, `SfxRegistry`, WAD `DS*` lumps)
- [x] Music (MUS → OPL3 via `MusParser.js`, `OplMusicBackend`)

### Phase 7 — Persistence & progression
- [~] Save/load — JSON in `localStorage` (`SaveGameStore.js`); **not** vanilla `p_saveg` binary
- [~] Saves: player + things snapshot; **missing** thinkers, sector heights, RNG, line specials state
- [~] E1 map progression (`MapNames.js`, `nextMapName`)
- [~] E2–E4 titles sparse; **MAP02+ progression not implemented**
- [ ] Episode end / boss finale flow

### Phase 8 — Explicit non-goals (unless requested)
- [ ] Multiplayer (`d_net.c`)
- [ ] Demo record/playback (`g_game.c`)
- [ ] Cheats (`m_cheat.c` — idkfa, idclev, idbehold, …)
- [ ] DeHackEd / BOOM extensions

---

## 12. Port status vs vanilla Doom

Last audited: **2026-07-15** against `linuxdoom-1.10`. Re-audit after major features.

### 12.1 Subsystem maturity

```
Rendering (3D)     █████████░  ~95%   episode skies
Automap (overlay)  ███████░░░  ~70%   core draw + player arrow; no pan/zoom UI
Player / weapons   ████████░░  ~80%   powers, nightmare, attack sprite missing
Monsters           ██░░░░░░░░  ~15%   3 types; corpse physics now vanilla-faithful
Map specials       ████░░░░░░  ~40%   no keys/teleport/crush/lights/stairs
Items / inventory  ███████░░░  ~70%   pickups yes; power effects mostly stub
Audio              ████████░░  ~80%   grows with content
UI / menus         ████████░░  ~85%   wipes + intermission stats; no finale
Saves              ████░░░░░░  ~40%   JSON subset of vanilla save state
Progression        █████░░░░░  ~50%   E1 ok; E2–4 / Doom II weak
Multi / demos      ░░░░░░░░░░   0%
Cheats             ░░░░░░░░░░   0%
```

### 12.2 Done well (vanilla parity acceptable)

| Area | Key files | Notes |
|------|-----------|-------|
| Map load | `MapLoader.js`, `Level.js` | Standard map lumps |
| Collision / movement | `MapCollision.js` | Slide, steps, drop-off, gravity, friction, hitscan |
| Corpse / mobj think | `MonsterThink.js`, `MobjCombat.js` | `P_MobjThinker` order; immediate death state; optional `CorpseDebug.js` |
| Player weapons | `Psprites.js`, `weaponConstants.js`, `Hitscan.js`, `MissileManager.js` | All 8 weapons |
| Software renderer | `BspRenderer.js`, `WallDrawer.js`, `PlaneDrawer.js`, `BillboardRenderer.js` | Core 3D; low-detail sprites; view border |
| Status bar | `StatusBar.js`, `StatusBarFace.js` | Arms widget uses `weaponowned[i+1]` for slot `i` (STGNUM2 = pistol, etc.) |
| Pickups (touch) | `ItemPickup.js`, `mobjInfo.js` | Broad catalog |
| Thinkers (subset) | `Doors.js`, `FloorMovers.js`, `Plats.js`, `ThinkerList.js` | Run before movement in `PlaySession.js` |
| Platform carry | `changeSector` / `thingHeightClip` in `MapCollision.js` | Player moves with lifts |
| Game loop | `GameLoop.js`, `PlaySession.js` | 35 Hz; thinkers → player move → weapons → monster XY/Z/state |
| Audio | `SoundSystem.js`, `MusicSystem.js` | SFX + OPL music |
| Menus / flow | `Game.js`, `MenuController.js`, `WipeMelt.js` | Title → menu → play → intermission (wipe transitions) |
| Intermission | `IntermissionStatsScene.js`, `PlaySession.endStats()` | Kill/item/secret counts from live play state |
| Automap | `Automap.js` | Tab overlay; sector fog; `AM_drawLineCharacter` player arrow; `am_map.c` colors |

### 12.3 Partial — known gaps

#### Player (`p_user.c`, `p_inter.c`, `p_pspr.c`)
- Light amp not implemented (`pw_infrared` missing from `NUMPOWERS`)
- Berserk fist damage boost not fully modeled (power granted; palette uses strength tint)
- No player mobj attack states (`S_PLAY_ATK`) during fire
- Nightmare: menu skill 5 exists; no respawn/fast logic (`P_NightmareRespawn`, `-1 tics`)

#### Monsters (`p_enemy.c`, `info.c`)
- **Spawned today:** zombieman (3004), imp (3001), barrel (2035) — see `mobjInfo.js`, `monsterInfo.js`
- **Fixed (2026-07-14):** corpse hover — vanilla collision (no map-specific hacks); `momz: 0` on spawn; `killMobj` → immediate `P_SetMobjState`; movement before state tick
- **Missing:** shotgun guy, demon, spectre, lost soul, cacodemon, baron, spider, cyberdemon, … + most `A_*` state actions

#### Line / sector specials (`p_spec.c`, `p_switch.c`)

**Implemented specials (representative):**

| Kind | Line specials (examples) |
|------|--------------------------|
| Doors | 1–4, 16, 26–34, 29, 50, 63, 90, 103, 105–110, 111–113, 117–118 |
| Floors lower | 10, 22, 23, 36, 38, 76, 82, 88, 101–102 |
| Plats | 14–15, 20–21 |
| Exits | 11, 51 (use), 52, 124 (cross) |

**Not implemented (blocks many maps):**

| Feature | Vanilla | DoomJS |
|---------|---------|--------|
| Key doors | 26–28, 32–34 check `player.cards` | Door movement only — **no key check** in `Doors.js` |
| Teleports | `p_telept.c`, specials 39, 97, 125, … | Missing |
| Crushers | `p_ceilng.c`, 41, 49, 71, … | `movePlane` has crush result type; no ceiling thinkers |
| Stairs / raise floors | 7, 9, 127, … | Missing |
| Scroll floors | 48, … | Missing (E1M1 slime scroll is cosmetic only) |
| Dynamic lights | `p_lights.c` | Static sector `lightLevel` only |
| One-shot buttons | `BUTTONTIME` retrigger rules | Partial via `SwitchList.js` |

See `UseSpecialLine.js`, `CrossSpecialLine.js` for exact `switch` cases.

#### Automap (`am_map.c`)
- **Done:** Tab overlay; visited-sector line reveal; computer map (`pw_allmap`) shows things; level-fit scale (`AM_findMinMaxBoundaries`); wall/TS wall/thing/player colors from vanilla macros; `player_arrow` rotated via `AM_rotate` + world projection (`fixedMul` — fixes overlapping-line overflow bug)
- **Missing:** Pan/zoom/follow keys, grid toggle, marks, cheat arrow, full `AMResponder` UI

#### Rendering
- Single sky texture; no episode SKY2/SKY3
- View border: **done** for reduced screen sizes (`ViewBorder.js`)

#### Saves (`p_saveg.c`)
- Format: JSON v1 in `Game.serializeSave()` / `deserializeSave()`
- Does not restore: door/floor/plat thinkers, sector floor/ceiling heights, missiles, RNG, cleared line specials

#### Progression (`g_game.c`, `wi_stuff.c`)
- `nextMapName()` handles `E#M#` only — not `MAP02`, `MAP03`, …
- `titleForMap()` has E1 names only
- No `f_finale.c` (bunny, cast, text)

### 12.4 Missing entirely

| Vanilla module | Purpose |
|----------------|---------|
| `d_net.c` | Multiplayer |
| `g_game.c` demos | `-playdemo` / `-recorddemo` |
| `m_cheat.c` | Cheat codes |
| `p_telept.c` | Teleport lines |
| `p_ceilng.c` | Crushing ceilings |
| `p_lights.c` | Flicker / strobe / glow |
| `am_map.c` (full) | Automap pan/zoom/follow UI beyond current overlay |
| `f_finale.c` | Episode end sequences |
| `hu_stuff.c` | HUD messages ("Picked up a clip") |

---

## 13. Priority roadmap

Use this when choosing what to port next. Goal: **complete Doom 1 (shareware + registered)** before Doom II polish.

| Priority | Task | Why | Primary files / C ref |
|----------|------|-----|------------------------|
| P0 | **Key-locked doors** | Blocks progression on E1M2+ | `Doors.js`, `PlayerCards.js` · `p_doors.c`, specials 26–28 |
| P0 | **Teleports** | Many maps | new `Teleports.js` · `p_telept.c` |
| P1 | **Power-ups** | Light amp, berserk fist | `ItemPickup.js`, `PlayerPowers.js` · `p_inter.c` |
| P1 | **Shotgun guy + demon** | E1 combat | `mobjInfo.js`, `monsterInfo.js`, states · `p_enemy.c` |
| P2 | **Crushing ceilings** | E1M3-style traps | new ceiling thinkers · `p_ceilng.c` |
| P2 | **Raise floor / stairs** | Unlocks geometry | `FloorMovers.js` · `p_floor.c`, `p_spec.c` |
| P2 | **Spectre spawn** | E1M9 | `mobjInfo.js` — fuzz draw done (`MF_SHADOW`) |
| P3 | **Automap polish** | Pan/zoom/keys | `Automap.js` · `am_map.c` (`AM_Responder`, marks, grid) |
| P3 | **Save completeness** | Thinkers + sectors | `Game.js`, `SaveGameStore.js` · `p_saveg.c` |
| P3 | **E2–E4 names + progression** | Full Doom 1 | `MapNames.js`, `Game.js` |
| P4 | **More monsters** | E2+ | `monsterInfo.js`, `mobjInfo.js` |
| P4 | **Cheats** | Dev/QOL | new module · `m_cheat.c` |
| P4 | **Finale screens** | Episode end | new scene · `f_finale.c` |
| P5 | **Doom II MAP## progression** | Commercial WAD | `MapNames.js`, `Gamemode.js` |
| — | Multiplayer, demos, DeHackEd | Only if explicitly requested | — |

---

## 14. Key file map

| If you need to… | Start here |
|-----------------|------------|
| Change tic order / what runs per frame | `PlaySession.js` |
| Debug corpse Z (optional) | `game/debug/CorpseDebug.js` — disable via `localStorage` |
| Player move, bob, view | `PlayerMovement.js` |
| Collision, slide, fall, hitscan | `MapCollision.js` |
| Corpse death / combat states | `MobjCombat.js`, `MonsterThink.js` |
| Weapons / firing | `Psprites.js`, `weaponConstants.js` |
| Pickups / give weapon | `ItemPickup.js` |
| Line use specials | `UseSpecialLine.js`, `UseLines.js` |
| Line cross specials | `CrossSpecialLine.js` |
| Doors | `Doors.js` |
| Floors / plats | `FloorMovers.js`, `Plats.js` |
| Monster AI | `MonsterThink.js`, `EnemyMove.js` |
| Projectiles | `MissileManager.js`, `missileInfo.js` |
| Render one frame | `Game.js` → `BspRenderer.js` |
| In-game automap (Tab) | `Automap.js` |
| View border (small screens) | `ViewBorder.js` |
| HUD | `StatusBar.js` |
| Menus | `MenuController.js` |
| Level load / start / exit | `Game.js`, `MapLoader.js` |
| Save / load | `Game.js`, `SaveGameStore.js` |
| Constants (GRAVITY, flags, …) | `core/gameConstants.js`, `game/mobjFlags.js` |
| Map thing → mobj | `mobjInfo.js`, `MapThingSpawner.js` |

### PlaySession tick order (reference)

Matches vanilla `P_Tick` / `P_MobjThinker` ordering for monsters (movement before state).

```
PlayerMovement.move (if alive)
thinkers.runAll()          // doors, floors, plats
collision.xyMovement(player)
collision.zMovement(player)
PlayerMovement.calcHeight
tickPlayerPowers + sector damage
thinkUse + thinkWeaponChange
monsterCtx → hitscan + missiles   // death-state actions on kill tic
psprites.think             // weapons / hitscan (may kill monsters)
tickMonsters               // XY → Z → state (per mobj)
missiles.tick
tickCorpseDebug (optional) // console [corpse] Z diagnostics
// stats: kills, items, secrets
```

---

## 8. Agent instructions

When working on DoomJS:

1. Read this file — especially **§12** and **§13**
2. Respect SOLID and the layer model
3. Keep `index.html` thin; logic in `src/`
4. Minimize scope — one subsystem per task
5. Do **not** modify `DOOM-master/`
6. Do **not** add npm/webpack unless the user requests it
7. Update **§7**, **§12**, and **§15** when completing port milestones

When unsure where code belongs: *Which layer owns this data, and which interface should the rest of the engine use?*

---

## 9. Local development

```powershell
cd "DoomJS"
python -m http.server 8080
# → http://localhost:8080
```

User supplies a legally obtained IWAD (e.g. `doom.wad`). File picker available if default fetch fails.

---

## 10. Non-goals (unless requested)

- Multiplayer / `d_net`
- Node.js server port
- TypeScript migration
- Bundling commercial IWAD assets into the repo
- Non-faithful gameplay tweaks

---

## 15. Changelog

| Date | Change |
|------|--------|
| 2026-07-12 | Initial project guide; Phase 0 canvas shell |
| 2026-07-12 | Player movement: GameLoop, KeyboardInput, MapCollision, PlaySession |
| 2026-07-14 | Major port audit documented in §12–§14; phase checklist corrected to match codebase |
| 2026-07-14 | Vanilla Z movement (gravity/fall); all 8 weapons; HUD arms index fix (`weaponowned[i+1]`) |
| 2026-07-14 | Rendering: low-detail sprites, view border (`ViewBorder.js`), screen size/detail menu |
| 2026-07-14 | UI flow: wipe melts; intermission stats (kills/items/secrets); menu pause keys |
| 2026-07-14 | Audio: `MusParser.js` for MUS playback |
| 2026-07-14 | **Corpse hover fix:** vanilla physics (reverted map hacks); `momz` init; immediate `killMobj`; `P_MobjThinker` tick order; `CorpseDebug.js` |
| 2026-07-15 | **Automap fix:** `fixedMul` line projection (int32 overflow); level-fit scale; vanilla `player_arrow` + WHITE (`0xD1`); `AM_drawLineCharacter` pipeline |

---

## Appendix A — Vanilla line special checklist

When implementing a new special, add a case to `UseSpecialLine.js` and/or `CrossSpecialLine.js`, then register in this appendix.

**Use specials in vanilla (`p_switch.c` P_UseSpecialLine) not yet in DoomJS (sample):** 7, 9, 18, 41, 42, 43, 45, 49, 55, 60–62, 64–70, 71, 122, 127, 131, 133, 135, 137, 140, …

**Cross specials not yet in DoomJS (sample):** 39, 48, 56, 57, 58, 59, 72, 73, 74, 75, 77, 79, 80, 81, 84, 86, 87, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, …

Always verify against `p_switch.c` in the reference tree — the authoritative list is the big `switch` statements there.
