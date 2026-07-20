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
import { clearListCache } from '../src/hooks/use-list.js';
import { loadUiState } from '../src/config/ui-state.js';

const ESC = '';
const CTRL_P = '';

const DOWN = '[B';
const RIGHT = '[C';
const LEFT = '[D';

type RenderResult = ReturnType<typeof render>;
let active: RenderResult | null = null;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Config for tests that want the old flat list rather than tree browsing. */
const FLAT: Partial<AppConfig> = { list: { defaultMode: 'flat' } };

/** Write a key and give Ink a beat to process it before the next one. */
async function press(stdin: RenderResult['stdin'], data: string): Promise<void> {
  stdin.write(data);
  await delay(80);
}

async function boot(
  config?: Partial<AppConfig>,
  listModes?: Record<string, 'tree' | 'flat'>,
): Promise<RenderResult & { provider: Provider }> {
  const provider = MockProviderFactory.create();
  await provider.init({});
  const fullConfig = AppConfigSchema.parse(config ?? {});
  const instance = render(
    React.createElement(App, {
      providers: [provider],
      config: fullConfig,
      configPath: '/tmp/paramhub-app-flows-unused/config.yaml',
      firstRun: false,
      listModes,
    }),
  );
  active = instance;
  // Initial load populates the list. In tree mode that is the root's branches;
  // in flat mode it is the full parameter paths. A remembered per-provider
  // mode wins over the config default.
  const mode = listModes?.mock ?? fullConfig.list.defaultMode;
  const settled = mode === 'tree' ? '▸ app' : '/app/production/database/host';
  await vi.waitFor(() => {
    expect(instance.lastFrame()).toContain(settled);
  });
  // Let mount-time effects (provider context, command registration) settle
  // before driving input.
  await delay(150);
  return Object.assign(instance, { provider });
}

beforeEach(() => {
  commandRegistry.clear();
  commandRegistry.setOverrides({});
  clearListCache();
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
    const { stdin, lastFrame } = await boot(FLAT);
    await press(stdin, '/');
    await press(stdin, 'staging');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('/app/staging/database/host');
      expect(lastFrame()).not.toContain('/app/production/database/host');
    });
  });

  it('Enter opens the detail panel, Esc goes back', async () => {
    const { stdin, lastFrame } = await boot(FLAT);
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
    const { stdin, lastFrame } = await boot(FLAT);
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

  it('boots into tree mode showing top-level branches, not full paths', async () => {
    const { lastFrame } = await boot();
    const frame = lastFrame()!;
    expect(frame).toContain('▸ app');
    expect(frame).toContain('▸ shared');
    expect(frame).toContain('[branch]');
    expect(frame).not.toContain('/app/production/database/host');
  });

  it('right drills into a branch and left pops back out', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, RIGHT);
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      expect(frame).toContain('▸ production');
      expect(frame).toContain('▸ staging');
      // Breadcrumb tracks the descent.
      expect(frame).toMatch(/Mock Provider\s*›\s*app/);
    });

    await press(stdin, LEFT);
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      expect(frame).toContain('▸ shared');
      expect(frame).not.toContain('▸ production');
    });
  });

  it('Enter on a branch drills in rather than opening detail', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, '\r');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('▸ production');
    });
    expect(lastFrame()).not.toContain('c: copy value');
  });

  it('left at the root is a no-op, not a crash or an empty list', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, LEFT);
    await delay(150);
    const frame = lastFrame()!;
    expect(frame).toContain('▸ app');
    expect(frame).toContain('▸ shared');
  });

  it('restores the previous selection when leaving a branch', async () => {
    const { stdin, lastFrame } = await boot();
    // Move to the second root branch ('shared'), drill in, then come back.
    await press(stdin, DOWN);
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/> ▸ shared/);
    });
    await press(stdin, RIGHT);
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/Mock Provider\s*›\s*shared/);
    });
    await press(stdin, LEFT);
    await vi.waitFor(() => {
      // Cursor is back on 'shared', not reset to 'app'.
      expect(lastFrame()).toMatch(/> ▸ shared/);
    });
  });

  it('filters a level made entirely of branches (the S3 bucket-list case)', async () => {
    const { stdin, lastFrame } = await boot();
    // The root is all branches, so search() — which returns only Items — could
    // never match here; the level filter is what makes this reachable.
    expect(lastFrame()).toContain('▸ app');
    expect(lastFrame()).toContain('▸ shared');

    await press(stdin, '/');
    await press(stdin, 'sha');
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      expect(frame).toContain('▸ shared');
      expect(frame).not.toContain('▸ app');
    });
  });

  it('t toggles between tree and flat listing', async () => {
    const { stdin, lastFrame } = await boot();
    expect(lastFrame()).toContain('▸ app');

    await press(stdin, 't');
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      expect(frame).toContain('/app/production/database/host');
      expect(frame).not.toContain('[branch]');
    });

    await press(stdin, 't');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('▸ app');
    });
  });

  it('a query narrows the current level, and Esc clears it before popping', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, RIGHT); // into /app
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      expect(frame).toContain('▸ production');
      expect(frame).toContain('▸ staging');
    });

    await press(stdin, '/');
    await press(stdin, 'prod');
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      // Narrows this level only — never reaches into a deeper one.
      expect(frame).toContain('▸ production');
      expect(frame).not.toContain('▸ staging');
      expect(frame).not.toContain('/app/production/database/host');
      expect(frame).toContain('filtering "prod"');
    });

    // First Esc blurs the search input back to the list.
    await press(stdin, ESC);
    // Second Esc clears the query but stays inside the branch.
    await press(stdin, ESC);
    await vi.waitFor(() => {
      const frame = lastFrame()!;
      expect(frame).toContain('▸ production');
      expect(frame).toMatch(/Mock Provider\s*›\s*app/);
    });

    // Only now does Esc pop the stack.
    await press(stdin, ESC);
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('▸ shared');
    });
  });

  it('persists the toggled mode and restores it on the next boot', async () => {
    const { stdin, lastFrame } = await boot();
    await press(stdin, 't');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('/app/production/database/host');
    });

    await vi.waitFor(async () => {
      expect((await loadUiState()).listModes.mock).toBe('flat');
    });

    // Restart with what the CLI would have read back from disk.
    active?.unmount();
    active = null;
    const { listModes } = await loadUiState();
    const restarted = await boot(undefined, listModes);
    expect(restarted.lastFrame()).toContain('/app/production/database/host');
    expect(restarted.lastFrame()).not.toContain('[branch]');
  });

  it('remembers the mode per provider, not globally', async () => {
    const { stdin } = await boot();
    await press(stdin, 't');
    await vi.waitFor(async () => {
      expect((await loadUiState()).listModes.mock).toBe('flat');
    });
    // Untouched providers keep falling back to the config default.
    expect((await loadUiState()).listModes['aws-s3']).toBeUndefined();
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
