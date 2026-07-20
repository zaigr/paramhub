/**
 * ItemRow — Renders a single tree node in the list.
 *
 * Branches show a chevron and their name; leaves show the parameter path (or
 * just the name when a breadcrumb already supplies the context) and a type
 * badge. Secure parameters get a distinct color badge.
 */

import { Box, Text } from 'ink';
import type { TreeNode } from '@paramhub/types';
import { useTheme } from '../../theme/index.js';

interface ItemRowProps {
  node: TreeNode;
  isSelected: boolean;
  /**
   * Show the leaf's full path rather than its name.
   *
   * True in flat mode and for search results, where a row can come from
   * anywhere; false while browsing a level, where the breadcrumb already says
   * where we are and full paths would wrap at depth.
   */
  showFullPath: boolean;
}

export default function ItemRow({ node, isSelected, showFullPath }: ItemRowProps) {
  const { theme } = useTheme();

  const label =
    node.kind === 'branch'
      ? node.name
      : showFullPath
        ? node.item.path
        : node.item.name;

  return (
    <Box width="100%" justifyContent="space-between">
      <Box>
        <Text color={isSelected ? theme.accent : undefined} bold={isSelected}>
          {isSelected ? '> ' : '  '}
        </Text>
        {node.kind === 'branch' && (
          <Text color={isSelected ? theme.accent : theme.muted} bold={isSelected}>
            {'▸ '}
          </Text>
        )}
        <Text color={isSelected ? theme.accent : undefined} dimColor={!isSelected}>
          {label}
        </Text>
      </Box>
      {node.kind === 'branch' ? (
        <Text color={theme.muted} dimColor={!isSelected}>
          [branch]
        </Text>
      ) : (
        <Text
          color={node.item.type === 'secure' ? theme.secure : theme.muted}
          dimColor={!isSelected}
        >
          [{node.item.type}]
        </Text>
      )}
    </Box>
  );
}
