/**
 * External editor integration — cross-platform.
 *
 * Resolves the user's editor ($VISUAL → $EDITOR → platform fallback),
 * writes the value to a unique temp file with restrictive permissions,
 * hands the terminal to the editor (blocking), then reads the result back.
 *
 * Cross-platform notes:
 * - Temp dir comes from os.tmpdir() (never a hardcoded /tmp).
 * - Editor is spawned with NO shell, avoiding quoting/injection differences
 *   between POSIX shells and cmd.exe.
 * - Fallback editor is `notepad` on Windows, `vi` elsewhere.
 * - File mode 0o600 is honored on POSIX and harmlessly ignored on Windows.
 *
 * Terminal vs GUI editors: terminal editors (vi/nano) draw on the TTY and are
 * run with the blocking, stdio-inherited `editValueInEditor`. GUI editors
 * (VS Code, Sublime, …) open their own window and are run with the async,
 * stdio-ignored `editValueInEditorAsync` so the caller can keep its own UI on
 * screen. `isGuiEditor` distinguishes the two.
 *
 * Crash safety: every live temp file is tracked in a module-level set and a
 * single `process.on('exit')` handler unlinks any leftovers, so a crash or a
 * signal-triggered exit (cli.ts calls process.exit on SIGINT/SIGTERM, which
 * fires 'exit') never leaves plaintext values on disk.
 */

import { spawnSync, spawn } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

/** A resolved editor invocation: the binary plus any leading args. */
export interface EditorResolution {
  bin: string;
  args: string[];
}

export interface EditOptions {
  /** Explicit editor command (e.g. from config). Overrides env vars. May contain args. */
  editorCommand?: string;
  /** Directory for the temp file. Defaults to os.tmpdir(). */
  tempDir?: string;
  /** File extension (with leading dot) for the temp file, for editor syntax hints. */
  extension?: string;
  /** Force GUI (true) / terminal (false) handling, overriding name-based detection. */
  gui?: boolean;
}

export interface EditResult {
  value: string;
  changed: boolean;
}

/** Temp files currently open in an editor; cleaned up on process exit. */
const liveTempFiles = new Set<string>();
let cleanupRegistered = false;

function registerCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  process.on('exit', () => {
    for (const file of liveTempFiles) {
      try {
        rmSync(file, { force: true });
      } catch {
        // best-effort; process is exiting
      }
    }
  });
}

/**
 * Resolve which editor to launch.
 *
 * Priority: explicit config command → $VISUAL → $EDITOR → platform fallback.
 * The chosen string is split on whitespace so commands with flags work
 * (e.g. "code --wait" → bin "code", args ["--wait"]).
 */
export function resolveEditor(configCommand?: string): EditorResolution {
  const fallback = process.platform === 'win32' ? 'notepad' : 'vi';
  const raw =
    (configCommand && configCommand.trim()) ||
    process.env.VISUAL ||
    process.env.EDITOR ||
    fallback;

  const parts = raw.trim().split(/\s+/);
  const bin = parts[0] ?? fallback;
  return { bin, args: parts.slice(1) };
}

/**
 * Editors known to open their own GUI window rather than drawing on the TTY.
 * Matched against the resolved binary's basename (lower-cased, extension
 * stripped). Used to decide whether the caller must yield the terminal.
 */
const GUI_EDITORS = new Set([
  'code',
  'code-insiders',
  'codium',
  'vscodium',
  'cursor',
  'subl',
  'sublime_text',
  'atom',
  'mate',
  'gedit',
  'kate',
  'gvim',
  'mvim',
  'open', // macOS `open -W -a <App>`
]);

/**
 * Whether the resolved editor is a GUI editor (opens its own window).
 *
 * An explicit `override` (from config) always wins. Otherwise the binary's
 * basename is matched against {@link GUI_EDITORS}, after stripping the directory
 * and any Windows executable extension.
 */
export function isGuiEditor(resolution: EditorResolution, override?: boolean): boolean {
  if (override !== undefined) return override;
  const base = (resolution.bin.split(/[\\/]/).pop() ?? resolution.bin).toLowerCase();
  const name = base.replace(/\.(exe|cmd|bat)$/, '');
  return GUI_EDITORS.has(name);
}

/**
 * Strip a single trailing newline that editors conventionally append.
 *
 * Many editors (vi in particular) always terminate the file with a newline.
 * Parameter-store values are typically newline-free, so without this the value
 * would always report as "changed". We remove exactly one trailing newline.
 */
function stripTrailingNewline(text: string): string {
  if (text.endsWith('\r\n')) return text.slice(0, -2);
  if (text.endsWith('\n')) return text.slice(0, -1);
  return text;
}

/**
 * Allocate a unique temp path, register crash cleanup, and write the initial
 * value with restrictive permissions. Returns the path; callers must pass it to
 * {@link cleanupTempFile} in a `finally`.
 */
function createTempFile(initialValue: string, opts: EditOptions): string {
  const dir = (opts.tempDir && opts.tempDir.trim()) || os.tmpdir();
  const ext = opts.extension ?? '.txt';
  const tmpPath = path.join(dir, `paramhub-${randomBytes(8).toString('hex')}${ext}`);

  registerCleanup();
  liveTempFiles.add(tmpPath);
  writeFileSync(tmpPath, initialValue, { mode: 0o600 });
  return tmpPath;
}

/** Read the edited temp file back and report whether it changed. */
function readEditResult(tmpPath: string, initialValue: string): EditResult {
  const edited = stripTrailingNewline(readFileSync(tmpPath, 'utf8'));
  return { value: edited, changed: edited !== initialValue };
}

/** Untrack and unlink a temp file. Best-effort; safe to call more than once. */
function cleanupTempFile(tmpPath: string): void {
  liveTempFiles.delete(tmpPath);
  try {
    rmSync(tmpPath, { force: true });
  } catch {
    // best-effort cleanup
  }
}

/**
 * Open `initialValue` in a terminal editor and return the edited result.
 *
 * Blocking: uses `spawnSync` with inherited stdio, so the editor draws on the
 * TTY. Returns only after the editor process exits. The temp file is always
 * removed in `finally`, even if the editor errors.
 */
export function editValueInEditor(initialValue: string, opts: EditOptions = {}): EditResult {
  const tmpPath = createTempFile(initialValue, opts);
  try {
    const { bin, args } = resolveEditor(opts.editorCommand);
    const res = spawnSync(bin, [...args, tmpPath], { stdio: 'inherit' });
    if (res.error) {
      throw new Error(`Failed to launch editor "${bin}": ${res.error.message}`);
    }
    return readEditResult(tmpPath, initialValue);
  } finally {
    cleanupTempFile(tmpPath);
  }
}

/**
 * Open `initialValue` in a GUI editor and return the edited result.
 *
 * Non-blocking spawn (stdio ignored, since a GUI editor needs no terminal):
 * keeps the Node event loop alive so the caller's UI can keep rendering while
 * the editor window is open. Resolves on the child's `close` event; the editor
 * command must wait for the window to close (e.g. `code --wait`), otherwise the
 * child exits immediately and the unedited file is read back. The temp file is
 * always removed in `finally`.
 */
export async function editValueInEditorAsync(
  initialValue: string,
  opts: EditOptions = {},
): Promise<EditResult> {
  const tmpPath = createTempFile(initialValue, opts);
  try {
    const { bin, args } = resolveEditor(opts.editorCommand);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(bin, [...args, tmpPath], { stdio: 'ignore' });
      child.on('error', (err) =>
        reject(new Error(`Failed to launch editor "${bin}": ${err.message}`)),
      );
      child.on('close', () => resolve());
    });
    return readEditResult(tmpPath, initialValue);
  } finally {
    cleanupTempFile(tmpPath);
  }
}
