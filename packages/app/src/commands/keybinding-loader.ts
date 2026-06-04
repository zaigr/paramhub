/**
 * Keybinding override loader.
 *
 * Reads a keybinding configuration map and applies overrides
 * to the command registry. This enables users to remap hotkeys
 * via their config file.
 */

import { commandRegistry } from './registry.js';

/**
 * A keybinding override map: commandId → new hotkey string.
 *
 * Example:
 * {
 *   "core:quit": "ctrl+c",
 *   "core:focus-search": "ctrl+f",
 *   "core:toggle-command-palette": "ctrl+shift+p"
 * }
 */
export type KeybindingOverrides = Record<string, string>;

/**
 * Apply keybinding overrides to the registry.
 * Existing hotkeys are replaced with the new values.
 * Commands not in the overrides map keep their defaults.
 */
export function applyKeybindingOverrides(overrides: KeybindingOverrides): void {
  for (const [commandId, hotkey] of Object.entries(overrides)) {
    commandRegistry.setHotkey(commandId, hotkey);
  }
}
