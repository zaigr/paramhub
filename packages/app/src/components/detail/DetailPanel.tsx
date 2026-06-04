/**
 * DetailPanel — Full detail view for the selected parameter.
 *
 * Renders provider-supplied fields (provider.getItemDetails) plus the value
 * preview. Triggers lazy value loading on mount via useItemValue. Sensitive
 * fields are masked until revealed with core:reveal-value (r).
 */

import { Box, Text } from 'ink';
import type { Provider } from '@paramhub/types';
import { useAppState, useAppDispatch } from '../../state/index.js';
import { useItemValue } from '../../hooks/use-item-value.js';
import ValuePreview from './ValuePreview.js';

const MASK = '••••••••';

interface DetailPanelProps {
  provider: Provider | null;
}

export default function DetailPanel({ provider }: DetailPanelProps) {
  const { selectedItem, revealedValue, statusMessage } = useAppState();
  const dispatch = useAppDispatch();

  useItemValue({ provider, item: selectedItem, dispatch });

  if (!selectedItem) {
    return (
      <Box paddingY={1}>
        <Text dimColor>Select an item to view details</Text>
      </Box>
    );
  }

  const fields = provider ? provider.getItemDetails(selectedItem) : [];
  const labelWidth = fields.reduce((max, f) => Math.max(max, f.label.length), 0) + 1;

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Text bold color="cyan">
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
        <ValuePreview />
      </Box>

      <Box marginTop={1}>
        {statusMessage ? (
          <Text color="green">{statusMessage}</Text>
        ) : (
          <Text dimColor>r: reveal value · c: copy value · y: copy path · Esc: back</Text>
        )}
      </Box>
    </Box>
  );
}
