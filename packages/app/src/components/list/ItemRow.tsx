/**
 * ItemRow — Renders a single item in the parameter list.
 *
 * Displays: selection indicator, parameter path, and type badge.
 * Secure parameters get a distinct color badge.
 */

import { Box, Text } from 'ink';
import type { Item } from '@paramhub/types';
import { useTheme } from '../../theme/index.js';

interface ItemRowProps {
  item: Item;
  isSelected: boolean;
}

export default function ItemRow({ item, isSelected }: ItemRowProps) {
  const { theme } = useTheme();
  return (
    <Box width="100%" justifyContent="space-between">
      <Box>
        <Text color={isSelected ? theme.accent : undefined} bold={isSelected}>
          {isSelected ? '> ' : '  '}
        </Text>
        <Text color={isSelected ? theme.accent : undefined} dimColor={!isSelected}>
          {item.path}
        </Text>
      </Box>
      <Text color={item.type === 'secure' ? theme.secure : theme.muted} dimColor={!isSelected}>
        [{item.type}]
      </Text>
    </Box>
  );
}
