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
 * Existing hotkeys are replaced with the new values; commands registered
 * later (e.g. provider commands on tab switch) also pick the overrides up.
 * Commands not in the overrides map keep their defaults.
 *
 * Returns human-readable warnings (unknown command ids, duplicate hotkeys)
 * the caller may surface in the status bar.
 */
export function applyKeybindingOverrides(overrides: KeybindingOverrides): string[] {
  commandRegistry.setOverrides(overrides);

  const warnings: string[] = [];
  for (const commandId of Object.keys(overrides)) {
    if (!commandRegistry.getById(commandId)) {
      warnings.push(`Keybinding for unknown command "${commandId}"`);
    }
  }
  const byHotkey = new Map<string, string[]>();
  for (const [commandId, hotkey] of Object.entries(overrides)) {
    byHotkey.set(hotkey, [...(byHotkey.get(hotkey) ?? []), commandId]);
  }
  for (const [hotkey, ids] of byHotkey) {
    if (ids.length > 1) {
      warnings.push(`Hotkey "${hotkey}" bound to multiple commands: ${ids.join(', ')}`);
    }
  }
  return warnings;
}
