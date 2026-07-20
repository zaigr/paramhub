/**
 * Hook that derives CommandContext from the current application state.
 *
 * This provides the bridge between React state and the command system,
 * allowing commands to check isEnabled/isVisible based on current state.
 */

import type { CommandContext } from '@paramhub/types';
import { useAppState } from '../state/index.js';

/** Derive a CommandContext from the current app state. */
export function useCommandContext(): CommandContext {
  const state = useAppState();

  const node = state.view === 'detail' ? null : state.nodes[state.selectedIndex] ?? null;

  return {
    activeProviderId: state.activeProviderId,
    view: state.view,
    selectedNode: node,
    // Deliberately null on a branch — see CommandContext.selectedItem.
    selectedItem:
      state.view === 'detail'
        ? state.selectedItem
        : node?.kind === 'leaf'
          ? node.item
          : null,
    searchQuery: state.searchQuery,
  };
}
