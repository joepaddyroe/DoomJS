/**
 * Minimal DOM lobby for ?net=1 (does not alter SP UI when unused).
 */
export class NetLobby {
  /**
   * @param {import('./NetGameSession.js').NetGameSession} session
   * @param {{ defaultRoom?: string, defaultMap?: string }} [opts]
   */
  constructor(session, opts = {}) {
    this.session = session;
    this.defaultRoom = opts.defaultRoom ?? 'doom';
    this.defaultMap = opts.defaultMap ?? 'E1M1';
    this.root = null;
    this.logEl = null;
  }

  mount() {
    if (this.root) {
      return;
    }
    const root = document.createElement('div');
    root.id = 'doomjs-net-lobby';
    root.innerHTML = `
      <style>
        #doomjs-net-lobby {
          position: fixed; inset: 0; z-index: 40;
          display: flex; align-items: flex-start; justify-content: center;
          padding: 1.25rem; pointer-events: none;
          font-family: "Segoe UI", system-ui, sans-serif;
        }
        #doomjs-net-lobby .panel {
          pointer-events: auto;
          width: min(420px, 100%);
          background: rgba(18, 20, 28, 0.94);
          color: #e8e6e0;
          border: 1px solid #3a4258;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 12px 40px rgba(0,0,0,0.45);
        }
        #doomjs-net-lobby h2 { margin: 0 0 0.35rem; font-size: 1.05rem; }
        #doomjs-net-lobby p { margin: 0 0 0.75rem; color: #9aa0b0; font-size: 0.85rem; }
        #doomjs-net-lobby .row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
        #doomjs-net-lobby input {
          flex: 1; min-width: 7rem; background: #1c2030; border: 1px solid #333a4d;
          color: #e8e6e0; padding: 0.4rem 0.5rem; border-radius: 4px;
        }
        #doomjs-net-lobby button {
          background: #c45c26; color: #fff; border: 0; border-radius: 4px;
          padding: 0.4rem 0.65rem; font-weight: 600; cursor: pointer;
        }
        #doomjs-net-lobby button.secondary { background: #3a4258; }
        #doomjs-net-lobby button:disabled { opacity: 0.45; cursor: not-allowed; }
        #doomjs-net-lobby .log {
          margin-top: 0.5rem; font-family: ui-monospace, Consolas, monospace;
          font-size: 0.75rem; white-space: pre-wrap; max-height: 9rem; overflow: auto;
          color: #b8c0d0;
        }
        #doomjs-net-lobby.hidden { display: none; }
      </style>
      <div class="panel">
        <h2>DoomJS net lobby</h2>
        <p>Lockstep coop (experimental). Start DoomJSRelay, then host/join here.</p>
        <div class="row">
          <input id="nl-relay" value="${this.session.url}" />
        </div>
        <div class="row">
          <input id="nl-room" value="${this.defaultRoom}" />
          <input id="nl-map" value="${this.defaultMap}" title="Map" />
        </div>
        <div class="row">
          <button type="button" id="nl-connect">Connect</button>
          <button type="button" id="nl-create" class="secondary" disabled>Create host</button>
          <button type="button" id="nl-join" class="secondary" disabled>Join</button>
          <button type="button" id="nl-ready" class="secondary" disabled>Ready</button>
          <button type="button" id="nl-start" class="secondary" disabled>Start</button>
        </div>
        <div class="log" id="nl-log">Idle.</div>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.logEl = root.querySelector('#nl-log');

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
    this.root?.classList.add('hidden');
  }

  show() {
    this.root?.classList.remove('hidden');
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
