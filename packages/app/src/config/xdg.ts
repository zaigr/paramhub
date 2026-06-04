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
