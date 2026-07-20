/**
 * HelpOverlay — auto-generated command / keybinding reference.
 *
 * Lists every registered command grouped by category, with its *current*
 * hotkey (so config keybinding overrides are reflected live). This is a
 * reference card, not a launcher: commands are shown regardless of the
 * current context. Content beyond the viewport scrolls with ↑↓/PgUp/PgDn.
 */

import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Command } from '@paramhub/types';
import { useAppDispatch } from '../../state/index.js';
import { commandRegistry } from '../../commands/registry.js';
import { useTheme } from '../../theme/index.js';
import Modal from './Modal.js';

const WIDTH = 70;
/** Rows of command/heading lines visible at once. */
const MAX_VISIBLE_ROWS = 16;

/** Fixed display order; categories not listed here go last, alphabetically. */
const CATEGORY_ORDER = ['system', 'navigation', 'search', 'view', 'item'];

function categoryRank(category: string): number {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

type Row =
  | { type: 'heading'; text: string }
  | { type: 'command'; label: string; hotkey: string };

function buildRows(commands: Command[]): Row[] {
  const byCategory = new Map<string, Command[]>();
  for (const cmd of commands) {
    byCategory.set(cmd.category, [...(byCategory.get(cmd.category) ?? []), cmd]);
  }
  const categories = Array.from(byCategory.keys()).sort(
    (a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b),
  );

  const rows: Row[] = [];
  for (const category of categories) {
    rows.push({ type: 'heading', text: categoryLabel(category) });
    const cmds = byCategory
      .get(category)!
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label));
    for (const cmd of cmds) {
      rows.push({
        type: 'command',
        label: cmd.label,
        hotkey: commandRegistry.getHotkey(cmd.id) ?? '',
      });
    }
  }
  return rows;
}

export default function HelpOverlay() {
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const [offset, setOffset] = useState(0);

  // Registry contents are stable while the overlay is open (opening any modal
  // deactivates global keybindings), so building rows per render is fine.
  const rows = buildRows(commandRegistry.getAll());
  const maxOffset = Math.max(0, rows.length - MAX_VISIBLE_ROWS);
  const clampedOffset = Math.min(offset, maxOffset);

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === '?') {
      dispatch({ type: 'CLOSE_MODAL' });
      return;
    }
    if (key.upArrow || (key.ctrl && input === 'k')) {
      setOffset(Math.max(0, clampedOffset - 1));
    } else if (key.downArrow || (key.ctrl && input === 'j')) {
      setOffset(Math.min(maxOffset, clampedOffset + 1));
    } else if (key.pageUp) {
      setOffset(Math.max(0, clampedOffset - MAX_VISIBLE_ROWS));
    } else if (key.pageDown) {
      setOffset(Math.min(maxOffset, clampedOffset + MAX_VISIBLE_ROWS));
    }
  });

  const visible = rows.slice(clampedOffset, clampedOffset + MAX_VISIBLE_ROWS);
  // Interior text width: modal width minus frame + padding columns.
  const lineWidth = WIDTH - 4;

  return (
    <Modal title="Help — Commands & Keybindings" width={WIDTH}>
      <Box flexDirection="column">
        {visible.map((row, i) => {
          if (row.type === 'heading') {
            return (
              <Text key={`${row.text}-${i}`} bold color={theme.accent}>
                {row.text}
              </Text>
            );
          }
          const label = `  ${row.label}`;
          const pad = Math.max(1, lineWidth - label.length - row.hotkey.length);
          return (
            <Text key={`${row.label}-${i}`}>
              <Text>{label}</Text>
              <Text>{' '.repeat(pad)}</Text>
              <Text color={theme.hotkey} bold>
                {row.hotkey}
              </Text>
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {rows.length > MAX_VISIBLE_ROWS
            ? `↑↓ scroll (${clampedOffset + 1}-${Math.min(clampedOffset + MAX_VISIBLE_ROWS, rows.length)} of ${rows.length}) · `
            : ''}
          Esc close
        </Text>
      </Box>
    </Modal>
  );
}
