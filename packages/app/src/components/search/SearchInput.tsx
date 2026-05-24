/**
 * SearchInput — Text input for searching parameters.
 *
 * Renders a search prompt with the current query and a blinking cursor.
 * Captures keyboard input when focusZone === 'search', using manual
 * useInput handling (same pattern as CommandPalette).
 *
 * Keys:
 * - Characters: appended to search query
 * - Backspace: removes last character
 * - Escape: blurs back to list focus
 * - Ctrl+U: clears the query
 */

import { Box, Text, useInput } from 'ink';
import { useAppState, useAppDispatch } from '../../state/index.js';

export default function SearchInput() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const isFocused = state.focusZone === 'search';
  const query = state.searchQuery;

  useInput(
    (input, key) => {
      // Escape: blur back to list
      if (key.escape) {
        dispatch({ type: 'SET_FOCUS', zone: 'list' });
        return;
      }

      // Ctrl+U: clear the query
      if (key.ctrl && input === 'u') {
        dispatch({ type: 'CLEAR_SEARCH' });
        dispatch({ type: 'SET_FOCUS', zone: 'list' });
        return;
      }

      // Ctrl+Q should still quit (let it pass through by not handling)
      if (key.ctrl || key.meta) return;

      // Return: blur to list (keep query, just move focus to results)
      if (key.return) {
        dispatch({ type: 'SET_FOCUS', zone: 'list' });
        return;
      }

      // Tab: blur to list
      if (key.tab) {
        dispatch({ type: 'SET_FOCUS', zone: 'list' });
        return;
      }

      // Backspace: remove last character
      if (key.backspace) {
        if (query.length > 0) {
          dispatch({ type: 'SET_SEARCH_QUERY', query: query.slice(0, -1) });
        } else {
          // If query is already empty, blur back to list
          dispatch({ type: 'SET_FOCUS', zone: 'list' });
        }
        return;
      }

      // Ignore arrow keys and other special keys
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
      if (key.delete || key.pageUp || key.pageDown) return;

      // Regular character input
      if (input && input.length === 1) {
        dispatch({ type: 'SET_SEARCH_QUERY', query: query + input });
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box>
      <Text color={isFocused ? 'cyan' : 'gray'} bold={isFocused}>
        /
      </Text>
      <Text color={isFocused ? 'white' : 'gray'}>
        {' '}
        {query}
      </Text>
      {isFocused && (
        <Text color="cyan" bold>
          _
        </Text>
      )}
      {!isFocused && !query && (
        <Text dimColor> type / to search</Text>
      )}
    </Box>
  );
}
