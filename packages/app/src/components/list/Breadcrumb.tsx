/**
 * Breadcrumb — Shows where the tree drill-in currently stands.
 *
 * Rendered only in tree mode, between the search input and the list. Callers
 * must raise ItemList's `reservedRows` to account for the row this occupies.
 */

import { Box, Text } from 'ink';
import type { Provider } from '@paramhub/types';
import { useAppState } from '../../state/index.js';
import { useTheme } from '../../theme/index.js';

interface BreadcrumbProps {
  provider: Provider | null;
}

export default function Breadcrumb({ provider }: BreadcrumbProps) {
  const { branchStack, searchQuery } = useAppState();
  const { theme } = useTheme();

  const root = provider?.displayName ?? 'root';
  const segments = branchStack.map((frame) => frame.name);

  return (
    <Box>
      {/* truncate-start so a deep path loses its head, not the level we're in */}
      <Text wrap="truncate-start" dimColor>
        {root}
        {segments.map((name, i) => (
          <Text key={`${i}:${name}`}>
            {' › '}
            <Text
              color={i === segments.length - 1 ? theme.accent : undefined}
              bold={i === segments.length - 1}
            >
              {name}
            </Text>
          </Text>
        ))}
      </Text>
      {searchQuery && (
        <Text dimColor> — filtering &quot;{searchQuery}&quot;</Text>
      )}
    </Box>
  );
}
