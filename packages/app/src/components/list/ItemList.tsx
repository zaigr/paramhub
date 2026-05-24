/**
 * ItemList — Scrollable flat list of parameters with viewport windowing.
 *
 * Displays a window of items that fits the available terminal height.
 * Automatically scrolls to keep the selected item in view.
 * Triggers pagination (loadNextPage) when the selection reaches the bottom.
 */

import { Box, Text, useStdout } from 'ink';
import type { Item } from '@paramhub/types';
import ItemRow from './ItemRow.js';

interface ItemListProps {
  items: Item[];
  selectedIndex: number;
  isLoading: boolean;
  hasNextPage: boolean;
  onLoadNextPage: () => void;
}

/**
 * Number of rows reserved for chrome (TopBar border + padding + StatusBar + SearchInput + margins).
 * TopBar: 3 lines (border top, content, border bottom)
 * SearchInput: 1 line
 * StatusBar: 1 line
 * Content padding: 0 vertical (paddingX only in MainLayout)
 * Small buffer for safety: 1
 */
const CHROME_ROWS = 6;

export default function ItemList({
  items,
  selectedIndex,
  isLoading,
  hasNextPage,
  onLoadNextPage,
}: ItemListProps) {
  const { stdout } = useStdout();
  const terminalRows = stdout?.rows ?? 24;
  const viewportHeight = Math.max(5, terminalRows - CHROME_ROWS);

  // Calculate scroll offset to keep selectedIndex in view
  const scrollOffset = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(viewportHeight / 2),
      Math.max(0, items.length - viewportHeight),
    ),
  );

  // Slice the visible window
  const visibleItems = items.slice(scrollOffset, scrollOffset + viewportHeight);

  // Trigger pagination when selection reaches near the bottom of loaded items
  if (
    hasNextPage &&
    !isLoading &&
    selectedIndex >= items.length - 3
  ) {
    onLoadNextPage();
  }

  if (items.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleItems.map((item, i) => {
        const actualIndex = scrollOffset + i;
        return (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={actualIndex === selectedIndex}
          />
        );
      })}
      {isLoading && (
        <Text color="yellow" dimColor>
          Loading...
        </Text>
      )}
      {!isLoading && hasNextPage && selectedIndex >= items.length - 3 && (
        <Text dimColor>Loading more...</Text>
      )}
      {items.length > viewportHeight && (
        <Text dimColor>
          {scrollOffset + 1}-{Math.min(scrollOffset + viewportHeight, items.length)} of{' '}
          {items.length}
          {hasNextPage ? '+' : ''}
        </Text>
      )}
    </Box>
  );
}
