/**
 * Integration tests: full TUI flows with the mock provider, driven through
 * ink-testing-library's fake stdin.
 *
 * Notes:
 * - The command registry and search cache are module-level singletons; they
 *   are reset between tests and every render is unmounted.
 * - No fake timers: Ink's render loop uses real timers. Async settling is
 *   handled by polling lastFrame() via vi.waitFor.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import type { Provider } from '@paramhub/types';
import { MockProviderFactory } from '@paramhub/types/mock';
import App from '../src/app.js';
import { AppConfigSchema } from '../src/config/schema.js';
import type { AppConfig } from '../src/config/schema.js';
import { commandRegistry } from '../src/commands/registry.js';
import { clearSearchCache } from '../src/hooks/use-search.js';

const ESC = '';
const CTRL_P = '';

type RenderResult = ReturnType<typeof render>;
let active: RenderResult | null = null;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Write a key and give Ink a beat to process it before the next one. */
async function press(stdin: RenderResult['stdin'], data: string): Promise<void> {
  stdin.write(data);
  await delay(80);
}

async function boot(config?: Partial<AppConfig>): Promise<RenderResult & { provider: Provider }> {
  const provider = MockProviderFactory.create();
  await provider.init({});
  const fullConfig = AppConfigSchema.parse(config ?? {});
  const instance = render(
    React.createElement(App, {
      providers: [provider],
      config: fullConfig,
      configPath: '/tmp/paramhub-app-flows-unused/config.yaml',
      firstRun: false,
    }),
  );
  active = instance;
  // Initial empty-query search populates the list.
  await vi.waitFor(() => {
    expect(instance.lastFrame()).toContain('/app/production/database/host');
  });
  // Let mount-time effects (provider context, command registration) settle
  // before driving input.
  await delay(150);
  return Object.assign(instance, { provider });
}

beforeEach(() => {
  commandRegistry.clear();
  commandRegistry.setOverrides({});
  clearSearchCache();
});

afterEach(() => {
  active?.unmount();
  active = null;
});

describe('app flows (mock provider)', () => {
  it('boots into the list view with provider context in the status bar', async () => {
    const { lastFrame } = await boot();
    const frame = lastFrame()!;
    expect(frame).toContain('paramhub');
    expect(frame).toContain('Mock Provider');
    expect(frame).toContain('us-east-1');
    expect(frame).toContain('? Help');
  });

  it('search filters the list (debounced)', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, '/');
    await press(stdin, 'staging');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('/app/staging/database/host');
      expect(lastFrame()).not.toContain('/app/production/database/host');
    });
  });

  it('Enter opens the detail panel, Esc goes back', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, '\r');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Value');
      expect(lastFrame()).toContain('c: copy value');
    });
    await press(stdin, ESC);
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('c: copy value');
    });
  });

  it('Enter delivered as LF ("\\n") also opens the detail panel', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, '\n');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('c: copy value');
    });
  });

  it('Ctrl+P opens the command palette and Enter executes the selected command', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, CTRL_P);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Command Palette');
    });
    await press(stdin, 'help');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('> Help');
    });
    await press(stdin, '\r');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Help — Commands & Keybindings');
    });
  });

  it('? opens the help overlay grouped by category', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, '?');
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      expect(frame).toContain('Help — Commands & Keybindings');
      expect(frame).toContain('System');
      expect(frame).toContain('Navigation');
      expect(frame).toContain('ctrl+p');
    });
    await press(stdin, ESC);
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Help — Commands & Keybindings');
    });
  });

  it('keybinding overrides from config remap hotkeys and show up in help', async () => {
    const { stdin, lastFrame } = await boot({
      keybindings: { 'core:show-help': 'h' },
    });
    // The default hotkey no longer triggers…
    await press(stdin, '?');
    await delay(100);
    expect(lastFrame()).not.toContain('Help — Commands & Keybindings');
    // …but the override does.
    await press(stdin, 'h');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Help — Commands & Keybindings');
    });
    // And the overlay shows the overridden binding.
    expect(lastFrame()).toMatch(/Help\s+h\b/);
  });

  it('palette lists the new system commands', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, CTRL_P);
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      expect(frame).toContain('Reload Config');
      expect(frame).toContain('Run Setup Wizard');
    });
  });
});
