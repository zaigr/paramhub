/**
 * CLI entry point for paramhub.
 *
 * Boots the mock provider by default; set PARAMHUB_PROVIDER=aws-ssm to use the
 * real AWS SSM provider (Phase 4 will replace this with dynamic config loading).
 * Sets up the command registry and renders the Ink application.
 *
 * Uses the alternate screen buffer for a fullscreen TUI experience.
 */

import { render } from 'ink';
import React from 'react';
import type { Provider, ProviderFactory } from '@paramhub/types';
import { MockProviderFactory } from '@paramhub/types/mock';
import { AwsSsmProviderFactory } from '@paramhub/provider-aws-ssm';
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
  // Select provider (Phase 4 adds dynamic config-based loading).
  const useSsm = process.env.PARAMHUB_PROVIDER === 'aws-ssm';
  const factory: ProviderFactory = useSsm
    ? AwsSsmProviderFactory
    : MockProviderFactory;

  const provider = factory.create();
  await provider.init({
    defaultRegion: process.env.AWS_REGION ?? 'us-east-1',
    defaultProfile: process.env.AWS_PROFILE,
  });

  const connection = await provider.testConnection();
  if (!connection.ok) {
    console.error(
      `Failed to connect to ${provider.displayName}:`,
      connection.message,
    );
    process.exit(1);
  }

  const providers: Provider[] = [provider];

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
