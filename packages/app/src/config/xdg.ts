import os from 'node:os';
import path from 'node:path';

export function getConfigDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) return path.join(appData, 'paramhub');
    return path.join(os.homedir(), 'AppData', 'Roaming', 'paramhub');
  }
  const xdgHome = process.env.XDG_CONFIG_HOME;
  if (xdgHome) return path.join(xdgHome, 'paramhub');
  return path.join(os.homedir(), '.config', 'paramhub');
}

/**
 * Directory for state the app writes itself (last-used list mode, etc.).
 *
 * Kept out of the config dir on purpose: config.yaml is hand-written and
 * carries the user's comments, and there is no way to update one field of it
 * without rewriting the whole file and losing them.
 */
export function getStateDir(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) return path.join(localAppData, 'paramhub');
    return path.join(os.homedir(), 'AppData', 'Local', 'paramhub');
  }
  const xdgState = process.env.XDG_STATE_HOME;
  if (xdgState) return path.join(xdgState, 'paramhub');
  return path.join(os.homedir(), '.local', 'state', 'paramhub');
}
