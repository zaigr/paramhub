import { createRequire } from 'node:module';
import { render } from 'ink';
import React from 'react';
import { stringify } from 'yaml';
import type { Provider } from '@paramhub/types';
import { MockProviderFactory } from '@paramhub/types/mock';
import { parseCliArgs, USAGE } from './cli-args.js';
import { loadConfig } from './config/loader.js';
import { loadUiState } from './config/ui-state.js';
import { renderConfigTemplate } from './config/template.js';
import { ProviderManager } from './providers/manager.js';
import { enterAltScreen, exitAltScreen } from './utils/terminal.js';
import App from './app.js';

function getVersion(): string {
  // package.json ships alongside dist/, and createRequire avoids ESM JSON
  // import-assertion churn (tsup leaves the require call as-is).
  const require = createRequire(import.meta.url);
  return (require('../package.json') as { version: string }).version;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  // Flag/subcommand modes print and exit — never touch the alternate screen.
  switch (args.mode) {
    case 'error':
      process.stderr.write(`paramhub: ${args.message}\n\n${USAGE}`);
      process.exit(1);
      return;
    case 'help':
      process.stdout.write(USAGE);
      process.exit(0);
      return;
    case 'version':
      process.stdout.write(`${getVersion()}\n`);
      process.exit(0);
      return;
    case 'default-config':
      process.stdout.write(renderConfigTemplate());
      process.exit(0);
      return;
    case 'show-config': {
      const { config, firstRun, configPath } = await loadConfig(args.configPath);
      process.stdout.write(`# config file: ${configPath}\n`);
      if (firstRun) {
        process.stdout.write('# (file not found — showing built-in defaults)\n');
      }
      process.stdout.write(stringify(config));
      process.exit(0);
      return;
    }
  }

  const { config, firstRun, configPath } = await loadConfig(args.configPath);
  const uiState = await loadUiState();

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

  const instance = render(
    React.createElement(App, {
      providers,
      config,
      configPath,
      firstRun,
      listModes: uiState.listModes,
    }),
  );

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
