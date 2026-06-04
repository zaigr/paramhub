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

  return {
    activeProviderId: state.activeProviderId,
    view: state.view,
    selectedItem:
      state.view === 'detail'
        ? state.selectedItem
        : state.items[state.selectedIndex] ?? null,
    searchQuery: state.searchQuery,
  };
}
