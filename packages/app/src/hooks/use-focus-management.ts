/**
 * Focus management hook.
 *
 * Tracks which component owns keyboard input. When a modal (like the
 * command palette) is open, it captures all input. Otherwise, input
 * flows to the current view's active component.
 */

import { useAppState } from '../state/index.js';
import type { FocusZone } from '../state/index.js';

export interface FocusInfo {
  /** The currently active focus zone. */
  activeZone: FocusZone;
  /** Whether a modal is open (modals steal focus from everything). */
  isModalOpen: boolean;
  /** Whether the global keybinding hook should be active. */
  isGlobalKeybindingsActive: boolean;
}

/**
 * Hook that provides focus state information.
 *
 * Components use this to determine whether they should respond to input.
 */
export function useFocusManagement(): FocusInfo {
  const state = useAppState();

  const isModalOpen = state.modal !== null;

  return {
    activeZone: state.focusZone,
    isModalOpen,
    // Global keybindings are active when no modal is open and search input
    // is not focused (SearchInput captures its own keys via useInput).
    isGlobalKeybindingsActive: !isModalOpen && state.focusZone !== 'search',
  };
}
