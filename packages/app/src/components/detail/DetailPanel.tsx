/**
 * DetailPanel — Full detail view for the selected parameter.
 *
 * Renders provider-supplied fields (provider.getItemDetails) plus the value
 * preview. Triggers lazy value loading on mount via useItemValue. Sensitive
 * fields are masked until revealed with core:reveal-value (r).
 */

import { Box, Text, useStdout } from 'ink';
import type { Provider } from '@paramhub/types';
import { useAppState, useAppDispatch } from '../../state/index.js';
import { useItemValue } from '../../hooks/use-item-value.js';
import { useTheme } from '../../theme/index.js';
import ValuePreview from './ValuePreview.js';

const MASK = '••••••••';

/**
 * Rows reserved by everything around the value viewport, mirroring the approach
 * in ItemList. Accounts for: TopBar (3), StatusBar (1), detail border (2),
 * path line (1), Value header (1), footer hint (1), inter-section margins (~4),
 * and a safety buffer. The variable field count is subtracted separately.
 */
const CHROME_ROWS = 13;

interface DetailPanelProps {
  provider: Provider | null;
}

export default function DetailPanel({ provider }: DetailPanelProps) {
  const { selectedItem, revealedValue, statusMessage } = useAppState();
  const dispatch = useAppDispatch();
  const { stdout } = useStdout();
  const { theme } = useTheme();

  useItemValue({ provider, item: selectedItem, dispatch });

  if (!selectedItem) {
    return (
      <Box paddingY={1}>
        <Text dimColor>Select an item to view details</Text>
      </Box>
    );
  }

  const fields = provider ? provider.getItemDetails(selectedItem) : [];
  const labelWidth = fields.reduce((max, f) => Math.max(max, f.label.length), 0) + 2;

  const isSecure = selectedItem.type === 'secure';
  const terminalRows = stdout?.rows ?? 24;
  const valueMaxHeight = Math.max(3, terminalRows - CHROME_ROWS - fields.length);

  const hint = [
    isSecure ? 'r: reveal value' : null,
    'c: copy value',
    'y: copy path',
    'Esc: back',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
    >
      <Text bold color={theme.accent}>
        {selectedItem.path}
      </Text>

      <Box marginTop={1} flexDirection="column">
        {fields.map((field) => (
          <Box key={field.label}>
            <Box width={labelWidth} flexShrink={0}>
              <Text dimColor>{`${field.label}:`}</Text>
            </Box>
            <Text>{field.sensitive && !revealedValue ? MASK : field.value}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <ValuePreview maxHeight={valueMaxHeight} />
      </Box>

      <Box marginTop={1}>
        {statusMessage ? (
          <Text color={theme.success}>{statusMessage}</Text>
        ) : (
          <Text dimColor>{hint}</Text>
        )}
      </Box>
    </Box>
  );
}
