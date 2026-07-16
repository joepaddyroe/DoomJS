# DoomJS

Browser-based port of the original Doom software renderer and game logic, written in JavaScript (ES modules).

## Requirements

- A legally obtained IWAD (`doom.wad` or `doom2.wad`) — place `doom.wad` in the project folder, or pick a file when prompted (not uploaded anywhere)
- A static file server (e.g. `python -m http.server 8080`)

## Run

```bash
cd DoomJS
python -m http.server 8080
```

Open `http://127.0.0.1:8080/index.html`, click the canvas to focus and capture the mouse, then play.

## Controls

Click the canvas before playing so keyboard and mouse input reach the game. Mouse look is disabled while menus are open.

### In-game

| Action | Input |
|--------|--------|
| Move forward / back / strafe | **W** / **S** / **A** / **D** |
| Turn / look | **Mouse** (move left/right; sensitivity in Options) |
| Fire | **Left mouse**, **Ctrl**, or **Space** |
| Use (doors, switches) | **Right mouse**, **E**, or **Enter** |
| Select weapon | **1**–**7** |
| Automap | **Tab** (toggle overlay) |
| Pause menu | **Escape** |

### Menus (title, pause, options, save/load)

| Action | Input |
|--------|--------|
| Move selection | **↑** / **↓** |
| Adjust slider | **←** / **→** (on slider rows) |
| Activate item | **Enter** or **Space** |
| Hotkey letter / digit | Matching **A–Z** or **0–9** on menu rows |
| Go back one level | **Backspace** |
| Close menu | **Escape** |
| Confirm / dismiss message | **Y** / **N**, or any key for simple prompts |

## Port status

Last audited **2026-07-15** against `linuxdoom-1.10`. Full gap analysis lives in [PROJECT.md](./PROJECT.md) §12.

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
Multi / demos      ██░░░░░░░░  ~15%   DoomECS + DoomJSRelay scaffold; not in SP loop
Cheats             ░░░░░░░░░░   0%
```

## Deterministic multiplayer (opt-in)

Single-player is unchanged. Experimental packages on this branch:

| Folder | Purpose |
|--------|---------|
| [DoomECS/](./DoomECS/) | Deterministic ECS, Quantum-style predict/rollback inputs, action replay |
| [DoomJSRelay/](./DoomJSRelay/) | Thin Node WebSocket relay (lobby + confirmed ticcmds) |
| [src/net/RelayBridge.js](./src/net/RelayBridge.js) | Optional browser bridge (not loaded by default) |

```bash
cd DoomECS && npm test
cd ../DoomJSRelay && npm install && npm test && npm run demo
```

### Toy ECS demo (checksum sandbox)
1. `cd DoomJSRelay && npm start`
2. `cd DoomJS && python -m http.server 8080`  ← must be DoomJS root
3. Two tabs: http://127.0.0.1:8080/demo/net-demo.html

### Real Doom lockstep (experimental)
1. `cd DoomJSRelay && npm start`
2. `cd DoomJS && python -m http.server 8080`
3. Two tabs: http://127.0.0.1:8080/index.html?net=1
4. Lobby: Connect → Create host / Join → Ready → Start (host)
5. Both load the map; move with WASD — you should see the other player’s `PLAY` sprite

## Reference

The original C source in `../DOOM-master/` is read-only reference material for this port.

See [PROJECT.md](./PROJECT.md) for architecture, file map, and development guidelines.
