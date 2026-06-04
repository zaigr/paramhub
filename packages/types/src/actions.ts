/**
 * Custom action types for provider-specific item actions.
 */

import type { Item } from './items.js';

/** Result returned after executing a custom action. */
export interface ActionResult {
  /** A message to display to the user after the action completes. */
  message: string;
  /** If true, the item list should be refreshed after the action. */
  refreshList?: boolean;
}

/**
 * A custom action that a provider can register for items.
 *
 * Custom actions appear in the command palette and can be
 * triggered via hotkeys when viewing an item.
 */
export interface CustomAction {
  /** Unique action identifier (e.g., "copy-arn"). */
  id: string;
  /** Human-readable label for display in palette/menus. */
  label: string;
  /** Optional hotkey binding (e.g., "ctrl+a"). */
  hotkey?: string;
  /** Execute the action on the given item. */
  execute(item: Item): Promise<ActionResult>;
}
