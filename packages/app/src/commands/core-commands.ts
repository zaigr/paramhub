/**
 * Core commands — built-in actions that form the foundation of paramhub.
 *
 * Every navigation, view, and system action is defined here as a command.
 * These commands are registered at boot and remain available regardless
 * of which provider is active.
 *
 * Commands receive a dispatch function to trigger state transitions.
 * The actual execution callbacks are bound when registering (see cli.ts).
 */

import type { Command, CommandContext, Provider } from '@paramhub/types';
import type { Action } from '../state/reducer.js';
import type { Dispatch } from 'react';
import { valueCache, valueCacheKey } from '../hooks/use-item-value.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { commandRegistry } from './registry.js';

export interface CoreCommandsOptions {
  dispatch: Dispatch<Action>;
  exit: () => void;
  getProvider: (id: string | null) => Provider | null;
  getProviders: () => Provider[];
  setStatus: (message: string) => void;
}

/**
 * Create all core commands.
 * Commands are functions of state (via context) that dispatch actions.
 */
export function createCoreCommands(options: CoreCommandsOptions): Command[] {
  const { dispatch, exit, getProvider, getProviders, setStatus } = options;

  return [
    // ── System ──
    {
      id: 'core:quit',
      label: 'Quit',
      description: 'Exit paramhub',
      category: 'system',
      hotkey: 'ctrl+q',
      execute: () => {
        exit();
      },
    },
    {
      id: 'core:toggle-command-palette',
      label: 'Command Palette',
      description: 'Open or close the command palette',
      category: 'system',
      hotkey: 'ctrl+p',
      execute: (_ctx: CommandContext) => {
        dispatch({ type: 'OPEN_MODAL', modal: { type: 'command-palette' } });
      },
    },

    // ── Navigation ──
    {
      id: 'core:navigate-up',
      label: 'Navigate Up',
      description: 'Move selection up in the list',
      category: 'navigation',
      hotkey: 'up',
      isVisible: (ctx: CommandContext) => ctx.view === 'list',
      execute: () => {
        dispatch({ type: 'NAVIGATE_UP' });
      },
    },
    {
      id: 'core:navigate-down',
      label: 'Navigate Down',
      description: 'Move selection down in the list',
      category: 'navigation',
      hotkey: 'down',
      isVisible: (ctx: CommandContext) => ctx.view === 'list',
      execute: () => {
        dispatch({ type: 'NAVIGATE_DOWN' });
      },
    },
    {
      id: 'core:open-detail',
      label: 'Open Detail',
      description: 'Open the detail panel for the selected item',
      category: 'navigation',
      hotkey: 'return',
      isEnabled: (ctx: CommandContext) => ctx.selectedItem !== null,
      isVisible: (ctx: CommandContext) => ctx.view === 'list',
      execute: (ctx: CommandContext) => {
        if (ctx.selectedItem) {
          dispatch({ type: 'SET_SELECTED_ITEM', item: ctx.selectedItem });
          dispatch({ type: 'SET_VIEW', view: 'detail' });
          dispatch({ type: 'SET_FOCUS', zone: 'detail' });
        }
      },
    },
    {
      id: 'core:back',
      label: 'Back',
      description: 'Go back to the list view',
      category: 'navigation',
      hotkey: 'escape',
      isVisible: (ctx: CommandContext) => ctx.view === 'detail',
      execute: () => {
        dispatch({ type: 'SET_VIEW', view: 'list' });
        dispatch({ type: 'SET_SELECTED_ITEM', item: null });
        dispatch({ type: 'SET_FOCUS', zone: 'list' });
      },
    },

    // ── Search ──
    {
      id: 'core:focus-search',
      label: 'Focus Search',
      description: 'Focus the search input',
      category: 'search',
      hotkey: '/',
      isVisible: (ctx: CommandContext) => ctx.view === 'list',
      execute: () => {
        dispatch({ type: 'SET_FOCUS', zone: 'search' });
      },
    },
    {
      id: 'core:clear-search',
      label: 'Clear Search',
      description: 'Clear the search query and results',
      category: 'search',
      isVisible: (ctx: CommandContext) => ctx.view === 'list' && ctx.searchQuery.length > 0,
      execute: () => {
        dispatch({ type: 'CLEAR_SEARCH' });
        dispatch({ type: 'SET_FOCUS', zone: 'list' });
      },
    },

    // ── View ──
    {
      id: 'core:next-tab',
      label: 'Next Provider Tab',
      description: 'Switch to the next provider tab',
      category: 'view',
      hotkey: 'tab',
      execute: (ctx: CommandContext) => {
        switchTab(ctx, 1, { dispatch, getProvider, getProviders });
      },
    },
    {
      id: 'core:prev-tab',
      label: 'Previous Provider Tab',
      description: 'Switch to the previous provider tab',
      category: 'view',
      hotkey: 'shift+tab',
      execute: (ctx: CommandContext) => {
        switchTab(ctx, -1, { dispatch, getProvider, getProviders });
      },
    },

    // ── Item actions ──
    {
      id: 'core:reveal-value',
      label: 'Reveal / Hide Value',
      description: 'Toggle visibility of the selected parameter value',
      category: 'item',
      hotkey: 'r',
      isVisible: (ctx: CommandContext) => ctx.view === 'detail',
      isEnabled: (ctx: CommandContext) => ctx.selectedItem !== null,
      execute: () => {
        dispatch({ type: 'TOGGLE_REVEAL' });
      },
    },
    {
      id: 'core:copy-value',
      label: 'Copy Value',
      description: 'Copy the parameter value to clipboard',
      category: 'item',
      hotkey: 'c',
      isVisible: (ctx: CommandContext) => ctx.view === 'detail',
      isEnabled: (ctx: CommandContext) => ctx.selectedItem !== null,
      execute: async (ctx: CommandContext) => {
        if (!ctx.selectedItem) return;
        const provider = getProvider(ctx.activeProviderId);
        if (!provider) return;
        let value: string;
        try {
          const key = valueCacheKey(provider.id, ctx.selectedItem.id);
          value = valueCache.get(key) ?? (await provider.getValue(ctx.selectedItem.id));
          valueCache.set(key, value);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load value';
          setStatus(`Copy failed: ${message}`);
          return;
        }
        await copyToClipboard(value, 'value', setStatus);
      },
    },
    {
      id: 'core:copy-path',
      label: 'Copy Path',
      description: 'Copy the parameter path to clipboard',
      category: 'item',
      hotkey: 'y',
      isVisible: (ctx: CommandContext) => ctx.view === 'detail',
      isEnabled: (ctx: CommandContext) => ctx.selectedItem !== null,
      execute: async (ctx: CommandContext) => {
        if (!ctx.selectedItem) return;
        await copyToClipboard(ctx.selectedItem.path, 'path', setStatus);
      },
    },
  ];
}

interface SwitchTabDeps {
  dispatch: Dispatch<Action>;
  getProvider: (id: string | null) => Provider | null;
  getProviders: () => Provider[];
}

function switchTab(ctx: CommandContext, direction: 1 | -1, deps: SwitchTabDeps): void {
  const { dispatch, getProvider, getProviders } = deps;
  const providers = getProviders();
  if (providers.length <= 1) return;

  const ids = providers.map((p) => p.id);
  const cur = ids.indexOf(ctx.activeProviderId ?? '');
  const nextIndex = (cur + direction + ids.length) % ids.length;
  const nextId = ids[nextIndex];
  if (!nextId || nextId === ctx.activeProviderId) return;

  if (ctx.activeProviderId) {
    commandRegistry.unregisterByPrefix(ctx.activeProviderId + ':');
  }
  const nextProvider = getProvider(nextId);
  if (nextProvider) {
    commandRegistry.registerAll(nextProvider.getCommands());
  }

  dispatch({ type: 'SET_PROVIDER', providerId: nextId });
  getProvider(nextId)
    ?.getCurrentContext()
    .then((c) => {
      dispatch({ type: 'SET_PROVIDER_CONTEXT', providerId: nextId, context: c });
    })
    .catch(() => {});
}
