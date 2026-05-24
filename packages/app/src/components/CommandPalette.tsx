/**
 * CommandPalette component — fuzzy search overlay for all commands.
 *
 * Triggered by Ctrl+P (core:toggle-command-palette). Provides a text input
 * for fuzzy searching through all visible commands, and a scrollable
 * results list showing label + hotkey. Enter executes, Esc closes.
 *
 * This is the primary discoverability mechanism for paramhub:
 * "If it can't be found in Ctrl+P, it doesn't exist."
 */

import { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Command } from '@paramhub/types';
import { commandRegistry } from '../commands/registry.js';
import { useCommandContext } from '../hooks/use-command-context.js';
import { useAppDispatch } from '../state/index.js';
import Modal from './modals/Modal.js';

/** Maximum number of results to display in the palette. */
const MAX_VISIBLE_RESULTS = 8;

/**
 * Hotkeys that are used internally by the palette for navigation.
 * Commands bound to these should not appear in the palette results
 * to avoid conflicts and confusion.
 */
const PALETTE_INTERNAL_HOTKEYS = new Set(['up', 'down', 'return', 'escape', 'ctrl+p', 'ctrl+q']);

export default function CommandPalette() {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const context = useCommandContext();
  const dispatch = useAppDispatch();
  const { exit } = useApp();

  // Get filtered commands from registry, excluding internal palette navigation
  const results: Command[] = useMemo(() => {
    const all = commandRegistry.search(query, context);
    return all.filter((cmd) => {
      const hotkey = commandRegistry.getHotkey(cmd.id);
      return !hotkey || !PALETTE_INTERNAL_HOTKEYS.has(hotkey);
    });
  }, [query, context]);

  // Clamp selected index when results change
  const clampedIndex = Math.max(0, Math.min(selectedIndex, results.length - 1));

  const executeSelected = () => {
    const command = results[clampedIndex];
    if (command) {
      const enabled = command.isEnabled ? command.isEnabled(context) : true;
      if (enabled) {
        // Close palette first, then execute
        dispatch({ type: 'CLOSE_MODAL' });
        const result = command.execute(context);
        if (result instanceof Promise) {
          result.catch(() => {
            // Errors handled by command
          });
        }
      }
    }
  };

  const closePalette = () => {
    dispatch({ type: 'CLOSE_MODAL' });
  };

  // Handle ALL input: navigation, shortcuts, and text entry
  useInput((input, key) => {
    // -- Global shortcuts that work even inside the palette --
    if (key.ctrl && input === 'p') {
      closePalette();
      return;
    }
    if (key.ctrl && input === 'q') {
      closePalette();
      exit();
      return;
    }

    // -- Palette navigation --
    if (key.escape) {
      closePalette();
      return;
    }
    if (key.return) {
      executeSelected();
      return;
    }
    if (key.upArrow || (key.ctrl && input === 'k')) {
      setSelectedIndex(Math.max(0, clampedIndex - 1));
      return;
    }
    if (key.downArrow || (key.ctrl && input === 'j')) {
      setSelectedIndex(Math.min(results.length - 1, clampedIndex + 1));
      return;
    }

    // -- Text input handling --
    // Ignore any other ctrl/meta combinations (don't add to search)
    if (key.ctrl || key.meta) {
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }
    // Tab and arrows are navigation, not text
    if (key.tab || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
      return;
    }
    // Plain character input
    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  // Visible slice for scrolling
  const startIndex = Math.max(
    0,
    Math.min(clampedIndex - Math.floor(MAX_VISIBLE_RESULTS / 2), results.length - MAX_VISIBLE_RESULTS),
  );
  const visibleResults = results.slice(startIndex, startIndex + MAX_VISIBLE_RESULTS);

  return (
    <Modal title="Command Palette" width={56}>
      <Box>
        <Text color="gray">&gt; </Text>
        <Text>{query}</Text>
        <Text dimColor>{query.length === 0 ? 'Type to search commands...' : ''}</Text>
      </Box>
      <Box flexDirection="column">
        {visibleResults.length === 0 ? (
          <Text dimColor>  No commands found</Text>
        ) : (
          visibleResults.map((cmd, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === clampedIndex;
            const enabled = cmd.isEnabled ? cmd.isEnabled(context) : true;
            const hotkey = commandRegistry.getHotkey(cmd.id);

            const prefix = isSelected ? '> ' : '  ';
            const label = cmd.label;
            const hotkeyStr = hotkey ?? '';
            // Pad the label to fill the available width
            const maxLabelWidth = 52 - prefix.length - hotkeyStr.length - 2;
            const paddedLabel = label.length > maxLabelWidth
              ? label.slice(0, maxLabelWidth)
              : label + ' '.repeat(Math.max(0, maxLabelWidth - label.length));

            return (
              <Text key={cmd.id}>
                <Text
                  color={isSelected ? 'cyan' : enabled ? undefined : 'gray'}
                  bold={isSelected}
                  dimColor={!enabled && !isSelected}
                >
                  {prefix}{paddedLabel}
                </Text>
                <Text dimColor={!isSelected} color={isSelected ? 'cyan' : 'gray'}>
                  {hotkeyStr}
                </Text>
              </Text>
            );
          })
        )}
      </Box>
      <Box>
        <Text dimColor>
          {results.length} command{results.length !== 1 ? 's' : ''}
          {' · ↑↓ nav · Enter run · Esc close'}
        </Text>
      </Box>
    </Modal>
  );
}
