/**
 * Setup wizard integration tests: first-run trigger, step navigation, config
 * file writing, live theme choice persistence, and cancellation.
 *
 * The "None — built-in demo data" provider is chosen in the walkthroughs so
 * the hot-load path stays offline (no AWS SDK involved).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { render } from 'ink-testing-library';
import { parse } from 'yaml';
import { MockProviderFactory } from '@paramhub/types/mock';
import App from '../src/app.js';
import { AppConfigSchema } from '../src/config/schema.js';
import { commandRegistry } from '../src/commands/registry.js';
import { clearListCache } from '../src/hooks/use-list.js';

const ESC = '';
const DOWN = '[B';

type RenderResult = ReturnType<typeof render>;
let active: RenderResult | null = null;
let tmpDir: string;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Write a key and give Ink a beat to process it before the next one. */
async function press(stdin: RenderResult['stdin'], data: string): Promise<void> {
  stdin.write(data);
  await delay(80);
}

async function bootFirstRun(): Promise<RenderResult & { configPath: string }> {
  const provider = MockProviderFactory.create();
  await provider.init({});
  const configPath = path.join(tmpDir, 'config.yaml');
  const instance = render(
    React.createElement(App, {
      providers: [provider],
      config: AppConfigSchema.parse({}),
      configPath,
      firstRun: true,
    }),
  );
  active = instance;
  await vi.waitFor(() => {
    expect(instance.lastFrame()).toContain('Setup (1/4)');
  });
  // Let mount-time effects settle before driving input.
  await delay(150);
  return Object.assign(instance, { configPath });
}

beforeEach(async () => {
  commandRegistry.clear();
  commandRegistry.setOverrides({});
  clearListCache();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paramhub-wizard-'));
});

afterEach(async () => {
  active?.unmount();
  active = null;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('setup wizard', () => {
  it('opens automatically on first run', async () => {
    const { lastFrame } = await bootFirstRun();
    expect(lastFrame()).toContain('Pick a color theme');
  });

  it('walks theme → provider → editor → confirm and writes the config file', async () => {
    const { stdin, lastFrame, configPath } = await bootFirstRun();

    // Theme step: pick "light" (down once), then advance.
    await press(stdin, DOWN);
    await vi.waitFor(() => expect(lastFrame()).toContain('> light'));
    await press(stdin, '\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Setup (2/4)'));

    // Provider step: pick "None — built-in demo data".
    // Three provider options now, so "None" is two moves down.
    await press(stdin, DOWN);
    await press(stdin, DOWN);
    await vi.waitFor(() => expect(lastFrame()).toContain('> None'));
    await press(stdin, '\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Setup (3/4)'));
    expect(lastFrame()).toContain('System default');

    // Editor step: keep system default.
    await press(stdin, '\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Setup (4/4)'));
    const confirm = lastFrame()!;
    expect(confirm).toContain('Theme: light');
    expect(confirm).toContain('None — built-in demo data');
    expect(confirm).toContain('Editor: system default');

    // Confirm: writes the file, hot-loads the mock provider, closes.
    await press(stdin, '\r');
    await vi.waitFor(async () => {
      expect(lastFrame()).not.toContain('Setup (4/4)');
      await fs.access(configPath);
    });

    const written = AppConfigSchema.parse(parse(await fs.readFile(configPath, 'utf-8')));
    expect(written.theme).toBe('light');
    expect(written.providers[0]).toMatchObject({
      package: '@paramhub/provider-aws-ssm',
      enabled: false,
    });
    expect(written.providers[2]).toMatchObject({
      package: '@paramhub/types/mock',
      enabled: true,
    });
    // Hot-loaded demo provider is up and listed.
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Mock Provider');
    });
  });

  it('supports a custom editor command step', async () => {
    const { stdin, lastFrame, configPath } = await bootFirstRun();

    await press(stdin, '\r'); // theme: dark
    await vi.waitFor(() => expect(lastFrame()).toContain('Setup (2/4)'));
    // Three provider options now, so "None" is two moves down.
    await press(stdin, DOWN);
    await press(stdin, DOWN);
    await vi.waitFor(() => expect(lastFrame()).toContain('> None'));
    await press(stdin, '\r'); // provider: demo
    await vi.waitFor(() => expect(lastFrame()).toContain('Setup (3/4)'));

    // Editor step: select "Custom…" (last of 5 options) and type a command.
    await press(stdin, DOWN);
    await press(stdin, DOWN);
    await press(stdin, DOWN);
    await press(stdin, DOWN);
    await vi.waitFor(() => expect(lastFrame()).toContain('> Custom…'));
    await press(stdin, '\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Editor command'));
    await press(stdin, 'code --wait');
    await press(stdin, '\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Editor: code --wait'));

    await press(stdin, '\r'); // confirm
    await vi.waitFor(async () => {
      await fs.access(configPath);
    });
    const written = AppConfigSchema.parse(parse(await fs.readFile(configPath, 'utf-8')));
    expect(written.editor.command).toBe('code --wait');
  });

  it('Esc cancels without writing a config file', async () => {
    const { stdin, lastFrame, configPath } = await bootFirstRun();
    await press(stdin, ESC);
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Setup (1/4)');
    });
    await expect(fs.access(configPath)).rejects.toThrow();
  });

  it('is re-runnable from the command palette', async () => {
    const provider = MockProviderFactory.create();
    await provider.init({});
    const configPath = path.join(tmpDir, 'config.yaml');
    const instance = render(
      React.createElement(App, {
        providers: [provider],
        config: AppConfigSchema.parse({}),
        configPath,
        firstRun: false,
      }),
    );
    active = instance;
    await vi.waitFor(() => {
      expect(instance.lastFrame()).toContain('Mock Provider');
    });
    await delay(200);
    expect(instance.lastFrame()).not.toContain('Setup (1/4)');

    await press(instance.stdin, ''); // Ctrl+P
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Command Palette'));
    await press(instance.stdin, 'setup');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('> Run Setup Wizard'));
    await press(instance.stdin, '\r');
    await vi.waitFor(() => expect(instance.lastFrame()).toContain('Setup (1/4)'));
  });
});
