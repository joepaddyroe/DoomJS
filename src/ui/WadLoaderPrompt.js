import { WadFile } from '../wad/WadFile.js';

/**
 * Full-screen prompt to load a WAD from disk (GitHub Pages / missing local file).
 * @returns {Promise<WadFile>}
 */
export function promptForWadFile() {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.id = 'wad-loader';
    overlay.innerHTML = `
      <div class="wad-loader-panel">
        <h1>DoomJS</h1>
        <p class="wad-loader-lead">Load a WAD file to play.</p>
        <p class="wad-loader-note">You must own a copy of Doom. Select <code>doom.wad</code> or <code>doom2.wad</code> from your machine — it is not uploaded anywhere.</p>
        <label class="wad-loader-button">
          Choose WAD file
          <input type="file" accept=".wad,.WAD" hidden />
        </label>
        <p class="wad-loader-error" hidden></p>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('input');
    const errorEl = overlay.querySelector('.wad-loader-error');

    /** @param {string} message */
    const showError = (message) => {
      errorEl.textContent = message;
      errorEl.hidden = false;
    };

    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      errorEl.hidden = true;

      try {
        const wad = await WadFile.load(await file.arrayBuffer());
        overlay.remove();
        resolve(wad);
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Invalid WAD file');
        input.value = '';
      }
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        overlay.remove();
        reject(new Error('WAD load cancelled'));
      }
    });
  });
}
