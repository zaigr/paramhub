/**
 * Terminal control sequences and helpers.
 *
 * Centralizes the alternate-screen escape sequences so the CLI bootstrap
 * (cli.ts) and the editor suspend/resume flow (use-editor.ts) stay in sync.
 * The app runs inside the alternate screen; handing the terminal to an
 * external editor requires leaving it and re-entering afterwards.
 */

/** Enter the alternate screen buffer and home the cursor. */
export const ALT_SCREEN_ENTER = '\x1b[?1049h\x1b[H';

/** Leave the alternate screen buffer, restoring the prior terminal contents. */
export const ALT_SCREEN_LEAVE = '\x1b[?1049l';

/** Enter the alternate screen on the given stream (defaults to stdout). */
export function enterAltScreen(stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(ALT_SCREEN_ENTER);
}

/** Leave the alternate screen on the given stream (defaults to stdout). */
export function exitAltScreen(stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(ALT_SCREEN_LEAVE);
}
