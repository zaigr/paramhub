/**
 * useEditor — hands a value to an external editor and reads the result back.
 *
 * Two paths, chosen by `isGuiEditor`:
 *
 * Terminal editors (vi/nano) draw on the TTY, so we must yield the terminal:
 *   1. drop raw mode and pause Ink's stdin reads,
 *   2. leave the alternate screen so the editor draws on the normal buffer,
 *   3. run the (blocking) editor,
 *   4. re-enter the alternate screen and resume Ink's input.
 *
 * GUI editors (VS Code, …) open their own window and never touch the terminal,
 * so we keep the alternate screen and leave Ink rendering. We still pause stdin
 * (so keystrokes meant for the editor don't leak into the TUI) and flag
 * `editingExternally` so the app can show a "waiting" overlay while the async,
 * non-blocking editor process runs.
 *
 * Raw mode is always restored via try/finally. If the terminal does not
 * support raw mode (not a TTY), runEditor returns null so callers can degrade
 * gracefully instead of corrupting the terminal.
 */

import { useCallback, useRef, createContext, useContext, createElement } from 'react';
import type { ReactNode } from 'react';
import { useStdin, useStdout } from 'ink';
import { editValueInEditor, editValueInEditorAsync, resolveEditor, isGuiEditor } from '../editor/external.js';
import type { EditOptions, EditResult } from '../editor/external.js';
import { ALT_SCREEN_ENTER, ALT_SCREEN_LEAVE } from '../utils/terminal.js';
import { useAppDispatch } from '../state/index.js';

export interface UseEditorReturn {
  /** Open a value in the editor. Resolves to null when no TTY is available. */
  runEditor: (initialValue: string, opts?: EditOptions) => Promise<EditResult | null>;
  /** Whether the current terminal supports handing off to an editor. */
  isSupported: boolean;
}

/** @param defaults Per-app editor options (from config) merged into each call. */
export function useEditor(defaults: EditOptions = {}): UseEditorReturn {
  const { stdin, setRawMode, isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const dispatch = useAppDispatch();

  // Config is React state (setup wizard / reload-config can change it after
  // mount), so the latest defaults are read through a ref: runEditor keeps a
  // stable identity (no command re-registration churn) but never uses a stale
  // editor command.
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const runEditor = useCallback(
    async (initialValue: string, opts: EditOptions = {}): Promise<EditResult | null> => {
      if (!isRawModeSupported) return null;

      const merged = { ...defaultsRef.current, ...opts };
      const gui = isGuiEditor(resolveEditor(merged.editorCommand), merged.gui);

      // Pause Ink's input either way so keystrokes go to the editor, not the TUI.
      setRawMode(false);
      stdin.pause();

      if (gui) {
        // GUI editor: keep the alt screen and Ink rendering; show a waiting
        // overlay. The async spawn keeps the event loop alive so Ink repaints.
        dispatch({ type: 'SET_EDITING', value: true });
        try {
          return await editValueInEditorAsync(initialValue, merged);
        } finally {
          dispatch({ type: 'SET_EDITING', value: false });
          stdin.resume();
          setRawMode(true);
        }
      }

      // Terminal editor: yield the terminal — leave the alt screen, run the
      // blocking editor, then reclaim the screen and input.
      stdout.write(ALT_SCREEN_LEAVE);
      try {
        return editValueInEditor(initialValue, merged);
      } finally {
        // Ink repaints on the next state change (callers always dispatch after).
        stdout.write(ALT_SCREEN_ENTER);
        stdin.resume();
        setRawMode(true);
      }
    },
    [stdin, setRawMode, isRawModeSupported, stdout, dispatch],
  );

  return { runEditor, isSupported: isRawModeSupported };
}

/**
 * Context exposing the single app-level editor instance.
 *
 * AppInner creates it once (config-aware) and passes runEditor to the command
 * registry; modals that drive the editor themselves (CreateItemModal) consume
 * the same instance so config editor settings apply uniformly.
 */
const EditorContext = createContext<UseEditorReturn | null>(null);

export function EditorProvider({
  value,
  children,
}: {
  value: UseEditorReturn;
  children: ReactNode;
}) {
  return createElement(EditorContext.Provider, { value }, children);
}

export function useEditorContext(): UseEditorReturn {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorContext must be used within an EditorProvider');
  return ctx;
}
