/**
 * Command system types for paramhub.
 *
 * Every user-facing action is a command. Commands are registered in a
 * central registry, discoverable via the command palette (Ctrl+P),
 * and optionally bound to hotkeys.
 */

import type { Item } from './items.js';

/** The current application state context passed to commands. */
export interface CommandContext {
  /** The ID of the currently active provider, or null if none. */
  activeProviderId: string | null;
  /** The current view mode. */
  view: 'list' | 'detail' | 'bookmarks' | 'provider-tab';
  /** The currently selected item, or null if none. */
  selectedItem: Item | null;
  /** The current search query string. */
  searchQuery: string;
}

/** Command category for grouping in help overlays and palette. */
export type CommandCategory =
  | 'navigation'
  | 'search'
  | 'item'
  | 'provider'
  | 'bookmarks'
  | 'view'
  | 'system';

/**
 * A command represents a single user-facing action.
 *
 * Commands are the fundamental unit of interaction in paramhub.
 * They can be triggered via hotkeys, the command palette, or
 * programmatically.
 */
export interface Command {
  /** Unique command identifier (e.g., "core:edit-value", "aws-ssm:copy-arn"). */
  id: string;
  /** Human-readable label displayed in the command palette. */
  label: string;
  /** Optional longer description for help/tooltips. */
  description?: string;
  /** Category for grouping in the help overlay. */
  category: CommandCategory;
  /** Default hotkey binding (e.g., "ctrl+r", "e", "shift+tab"). */
  hotkey?: string;
  /**
   * Whether the command is enabled given the current context.
   * Disabled commands appear greyed out in the palette.
   * Defaults to always enabled if not provided.
   */
  isEnabled?(context: CommandContext): boolean;
  /**
   * Whether the command is visible given the current context.
   * Invisible commands are hidden from the palette entirely.
   * Defaults to always visible if not provided.
   */
  isVisible?(context: CommandContext): boolean;
  /** Execute the command. */
  execute(context: CommandContext): Promise<void> | void;
}

/**
 * A command contributed by a provider.
 *
 * Provider commands are automatically prefixed with the provider ID
 * in the registry (e.g., "aws-ssm:copy-arn") and are registered/
 * unregistered when providers are loaded/unloaded.
 */
export interface ProviderCommand extends Command {
  /** The provider that owns this command. */
  providerId: string;
}
