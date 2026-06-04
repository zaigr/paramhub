/**
 * Error message normalization for display in the TUI.
 *
 * Provider/SDK errors (notably AWS) are often long and multi-line. Rendering
 * them verbatim in the single-row StatusBar reflows the layout and makes the
 * terminal flicker, so collapse them to a single, length-capped line.
 */

/** Maximum length of a status-bar error before it is ellipsized. */
const MAX_LENGTH = 100;

/** Collapse an error message to one trimmed, length-capped line. */
export function conciseError(message: string | undefined): string {
  const text = (message ?? 'Unknown error').replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_LENGTH) return text;
  return text.slice(0, MAX_LENGTH - 1) + '…';
}
