/**
 * ItemList — Scrollable list of tree nodes with viewport windowing.
 *
 * Displays a window of nodes that fits the available terminal height.
 * Automatically scrolls to keep the selected node in view.
 * Triggers pagination (loadNextPage) when the selection reaches the bottom.
 */

import { Box, Text, useStdout } from 'ink';
import type { TreeNode } from '@paramhub/types';
import { useTheme } from '../../theme/index.js';
import ItemRow from './ItemRow.js';

interface ItemListProps {
  nodes: TreeNode[];
  selectedIndex: number;
  isLoading: boolean;
  hasNextPage: boolean;
  onLoadNextPage: () => void;
  /** Leaf rows show their full path rather than just their name. */
  showFullPath: boolean;
  /**
   * Rows occupied by chrome around the list.
   *
   * Callers that render extra chrome (e.g. the breadcrumb) must raise this, or
   * the list overflows its box and pushes the StatusBar off-screen.
   */
  reservedRows?: number;
}

/**
 * Default rows reserved for chrome (TopBar border + padding + StatusBar + SearchInput + margins).
 * TopBar: 3 lines (border top, content, border bottom)
 * SearchInput: 1 line
 * StatusBar: 1 line
 * Content padding: 0 vertical (paddingX only in MainLayout)
 * Small buffer for safety: 1
 */
const CHROME_ROWS = 6;

/** Stable React key — branches have no id, and a branch path could equal a leaf id. */
function nodeKey(node: TreeNode): string {
  return node.kind === 'branch' ? `b:${node.path}` : `l:${node.item.id}`;
}

export default function ItemList({
  nodes,
  selectedIndex,
  isLoading,
  hasNextPage,
  onLoadNextPage,
  showFullPath,
  reservedRows = CHROME_ROWS,
}: ItemListProps) {
  const { stdout } = useStdout();
  const { theme } = useTheme();
  const terminalRows = stdout?.rows ?? 24;
  const viewportHeight = Math.max(5, terminalRows - reservedRows);

  // Calculate scroll offset to keep selectedIndex in view
  const scrollOffset = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(viewportHeight / 2),
      Math.max(0, nodes.length - viewportHeight),
    ),
  );

  // Slice the visible window
  const visibleNodes = nodes.slice(scrollOffset, scrollOffset + viewportHeight);

  // Trigger pagination when selection reaches near the bottom of loaded nodes.
  // Guard on nodes.length > 0: for an empty list `selectedIndex >= -3` is
  // always true, which would fire a (possibly stale) token with nothing loaded.
  if (
    hasNextPage &&
    !isLoading &&
    nodes.length > 0 &&
    selectedIndex >= nodes.length - 3
  ) {
    onLoadNextPage();
  }

  if (nodes.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleNodes.map((node, i) => {
        const actualIndex = scrollOffset + i;
        return (
          <ItemRow
            key={nodeKey(node)}
            node={node}
            isSelected={actualIndex === selectedIndex}
            showFullPath={showFullPath}
          />
        );
      })}
      {isLoading && (
        <Text color={theme.warning} dimColor>
          Loading...
        </Text>
      )}
      {!isLoading && hasNextPage && selectedIndex >= nodes.length - 3 && (
        <Text dimColor>Loading more...</Text>
      )}
      {nodes.length > viewportHeight && (
        <Text dimColor>
          {scrollOffset + 1}-{Math.min(scrollOffset + viewportHeight, nodes.length)} of{' '}
          {nodes.length}
          {hasNextPage ? '+' : ''}
        </Text>
      )}
    </Box>
  );
}
