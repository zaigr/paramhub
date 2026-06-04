import { render } from 'ink';
import React from 'react';
import type { Provider } from '@paramhub/types';
import { MockProviderFactory } from '@paramhub/types/mock';
import { loadConfig } from './config/loader.js';
import { ProviderManager } from './providers/manager.js';
import { enterAltScreen, exitAltScreen } from './utils/terminal.js';
import App from './app.js';

async function main() {
  const config = await loadConfig();

  const manager = new ProviderManager();
  await manager.loadAll(config.providers);

  let providers: Provider[] = manager.getAll();

  if (providers.length === 0) {
    const mock = MockProviderFactory.create();
    await mock.init({});
    providers = [mock];
  }

  for (const failure of manager.getFailures()) {
    console.error(`[paramhub] Failed to load ${failure.package}: ${failure.error.message}`);
  }

  enterAltScreen();

  const instance = render(React.createElement(App, { providers, config }));

  instance.waitUntilExit().then(async () => {
    await manager.disposeAll();
    exitAltScreen();
  });

  process.on('SIGINT', () => {
    exitAltScreen();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    exitAltScreen();
    process.exit(0);
  });
}

main().catch((err) => {
  exitAltScreen();
  console.error('Fatal error:', err);
  process.exit(1);
});
