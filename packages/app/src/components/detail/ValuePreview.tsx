/**
 * ValuePreview — Displays the selected parameter's value.
 *
 * Secure values are masked until revealed via core:reveal-value (r).
 * The value is lazily loaded (see useItemValue), so loading and error
 * states are rendered while/if the fetch is in flight or fails.
 *
 * Long values are wrapped to the panel width and shown through a scrollable
 * viewport so they never overflow and break the bordered layout. Scrolling is
 * a view-local interaction (↑/↓, PageUp/PageDown) — not a palette command.
 */

import { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useAppState } from '../../state/index.js';
import { useFocusManagement } from '../../hooks/use-focus-management.js';
import { useTheme } from '../../theme/index.js';

const MASK = '••••••••';

/** Lowest content width we will wrap to, regardless of terminal size. */
const MIN_CONTENT_WIDTH = 20;

/**
 * Wrap text to a fixed column width for a deterministic line count.
 *
 * Splits on newlines (preserving empty lines), then hard-wraps each logical
 * line into width-sized chunks. Hard wrapping keeps the viewport math exact,
 * which character-aware soft wrapping in Ink would not.
 */
export function wrapLines(text: string, width: number): string[] {
  const w = Math.max(1, width);
  const out: string[] = [];
  for (const logical of text.split('\n')) {
    if (logical.length === 0) {
      out.push('');
      continue;
    }
    for (let i = 0; i < logical.length; i += w) {
      out.push(logical.slice(i, i + w));
    }
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

interface ValuePreviewProps {
  /** Max rows the value viewport may occupy (computed by DetailPanel). */
  maxHeight: number;
}

export default function ValuePreview({ maxHeight }: ValuePreviewProps) {
  const { selectedItem, revealedValue, detailValue, detailValueLoading, detailValueError } =
    useAppState();
  const { stdout } = useStdout();
  const { isModalOpen } = useFocusManagement();
  const { theme } = useTheme();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Reset scroll when the displayed value changes (new item or reloaded value).
  useEffect(() => {
    setScrollOffset(0);
  }, [detailValue, selectedItem?.id]);

  const isSecure = selectedItem?.type === 'secure';
  const masked = isSecure && !revealedValue;
  const showValue = !!selectedItem && !detailValueLoading && !detailValueError && !masked;

  const contentWidth = Math.max(MIN_CONTENT_WIDTH, (stdout?.columns ?? 80) - 4);
  const lines = showValue ? wrapLines(detailValue ?? '', contentWidth) : [];
  const viewportHeight = Math.max(3, maxHeight);
  const maxOffset = Math.max(0, lines.length - viewportHeight);
  const offset = Math.min(scrollOffset, maxOffset);
  const overflow = lines.length > viewportHeight;

  // Gated on !isModalOpen: the detail view stays mounted behind a floating modal,
  // so without this its scroll keys would fire alongside the modal's navigation.
  useInput(
    (_input, key) => {
      const page = viewportHeight;
      if (key.upArrow) setScrollOffset((o) => clamp(o - 1, 0, maxOffset));
      else if (key.downArrow) setScrollOffset((o) => clamp(o + 1, 0, maxOffset));
      else if (key.pageUp) setScrollOffset((o) => clamp(o - page, 0, maxOffset));
      else if (key.pageDown) setScrollOffset((o) => clamp(o + page, 0, maxOffset));
    },
    { isActive: showValue && overflow && !isModalOpen },
  );

  if (!selectedItem) return null;

  return (
    <Box flexDirection="column">
      <Text bold>Value</Text>
      <Box marginTop={1} flexDirection="column">
        {detailValueLoading && <Text dimColor>Loading value…</Text>}
        {!detailValueLoading && detailValueError && (
          <Text color={theme.error}>Error: {detailValueError}</Text>
        )}
        {!detailValueLoading && !detailValueError && masked && (
          <Text color={theme.secure}>{MASK} (press r to reveal)</Text>
        )}
        {showValue &&
          lines.slice(offset, offset + viewportHeight).map((line, i) => (
            <Text key={offset + i} color={isSecure ? theme.secure : undefined} wrap="truncate-end">
              {line === '' ? ' ' : line}
            </Text>
          ))}
        {showValue && overflow && (
          <Text dimColor>
            ↑/↓ PgUp/PgDn scroll · {offset + 1}-{Math.min(offset + viewportHeight, lines.length)} of{' '}
            {lines.length}
          </Text>
        )}
      </Box>
    </Box>
  );
}
