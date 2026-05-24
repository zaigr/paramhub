/**
 * ItemRow — Renders a single item in the parameter list.
 *
 * Displays: selection indicator, parameter path, and type badge.
 * Secure parameters get a distinct color badge.
 */

import { Box, Text } from 'ink';
import type { Item } from '@paramhub/types';

interface ItemRowProps {
  item: Item;
  isSelected: boolean;
}

export default function ItemRow({ item, isSelected }: ItemRowProps) {
  return (
    <Box width="100%" justifyContent="space-between">
      <Box>
        <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
          {isSelected ? '> ' : '  '}
        </Text>
        <Text color={isSelected ? 'cyan' : undefined} dimColor={!isSelected}>
          {item.path}
        </Text>
      </Box>
      <Text color={item.type === 'secure' ? 'yellow' : 'gray'} dimColor={!isSelected}>
        [{item.type}]
      </Text>
    </Box>
  );
}
