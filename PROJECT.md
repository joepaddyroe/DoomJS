# DoomJS — Project Guide

Canonical instructions for building and maintaining this port. **Read this file before making structural changes.** Update it when architecture, conventions, or phase status change.

---

## 1. Mission

Port the original Doom engine (`../DOOM-master/linuxdoom-1.10/`) to JavaScript so it runs locally in a browser via `index.html`.

| Goal | Detail |
|------|--------|
| Fidelity | Preserve original game logic and data flow; behaviour should match the C source where practical |
| Structure | Use sound OOP and SOLID design — not a line-by-line transliteration of C globals |
| Runtime | Plain ES modules, no build step required for local development (open `index.html` or serve statically) |
| Display | Full-viewport HTML canvas; internal render resolution may differ from display size |
| Reference | `DOOM-master/` is **read-only reference** — never edit it |

---

## 2. SOLID Rules (Mandatory)

Apply these on every change. If a design violates one, refactor before adding more code.

### Single Responsibility (SRP)
- One class/module = one reason to change.
- Example: `WadReader` loads lump data; `TextureCache` owns texture lookup; `Renderer` draws — not one “DoomEngine” god object.

### Open/Closed (OCP)
- Extend behaviour via new implementations or composition, not by editing stable core classes.
- Example: add `WebAudioSoundDriver` implementing `ISoundDriver` without changing `GameLoop`.

### Liskov Substitution (LSP)
- Subtypes must honour their interface contracts.
- Example: any `IVideoOutput` (`Canvas2DOutput`, future `WebGLOutput`) must support the same `present(buffer)` contract.

### Interface Segregation (ISP)
- Small, focused interfaces — consumers depend only on what they use.
- Example: `IInputSource` (poll events) is separate from `IInputMapper` (keys → game actions).

### Dependency Inversion (DIP)
- High-level game code depends on abstractions, not browser APIs.
- Example: `Game` receives `IVideoOutput`, `ISoundDriver`, `IInputSource`, `IWadLoader` via constructor injection — never imports `canvas.getContext` directly.

---

## 3. Object-Oriented Architecture

### Layer model (dependencies flow downward only)

```
index.html / main.js          ← bootstrap, wiring
        ↓
Application / GameLoop        ← tick, state machine, scene transitions
        ↓
Subsystems                    ← game, play, render, sound, menu, wad
        ↓
Domain                        ← mobj, map, thinker, ticcmd, fixed math
        ↓
Platform abstractions         ← video, input, sound, timing, filesystem
        ↓
Browser APIs                  ← canvas, Web Audio, keyboard, fetch/File
```

**Rule:** Domain and subsystems must not import browser globals. Platform code implements interfaces defined above it.

### Core types (planned)

| Type | Responsibility |
|------|----------------|
| `Game` | Owns high-level state (`GameMode`, level load, pause, demo) |
| `GameLoop` | Fixed tic rate (35 Hz), dispatches `tick()` and `render()` |
| `Level` | Map geometry, sectors, linesides, things |
| `Mobj` (MapObject) | Entity position, momentum, state machine |
| `Thinker` | Per-tic logic attached to world objects |
| `Renderer` | BSP traverse, seg/plane/sprite draw |
| `WadFile` / `WadLump` | WAD archive and lump access |
| `Fixed` | 16.16 fixed-point math (port of `m_fixed`) |
| `TicCmd` | One frame of player input |

Prefer **composition** over deep inheritance. Use inheritance only for true “is-a” substitutability (e.g. `Thinker` subclasses).

### Mapping from C source (reference only)

| C prefix / files | DoomJS module (planned) |
|------------------|-------------------------|
| `i_*` (video, sound, system, net) | `src/platform/` |
| `m_*` (fixed, random, menu, cheat) | `src/math/`, `src/ui/` |
| `w_wad` | `src/wad/` |
| `p_*` (play, mobj, map, setup) | `src/game/` |
| `r_*` (render) | `src/render/` |
| `s_*` / `sounds` | `src/audio/` |
| `g_game`, `d_main` | `src/app/` |
| `hu_*`, `st_*`, `wi_*`, `f_*` | `src/ui/` |
| `doomdef`, `doomstat`, `info` | `src/core/` |

When porting a C function, identify which **class owns the data** it mutates. Move globals into that instance.

---

## 4. Directory Layout

Create folders as features are implemented — do not scaffold everything upfront.

```
DoomJS/
├── index.html              # Entry point; minimal — only bootstraps main module
├── PROJECT.md              # This file
├── src/
│   ├── main.js             # Composition root: wire dependencies, start GameLoop
│   ├── app/                # GameLoop, Game, application state
│   ├── core/               # Constants, enums, shared types (from doomdef, info)
│   ├── math/               # Fixed-point, trig tables, bbox
│   ├── wad/                # WAD loading and lump I/O
│   ├── game/               # Play simulation (mobj, map, thinkers)
│   ├── render/             # Renderer and draw pipeline
│   ├── audio/              # Sound subsystem
│   ├── ui/                 # HUD, status bar, menus, intermission
│   └── platform/
│       ├── video/          # Canvas output, framebuffer
│       ├── input/          # Keyboard / pointer
│       ├── sound/          # Web Audio adapter
│       └── timing/         # requestAnimationFrame + tic accumulator
└── assets/                 # Optional local IWAD/PWAD (gitignored if large)
```

---

## 5. Coding Conventions

### JavaScript
- ES modules (`import` / `export`); `"type": "module"` on script tags
- Classes for stateful subsystems; plain functions for pure helpers (e.g. fixed-point ops)
- `camelCase` for methods/variables; `PascalCase` for classes; `UPPER_SNAKE` for constants mirroring C macros
- JSDoc on public class methods and interfaces (`@typedef` for structural types if no TypeScript)
- No default exports except possibly `main.js`

### Fidelity vs idiomatic JS
- **Keep:** fixed-point math, tic rate (35 tics/sec), state tables, WAD lump layouts, deterministic RNG where gameplay depends on it
- **Modernize:** manual memory (`z_zone`) → GC; function pointers → strategy objects / method dispatch; `byte*` → `Uint8Array`

### Canvas / video
- Native resolution target: **320×200** (classic Doom), scaled to viewport
- Letterbox or stretch via a dedicated `CanvasVideoOutput` — scaling logic lives in platform layer only
- Separate **game framebuffer** from **display canvas** (SRP)

### Error handling
- Fail fast at load time (missing WAD, bad lump) with clear console errors
- Avoid silent fallbacks that hide port bugs during development

---

## 6. Porting Workflow

For each feature:

1. **Locate** the C source in `DOOM-master/linuxdoom-1.10/`
2. **Identify** data ownership — list globals the code reads/writes
3. **Design** the JS class(es) and interface(s) before writing logic
4. **Port** logic incrementally; keep diffs focused on one subsystem
5. **Verify** behaviour against C where possible (same map, same tic, same output)
6. **Update** the Phase checklist below

Do **not** bulk-translate entire `.c` files in one commit. Port vertical slices (e.g. “load WAD → read map lump → draw one frame”).

---

## 7. Implementation Phases

Track progress here. Mark items `[x]` when done.

### Phase 0 — Shell
- [x] Full-viewport canvas (`index.html`)
- [x] ES module bootstrap (`src/main.js`)
- [x] `GameLoop` with tic accumulator
- [x] `CanvasVideoOutput` with 320×200 buffer + scale-to-fit

### Phase 1 — Data
- [x] `WadFile` — parse WAD directory and read lumps
- [x] `GameAssets` — PLAYPAL, COLORMAP, flat lookup
- [ ] User WAD file picker (browser has no filesystem like C)

### Phase 2 — Map
- [x] `MapLoader` — load map lumps (E1M1 tested)
- [x] Top-down automap debug view (`MapTopDownRenderer`)
- [ ] Fixed-point math integration for 3D view

### Phase 3 — Render
- [x] Software draw core (`SoftwareRenderer`, column/span/patch drawers — `r_draw.c`)
- [ ] BSP (`r_bsp`)
- [ ] Segs / planes / sky (`r_segs`, `r_plane`, `r_sky`)
- [ ] Sprites (`r_things`, `r_draw` integration)
- [ ] Palette / colormap from PLAYPAL / COLORMAP lumps

### Phase 4 — Play
- [x] `Mobj` and player entity (subset of `p_mobj`)
- [x] Player movement (`p_user` — P_Thrust, P_MovePlayer, P_CalcHeight)
- [x] Collision (`p_map` — P_CheckPosition, P_TryMove, P_XYMovement, P_SlideMove)
- [ ] Game state (`g_game`)

### Phase 5 — Polish
- [ ] Status bar / HUD (`st_*`, `hu_*`)
- [ ] Menu (`m_menu`)
- [ ] Sound (`i_sound`, Web Audio)
- [ ] Save/load (`p_saveg`) — likely `localStorage` or download

---

## 8. Agent Instructions

When working on DoomJS, **always**:

1. Read `PROJECT.md` first
2. Respect SOLID and the layer model — reject changes that import `document`/`window` from `src/game/` or `src/render/`
3. Keep `index.html` thin; new logic goes in `src/`
4. Prefer extending the planned module map over inventing ad-hoc file names
5. Match existing code style in the file being edited
6. Minimize scope — one subsystem per task
7. Do not modify `DOOM-master/`
8. Do not add npm/webpack unless the user explicitly requests a build toolchain
9. Update Phase checklist when completing a milestone
10. Update this document if introducing a new subsystem, interface, or convention

When **unsure where code belongs**, ask:

> “Which layer owns this data, and which interface should the rest of the engine use to reach it?”

If the answer is unclear, propose a class diagram or module list in the PR/task before implementing.

---

## 9. Local Development

Open directly:

```
DoomJS/index.html
```

Or serve statically (needed once ES modules load separate files):

```powershell
cd "DoomJS"
python -m http.server 8080
# → http://localhost:8080
```

---

## 10. Non-Goals (Unless Requested)

- Multiplayer / `d_net` networking
- Node.js server port
- TypeScript migration
- Asset extraction from commercial IWADs (user supplies their own legally obtained WAD)
- Pixel-shader remasters or non-faithful gameplay tweaks

---

## 11. Changelog

| Date | Change |
|------|--------|
| 2026-07-12 | Initial project guide; Phase 0 canvas shell complete |
| 2026-07-12 | Player movement: GameLoop, KeyboardInput, MapCollision, PlaySession |
