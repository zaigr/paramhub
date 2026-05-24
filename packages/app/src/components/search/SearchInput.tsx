/**
 * SearchInput — Text input for searching parameters.
 *
 * Renders a search prompt with the current query and a blinking cursor.
 * Captures keyboard input when focusZone === 'search', using manual
 * useInput handling (same pattern as CommandPalette).
 *
 * Keys:
 * - Characters: appended to search query
 * - Backspace: removes last character (blur if empty)
 * - Alt+Backspace: deletes last word (blur if empty)
 * - Ctrl+Backspace / Ctrl+U: clears query (blur if already empty)
 * - Escape: blurs back to list (query preserved)
 */

import { Box, Text, useInput } from 'ink';
import { useAppState, useAppDispatch } from '../../state/index.js';

export default function SearchInput() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const isFocused = state.focusZone === 'search';
  const query = state.searchQuery;

  const blurToList = () => dispatch({ type: 'SET_FOCUS', zone: 'list' });
  const clearQuery = () => dispatch({ type: 'CLEAR_SEARCH' });
  const clearOrBlur = () => (query.length === 0 ? blurToList() : clearQuery());

  const deleteChar = () =>
    query.length > 0
      ? dispatch({ type: 'SET_SEARCH_QUERY', query: query.slice(0, -1) })
      : blurToList();

  const deleteWord = () => {
    const trimmed = query.trimEnd();
    const lastSpace = trimmed.lastIndexOf(' ');
    const next = lastSpace === -1 ? '' : trimmed.slice(0, lastSpace + 1);
    if (next.length === 0) {
      clearQuery();
      if (query.length === 0) blurToList();
    } else {
      dispatch({ type: 'SET_SEARCH_QUERY', query: next });
    }
  };

  const handleBackspace = (ctrl: boolean, meta: boolean) => {
    if (meta) deleteWord();
    else if (ctrl) clearOrBlur();
    else deleteChar();
  };

  useInput(
    (input, key) => {
      if (key.escape) return blurToList();

      // Must come BEFORE ctrl/meta guard — some terminals send backspace as Ctrl+H (\x08)
      if (key.backspace || key.delete) return handleBackspace(key.ctrl, key.meta);

      if (key.ctrl && input === 'u') return clearOrBlur(); // readline compat

      if (key.ctrl || key.meta) return; // pass through to global handler

      if (key.return || key.tab) return blurToList();

      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
      if (key.pageUp || key.pageDown) return;

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
