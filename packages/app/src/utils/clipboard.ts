/**
 * Clipboard helper — writes a value to the system clipboard and surfaces
 * the result as a transient status message.
 *
 * Used by copy commands (core:copy-value, core:copy-path, and provider
 * commands like "copy ARN") so the write + status + error handling lives
 * in one place.
 */

import clipboard from 'clipboardy';

export async function copyToClipboard(
  value: string,
  label: string,
  setStatus: (message: string) => void,
): Promise<void> {
  try {
    await clipboard.write(value);
    setStatus(`Copied ${label}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Copy failed';
    setStatus(`Copy failed: ${message}`);
  }
}
