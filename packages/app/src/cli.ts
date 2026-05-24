/**
 * CLI entry point for paramhub.
 *
 * Initializes the mock provider (will be replaced by dynamic loading in Phase 4),
 * sets up the command registry, and renders the Ink application.
 *
 * Uses the alternate screen buffer for a fullscreen TUI experience.
 */

import { render } from 'ink';
import React from 'react';
import type { Provider } from '@paramhub/types';
import { MockProviderFactory } from '@paramhub/types/mock';
import App from './app.js';

/** Enter the alternate screen buffer (clean fullscreen, like vim/htop). */
function enterAltScreen() {
  process.stdout.write('\x1b[?1049h');
  process.stdout.write('\x1b[H');
}

/** Leave the alternate screen buffer (restores previous terminal content). */
function exitAltScreen() {
  process.stdout.write('\x1b[?1049l');
}

async function main() {
  // Initialize providers (hardcoded mock for now — Phase 4 adds dynamic loading)
  const mockProvider = MockProviderFactory.create();
  await mockProvider.init({ defaultRegion: 'us-east-1', defaultProfile: 'default' });

  const connection = await mockProvider.testConnection();
  if (!connection.ok) {
    console.error('Failed to connect to mock provider:', connection.message);
    process.exit(1);
  }

  const providers: Provider[] = [mockProvider];

  // Enter fullscreen alternate buffer
  enterAltScreen();

  // Render the application
  const instance = render(React.createElement(App, { providers }));

  // Restore terminal on exit
  instance.waitUntilExit().then(() => {
    exitAltScreen();
  });

  // Handle unexpected termination
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
