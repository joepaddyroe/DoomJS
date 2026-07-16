/**
 * Multiplayer lobby overlay + discreet top-right toggle.
 * Lobby starts hidden so single-player is the default experience.
 */
export class NetLobby {
  /**
   * @param {import('../net/NetGameSession.js').NetGameSession} session
   * @param {{ defaultRoom?: string, defaultMap?: string, startOpen?: boolean }} [opts]
   */
  constructor(session, opts = {}) {
    this.session = session;
    this.defaultRoom = opts.defaultRoom ?? 'doom';
    this.defaultMap = opts.defaultMap ?? 'E1M1';
    this.startOpen = opts.startOpen ?? false;
    this.root = null;
    this.panel = null;
    this.toggleBtn = null;
    this.logEl = null;
    this.open = false;
  }

  mount() {
    if (this.root) {
      return;
    }
    const root = document.createElement('div');
    root.id = 'doomjs-net-ui';
    root.innerHTML = `
      <style>
        #doomjs-net-ui {
          position: fixed;
          inset: 0;
          z-index: 40;
          pointer-events: none;
          font-family: "Segoe UI", system-ui, sans-serif;
        }
        #doomjs-net-toggle {
          pointer-events: auto;
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 51;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.07);
          box-shadow: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          opacity: 0.28;
          transition: opacity 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }
        #doomjs-net-toggle:hover,
        #doomjs-net-toggle:focus-visible {
          opacity: 0.65;
          background: rgba(255, 255, 255, 0.16);
          outline: none;
        }
        #doomjs-net-toggle[aria-expanded="true"] {
          opacity: 0.55;
          background: rgba(196, 92, 38, 0.45);
          border-color: rgba(196, 92, 38, 0.7);
        }
        #doomjs-net-panel {
          pointer-events: auto;
          position: absolute;
          top: 1.25rem;
          left: 50%;
          transform: translateX(-50%);
          width: min(420px, calc(100% - 2rem));
          background: rgba(18, 20, 28, 0.94);
          color: #e8e6e0;
          border: 1px solid #3a4258;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 12px 40px rgba(0,0,0,0.45);
        }
        #doomjs-net-panel[hidden] {
          display: none !important;
        }
        #doomjs-net-panel h2 { margin: 0 0 0.35rem; font-size: 1.05rem; }
        #doomjs-net-panel p { margin: 0 0 0.75rem; color: #9aa0b0; font-size: 0.85rem; }
        #doomjs-net-panel .row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
        #doomjs-net-panel input {
          flex: 1; min-width: 7rem; background: #1c2030; border: 1px solid #333a4d;
          color: #e8e6e0; padding: 0.4rem 0.5rem; border-radius: 4px;
        }
        #doomjs-net-panel button.action {
          background: #c45c26; color: #fff; border: 0; border-radius: 4px;
          padding: 0.4rem 0.65rem; font-weight: 600; cursor: pointer;
        }
        #doomjs-net-panel button.action.secondary { background: #3a4258; }
        #doomjs-net-panel button.action:disabled { opacity: 0.45; cursor: not-allowed; }
        #doomjs-net-panel .log {
          margin-top: 0.5rem; font-family: ui-monospace, Consolas, monospace;
          font-size: 0.75rem; white-space: pre-wrap; max-height: 9rem; overflow: auto;
          color: #b8c0d0;
        }
      </style>
      <button type="button" id="doomjs-net-toggle" title="Multiplayer" aria-label="Toggle multiplayer lobby" aria-expanded="false"></button>
      <div id="doomjs-net-panel" role="dialog" aria-label="Multiplayer lobby" hidden>
        <h2>Multiplayer</h2>
        <p>Optional coop over the relay. Close this and use the Doom menu for normal single-player.</p>
        <div class="row">
          <input id="nl-relay" value="${this.session.url}" />
        </div>
        <div class="row">
          <input id="nl-room" value="${this.defaultRoom}" />
          <input id="nl-map" value="${this.defaultMap}" title="Map" />
        </div>
        <div class="row">
          <button type="button" class="action" id="nl-connect">Connect</button>
          <button type="button" class="action secondary" id="nl-create" disabled>Create host</button>
          <button type="button" class="action secondary" id="nl-join" disabled>Join</button>
          <button type="button" class="action secondary" id="nl-ready" disabled>Ready</button>
          <button type="button" class="action secondary" id="nl-start" disabled>Start</button>
          <button type="button" class="action secondary" id="nl-close">Close</button>
        </div>
        <div class="log" id="nl-log">Idle.</div>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.panel = root.querySelector('#doomjs-net-panel');
    this.toggleBtn = root.querySelector('#doomjs-net-toggle');
    this.logEl = root.querySelector('#nl-log');

    this.toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggle();
    });
    root.querySelector('#nl-close').addEventListener('click', () => this.hide());
    root.querySelector('#nl-connect').addEventListener('click', () => void this._connect());
    root.querySelector('#nl-create').addEventListener('click', () => {
      const room = root.querySelector('#nl-room').value.trim() || 'doom';
      this.session.createRoom(room);
      this.log(`Creating room ${room}…`);
    });
    root.querySelector('#nl-join').addEventListener('click', () => {
      const room = root.querySelector('#nl-room').value.trim() || 'doom';
      this.session.joinRoom(room);
      this.log(`Joining ${room}…`);
    });
    root.querySelector('#nl-ready').addEventListener('click', () => {
      this.session.ready(true);
      this.log('Ready.');
    });
    root.querySelector('#nl-start').addEventListener('click', () => {
      const map = root.querySelector('#nl-map').value.trim() || 'E1M1';
      this.session.sendSetup({
        map,
        skill: 3,
        seed: 1,
        deathmatch: 0,
      });
      this.session.startMatch();
      this.log('Starting…');
    });

    this.session.onLobby = (msg) => {
      if (msg.type === 'joinRoom') {
        this.log(`Joined as player ${msg.playerId}${msg.host ? ' (host)' : ''}`);
        root.querySelector('#nl-ready').disabled = false;
        root.querySelector('#nl-start').disabled = !msg.host;
      }
      if (msg.type === 'roomState') {
        const ready = (msg.players ?? []).map((p) => `P${p.playerId}${p.ready ? '*' : ''}`).join(' ');
        this.log(`Room ${msg.roomId}: ${ready || 'empty'} started=${msg.started}`);
      }
    };
    this.session.onError = (err) => this.log(`ERROR: ${err}`);

    if (this.startOpen) {
      this.show();
    } else {
      this.hide();
    }
  }

  toggle() {
    if (this.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** @param {string} line */
  log(line) {
    if (!this.logEl) {
      return;
    }
    const prev = this.logEl.textContent === 'Idle.' ? '' : `${this.logEl.textContent}\n`;
    this.logEl.textContent = `${prev}${line}`.slice(-1200);
  }

  hide() {
    this.open = false;
    if (this.panel) {
      this.panel.hidden = true;
    }
    this.toggleBtn?.setAttribute('aria-expanded', 'false');
  }

  show() {
    this.open = true;
    if (this.panel) {
      this.panel.hidden = false;
    }
    this.toggleBtn?.setAttribute('aria-expanded', 'true');
  }

  async _connect() {
    const url = this.root.querySelector('#nl-relay').value.trim();
    this.session.url = url;
    this.session.client.url = url;
    try {
      const hello = await this.session.connect();
      this.log(`Connected ${hello.clientId}`);
      this.root.querySelector('#nl-create').disabled = false;
      this.root.querySelector('#nl-join').disabled = false;
    } catch (err) {
      this.log(`Connect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
