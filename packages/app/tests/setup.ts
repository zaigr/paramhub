/**
 * Global test setup.
 *
 * Redirects the app's config and state directories into a per-run temp dir.
 * Without this, anything that persists a preference (e.g. pressing "t" in an
 * integration test) writes into the developer's real home.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paramhub-test-home-'));

process.env.XDG_STATE_HOME = path.join(root, 'state');
process.env.XDG_CONFIG_HOME = path.join(root, 'config');
// Windows resolves these instead of the XDG variables.
process.env.LOCALAPPDATA = path.join(root, 'local-app-data');
process.env.APPDATA = path.join(root, 'app-data');

process.on('exit', () => {
  fs.rmSync(root, { recursive: true, force: true });
});
