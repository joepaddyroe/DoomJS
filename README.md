# DoomJS

Browser-based port of the original Doom software renderer and game logic, written in JavaScript (ES modules).

## Requirements

- A copy of `doom.wad` in the `DoomJS` directory (not included)
- A static file server (e.g. `python -m http.server 8080`)

## Run

```bash
cd DoomJS
python -m http.server 8080
```

Open `http://127.0.0.1:8080/index.html`, click the canvas to focus, then use WASD and arrow keys to move and turn.

## Reference

The original C source in `../DOOM-master/` is read-only reference material for this port.

See [PROJECT.md](./PROJECT.md) for architecture and development guidelines.
