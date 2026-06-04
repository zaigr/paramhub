/**
 * ValuePreview — Displays the selected parameter's value.
 *
 * Secure values are masked until revealed via core:reveal-value (r).
 * The value is lazily loaded (see useItemValue), so loading and error
 * states are rendered while/if the fetch is in flight or fails.
 */

import { Box, Text } from 'ink';
import { useAppState } from '../../state/index.js';

const MASK = '••••••••';

export default function ValuePreview() {
  const { selectedItem, revealedValue, detailValue, detailValueLoading, detailValueError } =
    useAppState();

  if (!selectedItem) return null;

  const isSecure = selectedItem.type === 'secure';
  const masked = isSecure && !revealedValue;

  return (
    <Box flexDirection="column">
      <Text bold>Value</Text>
      <Box marginTop={1}>
        {detailValueLoading && <Text dimColor>Loading value…</Text>}
        {!detailValueLoading && detailValueError && (
          <Text color="red">Error: {detailValueError}</Text>
        )}
        {!detailValueLoading && !detailValueError && masked && (
          <Text color="yellow">{MASK} (press r to reveal)</Text>
        )}
        {!detailValueLoading && !detailValueError && !masked && (
          <Text color={isSecure ? 'yellow' : undefined}>{detailValue ?? ''}</Text>
        )}
      </Box>
    </Box>
  );
}
