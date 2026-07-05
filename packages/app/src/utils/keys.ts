/**
 * Key-detection helpers shared by all input handlers.
 */

/**
 * True when the event is the Enter key.
 *
 * Ink sets `key.return` only for CR ('\r'). Some terminal/pty setups deliver
 * Enter as LF ('\n' — e.g. when ICRNL translation happens upstream), which
 * Ink reports as plain input with `key.return === false`. Treat both as Enter.
 */
export function isEnterKey(input: string, key: { return: boolean }): boolean {
  return key.return || input === '\n';
}
