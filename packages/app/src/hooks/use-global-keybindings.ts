/**
 * Global keybinding hook.
 *
 * Uses Ink's useInput to capture all key presses, normalize them
 * to a canonical string format, and resolve them against the
 * command registry. If a matching command is found and enabled,
 * it is executed.
 *
 * Key normalization format examples:
 * - "a", "z", "1" (plain characters)
 * - "ctrl+p", "ctrl+q" (ctrl modifiers)
 * - "shift+tab" (shift modifiers)
 * - "up", "down", "left", "right" (arrow keys)
 * - "return", "escape", "tab", "backspace", "delete"
 */

import { useInput } from 'ink';
import type { CommandContext } from '@paramhub/types';
import { commandRegistry } from '../commands/registry.js';

interface UseGlobalKeybindingsOptions {
  /** Whether this hook should be active (false when a modal captures input). */
  isActive: boolean;
}

/**
 * Normalize an Ink key event into a canonical hotkey string.
 *
 * Ink's useInput provides (input, key) where:
 * - input: the character pressed (empty for special keys)
 * - key: object with boolean flags: ctrl, meta, shift, escape, return, tab, etc.
 */
function normalizeKey(
  input: string,
  key: {
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    escape: boolean;
    return: boolean;
    tab: boolean;
    backspace: boolean;
    delete: boolean;
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    pageUp: boolean;
    pageDown: boolean;
  },
): string {
  const parts: string[] = [];

  // Add modifiers
  if (key.ctrl) parts.push('ctrl');
  if (key.meta && !key.escape) parts.push('meta');
  if (key.shift && !input) parts.push('shift'); // Only add shift for non-character keys

  // Determine the key name
  if (key.return) parts.push('return');
  else if (key.escape) parts.push('escape');
  else if (key.tab) parts.push('tab');
  else if (key.backspace) parts.push('backspace');
  else if (key.delete) parts.push('delete');
  else if (key.upArrow) parts.push('up');
  else if (key.downArrow) parts.push('down');
  else if (key.leftArrow) parts.push('left');
  else if (key.rightArrow) parts.push('right');
  else if (key.pageUp) parts.push('pageup');
  else if (key.pageDown) parts.push('pagedown');
  else if (input) parts.push(input.toLowerCase());

  return parts.join('+');
}

/**
 * Hook that captures global keyboard input and dispatches to commands.
 *
 * When `isActive` is false (e.g., a modal is open), key events are ignored.
 */
export function useGlobalKeybindings(
  context: CommandContext,
  options: UseGlobalKeybindingsOptions,
): void {
  useInput(
    (input, key) => {
      if (!options.isActive) return;

      const normalized = normalizeKey(input, key);
      if (!normalized) return;

      const command = commandRegistry.resolveByHotkey(normalized, context);
      if (command) {
        // Fire and forget — commands handle their own errors
        const result = command.execute(context);
        if (result instanceof Promise) {
          result.catch(() => {
            // Errors are handled by the command or surfaced via state
          });
        }
      }
    },
    { isActive: options.isActive },
  );
}
