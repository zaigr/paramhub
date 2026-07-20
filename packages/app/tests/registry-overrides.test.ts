import { describe, it, expect, beforeEach } from 'vitest';
import type { Command } from '@paramhub/types';
import { commandRegistry } from '../src/commands/registry.js';
import { applyKeybindingOverrides } from '../src/commands/keybinding-loader.js';

function cmd(id: string, hotkey?: string): Command {
  return {
    id,
    label: id,
    category: 'system',
    hotkey,
    execute: () => {},
  };
}

const context = {
  activeProviderId: null,
  view: 'list',
  selectedItem: null,
  searchQuery: '',
} as never;

describe('command registry keybinding overrides', () => {
  beforeEach(() => {
    commandRegistry.clear();
    commandRegistry.setOverrides({});
  });

  it('applies overrides to already-registered commands', () => {
    commandRegistry.register(cmd('core:quit', 'ctrl+q'));
    commandRegistry.setOverrides({ 'core:quit': 'ctrl+c' });
    expect(commandRegistry.getHotkey('core:quit')).toBe('ctrl+c');
  });

  it('applies overrides to commands registered after setOverrides', () => {
    commandRegistry.setOverrides({ 'aws:copy-arn': 'a' });
    commandRegistry.register(cmd('aws:copy-arn', 'ctrl+a'));
    expect(commandRegistry.getHotkey('aws:copy-arn')).toBe('a');
  });

  it('keeps overrides across a simulated tab switch (unregister + re-register)', () => {
    commandRegistry.setOverrides({ 'aws:copy-arn': 'a' });
    commandRegistry.register(cmd('aws:copy-arn', 'ctrl+a'));

    // Tab away and back — the pre-fix behavior lost the override here.
    commandRegistry.unregisterByPrefix('aws:');
    commandRegistry.register(cmd('aws:copy-arn', 'ctrl+a'));

    expect(commandRegistry.getHotkey('aws:copy-arn')).toBe('a');
    expect(commandRegistry.resolveByHotkey('a', context)?.id).toBe('aws:copy-arn');
    expect(commandRegistry.resolveByHotkey('ctrl+a', context)).toBeUndefined();
  });

  it('keeps overrides across clear() (effect cleanup churn)', () => {
    commandRegistry.setOverrides({ 'core:quit': 'ctrl+c' });
    commandRegistry.clear();
    commandRegistry.register(cmd('core:quit', 'ctrl+q'));
    expect(commandRegistry.getHotkey('core:quit')).toBe('ctrl+c');
  });

  it('reverts to the default hotkey when an override is removed', () => {
    commandRegistry.register(cmd('core:quit', 'ctrl+q'));
    commandRegistry.setOverrides({ 'core:quit': 'ctrl+c' });
    commandRegistry.setOverrides({});
    expect(commandRegistry.getHotkey('core:quit')).toBe('ctrl+q');
  });

  it('applyKeybindingOverrides warns on unknown ids and duplicate hotkeys', () => {
    commandRegistry.register(cmd('core:quit', 'ctrl+q'));
    commandRegistry.register(cmd('core:back', 'escape'));
    const warnings = applyKeybindingOverrides({
      'core:nope': 'x',
      'core:quit': 'z',
      'core:back': 'z',
    });
    expect(warnings.some((w) => w.includes('core:nope'))).toBe(true);
    expect(warnings.some((w) => w.includes('"z"'))).toBe(true);
  });
});
