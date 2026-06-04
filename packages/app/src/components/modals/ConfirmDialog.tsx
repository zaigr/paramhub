/**
 * ConfirmDialog — generic yes/no confirmation overlay.
 *
 * Reads its payload from the active modal's `data` (ConfirmModalData): a title,
 * an optional one-line body, and optional preview/diff lines. Backs both the
 * edit-value flow (shows a colored diff) and the delete flow (shows the path).
 *
 * y / Enter → close, then run data.onConfirm(). n / Esc → close (cancel).
 * Follows the ListPicker close-then-act pattern so the UI is responsive.
 */

import { Box, Text, useInput } from 'ink';
import { useAppState, useAppDispatch } from '../../state/index.js';
import type { ConfirmModalData } from '../../state/index.js';
import Modal from './Modal.js';

/** Cap on how many diff/preview lines to render before truncating. */
const MAX_LINES = 16;

export default function ConfirmDialog() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const data = state.modal?.data as ConfirmModalData | undefined;

  useInput((input, key) => {
    if (key.escape || input === 'n' || input === 'N') {
      dispatch({ type: 'CLOSE_MODAL' });
      return;
    }
    if (key.return || input === 'y' || input === 'Y') {
      dispatch({ type: 'CLOSE_MODAL' });
      const result = data?.onConfirm();
      if (result instanceof Promise) {
        result.catch(() => {
          // onConfirm surfaces its own errors via state
        });
      }
    }
  });

  if (!data) return null;

  const confirmLabel = data.confirmLabel ?? 'Confirm';
  const lines = data.lines ?? [];
  const visible = lines.slice(0, MAX_LINES);
  const hidden = lines.length - visible.length;

  return (
    <Modal title={data.title} width={70}>
      {data.body && (
        <Box>
          <Text>{data.body}</Text>
        </Box>
      )}
      {visible.length > 0 && (
        <Box flexDirection="column" marginTop={data.body ? 1 : 0}>
          {visible.map((line, i) => (
            <Text key={i} color={line.color}>
              {line.text}
            </Text>
          ))}
          {hidden > 0 && <Text dimColor>… {hidden} more line{hidden !== 1 ? 's' : ''}</Text>}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>{`y/Enter: ${confirmLabel} · n/Esc: cancel`}</Text>
      </Box>
    </Modal>
  );
}
