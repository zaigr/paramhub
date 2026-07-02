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

import { diffLines } from 'diff';
import type { Command, CommandContext, Provider } from '@paramhub/types';
import type { Action, DiffLine } from '../state/reducer.js';
import type { Dispatch } from 'react';
import type { EditOptions, EditResult } from '../editor/external.js';
import { valueCache, valueCacheKey } from '../hooks/use-item-value.js';
import { clearSearchCache } from '../hooks/use-search.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { conciseError } from '../utils/error.js';
import { commandRegistry } from './registry.js';

export interface CoreCommandsOptions {
  dispatch: Dispatch<Action>;
  exit: () => void;
  getProvider: (id: string | null) => Provider | null;
  getProviders: () => Provider[];
  setStatus: (message: string) => void;
  /** Suspend Ink and edit a value in the external editor. */
  runEditor: (initialValue: string, opts?: EditOptions) => Promise<EditResult | null>;
}

/** Build colored +/- diff lines for the edit confirmation modal. */
function buildDiffLines(oldValue: string, newValue: string): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const part of diffLines(oldValue, newValue)) {
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const color = part.added ? 'green' : part.removed ? 'red' : undefined;
    // diffLines chunks end with a trailing newline; drop the empty tail split.
    const body = part.value.replace(/\n$/, '');
    for (const line of body.split('\n')) {
      lines.push({ text: `${prefix} ${line}`, color });
    }
  }
  return lines;
}

/** Editor extension hint based on item type (json gets syntax highlighting). */
function extensionForType(type: string): string {
  return type === 'json' ? '.json' : '.txt';
}

/**
 * Create all core commands.
 * Commands are functions of state (via context) that dispatch actions.
 */
export function createCoreCommands(options: CoreCommandsOptions): Command[] {
  const { dispatch, exit, getProvider, getProviders, setStatus, runEditor } = options;

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
    {
      id: 'core:switch-region',
      label: 'Switch Region',
      description: 'Switch the active provider to a different region',
      category: 'view',
      hotkey: 'ctrl+r',
      isVisible: (ctx: CommandContext) => {
        const p = getProvider(ctx.activeProviderId);
        return !!p?.getCapabilities().canSwitchRegion && !!p.switchRegion;
      },
      execute: () => {
        dispatch({ type: 'OPEN_MODAL', modal: { type: 'region-picker' } });
      },
    },
    {
      id: 'core:switch-profile',
      label: 'Switch Profile',
      description: 'Switch the active provider to a different profile',
      category: 'view',
      isVisible: (ctx: CommandContext) => {
        const p = getProvider(ctx.activeProviderId);
        return !!p?.getCapabilities().canSwitchAccount && !!p.switchProfile;
      },
      execute: () => {
        dispatch({ type: 'OPEN_MODAL', modal: { type: 'profile-picker' } });
      },
    },

    // ── Item actions ──
    {
      id: 'core:reveal-value',
      label: 'Reveal / Hide Value',
      description: 'Toggle visibility of the selected parameter value',
      category: 'item',
      hotkey: 'r',
      isVisible: (ctx: CommandContext) =>
        ctx.view === 'detail' && ctx.selectedItem?.type === 'secure',
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

    // ── Mutations ──
    {
      id: 'core:edit-value',
      label: 'Edit Value',
      description: 'Edit the parameter value in your $EDITOR',
      category: 'item',
      hotkey: 'e',
      isVisible: (ctx: CommandContext) => ctx.view === 'detail',
      isEnabled: (ctx: CommandContext) => {
        const p = getProvider(ctx.activeProviderId);
        return ctx.selectedItem !== null && !!p?.getCapabilities().canEdit && !!p.updateValue;
      },
      execute: async (ctx: CommandContext) => {
        const item = ctx.selectedItem;
        const provider = getProvider(ctx.activeProviderId);
        if (!item || !provider?.updateValue) return;

        // Load the current value (cached when the detail panel already fetched it).
        let current: string;
        try {
          const key = valueCacheKey(provider.id, item.id);
          current = valueCache.get(key) ?? (await provider.getValue(item.id));
          valueCache.set(key, current);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load value';
          setStatus(`Edit failed: ${conciseError(message)}`);
          return;
        }

        const result = await runEditor(current, { extension: extensionForType(item.type) });
        if (!result) {
          setStatus('Editor not available (no TTY)');
          return;
        }
        if (!result.changed) {
          setStatus('No changes');
          return;
        }

        const newValue = result.value;
        dispatch({
          type: 'OPEN_MODAL',
          modal: {
            type: 'confirm',
            data: {
              title: 'Save changes?',
              body: item.path,
              lines: buildDiffLines(current, newValue),
              confirmLabel: 'Save',
              onConfirm: async () => {
                try {
                  await provider.updateValue!(item.id, newValue);
                  valueCache.set(valueCacheKey(provider.id, item.id), newValue);
                  dispatch({ type: 'LOAD_VALUE_SUCCESS', value: newValue });
                  clearSearchCache();
                  dispatch({ type: 'REFRESH_LIST' });
                  setStatus('Saved');
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Save failed';
                  dispatch({ type: 'SET_ERROR', error: `Save failed: ${conciseError(message)}` });
                }
              },
            },
          },
        });
      },
    },
    {
      id: 'core:create-item',
      label: 'Create Item',
      description: 'Create a new parameter',
      category: 'item',
      hotkey: 'n',
      isVisible: (ctx: CommandContext) => ctx.view === 'list' || ctx.view === 'detail',
      isEnabled: (ctx: CommandContext) => {
        const p = getProvider(ctx.activeProviderId);
        return !!p?.getCapabilities().canCreate && !!p.createItem;
      },
      execute: () => {
        dispatch({ type: 'OPEN_MODAL', modal: { type: 'create-item' } });
      },
    },
    {
      id: 'core:delete-item',
      label: 'Delete Item',
      description: 'Delete the selected parameter',
      category: 'item',
      hotkey: 'd',
      isVisible: (ctx: CommandContext) => ctx.view === 'detail',
      isEnabled: (ctx: CommandContext) => {
        const p = getProvider(ctx.activeProviderId);
        return ctx.selectedItem !== null && !!p?.getCapabilities().canDelete && !!p.deleteItem;
      },
      execute: (ctx: CommandContext) => {
        const item = ctx.selectedItem;
        const provider = getProvider(ctx.activeProviderId);
        if (!item || !provider?.deleteItem) return;

        dispatch({
          type: 'OPEN_MODAL',
          modal: {
            type: 'confirm',
            data: {
              title: 'Delete parameter?',
              body: item.path,
              confirmLabel: 'Delete',
              onConfirm: async () => {
                try {
                  await provider.deleteItem!(item.id);
                  valueCache.delete(valueCacheKey(provider.id, item.id));
                  clearSearchCache();
                  dispatch({ type: 'SET_VIEW', view: 'list' });
                  dispatch({ type: 'SET_SELECTED_ITEM', item: null });
                  dispatch({ type: 'SET_FOCUS', zone: 'list' });
                  dispatch({ type: 'REFRESH_LIST' });
                  setStatus(`Deleted ${item.name}`);
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Delete failed';
                  dispatch({ type: 'SET_ERROR', error: `Delete failed: ${conciseError(message)}` });
                }
              },
            },
          },
        });
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
