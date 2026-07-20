/**
 * CreateItemModal — multi-step "new parameter" form.
 *
 * Step 1 (path): type the parameter path. Enter advances when non-empty.
 * Step 2 (type): pick the item type from the provider's supportedItemTypes.
 * On submit: close, open the value in the external editor, then show a confirm
 * dialog before calling provider.createItem().
 *
 * There is no shared text-input component, so the path field uses manual
 * useInput handling (same pattern as SearchInput / ListPicker).
 */

import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ItemType } from '@paramhub/types';
import { useAppState, useAppDispatch } from '../../state/index.js';
import { useStatus } from '../../hooks/use-status.js';
import { useEditorContext } from '../../hooks/use-editor.js';
import { clearListCache } from '../../hooks/use-list.js';
import { conciseError } from '../../utils/error.js';
import { useTheme } from '../../theme/index.js';
import { isEnterKey } from '../../utils/keys.js';
import Modal from './Modal.js';

type Step = 'path' | 'type';

function extensionForType(type: ItemType): string {
  return type === 'json' ? '.json' : '.txt';
}

export default function CreateItemModal() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { setStatus } = useStatus();
  const { runEditor } = useEditorContext();
  const { theme } = useTheme();

  const provider = state.activeProviderId
    ? state.providers.get(state.activeProviderId) ?? null
    : null;
  const types: ItemType[] = provider?.getCapabilities().supportedItemTypes ?? ['string'];

  const [step, setStep] = useState<Step>('path');
  const [pathValue, setPathValue] = useState('');
  const [typeIndex, setTypeIndex] = useState(0);

  const close = () => dispatch({ type: 'CLOSE_MODAL' });

  const submit = (path: string, type: ItemType) => {
    // Close the form first; the editor + confirm run after (editor blocks).
    close();
    if (!provider?.createItem) return;

    void (async () => {
      const result = await runEditor('', { extension: extensionForType(type) });
      if (!result) {
        setStatus('Editor not available (no TTY)');
        return;
      }
      const value = result.value;
      const lines =
        value.length > 0
          ? value.split('\n').map((l) => ({ text: `+ ${l}`, kind: 'added' as const }))
          : [{ text: '(empty value)' }];

      dispatch({
        type: 'OPEN_MODAL',
        modal: {
          type: 'confirm',
          data: {
            title: 'Create parameter?',
            body: `${path}  (${type})`,
            lines,
            confirmLabel: 'Create',
            onConfirm: async () => {
              try {
                await provider.createItem!(path, value, type);
                clearListCache();
                dispatch({ type: 'REFRESH_LIST' });
                setStatus(`Created ${path}`);
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Create failed';
                dispatch({ type: 'SET_ERROR', error: `Create failed: ${conciseError(message)}` });
              }
            },
          },
        },
      });
    })();
  };

  useInput((input, key) => {
    if (key.escape) {
      close();
      return;
    }

    if (step === 'path') {
      if (isEnterKey(input, key)) {
        if (pathValue.trim().length > 0) setStep('type');
        return;
      }
      if (key.backspace || key.delete) {
        setPathValue((p) => p.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (key.tab || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
      // Accept multi-char input too (paste / batched delivery)
      if (input) setPathValue((p) => p + input);
      return;
    }

    // type step
    if (isEnterKey(input, key)) {
      submit(pathValue.trim(), types[typeIndex] ?? types[0]!);
      return;
    }
    if (key.leftArrow) {
      setStep('path');
      return;
    }
    if (key.upArrow || (key.ctrl && input === 'k')) {
      setTypeIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow || (key.ctrl && input === 'j')) {
      setTypeIndex((i) => Math.min(types.length - 1, i + 1));
      return;
    }
  });

  return (
    <Modal title="Create Parameter" width={64}>
      <Box>
        <Text dimColor>Path: </Text>
        <Text color={step === 'path' ? theme.inputText : undefined}>{pathValue}</Text>
        {step === 'path' && (
          <Text color={theme.accent} bold>
            _
          </Text>
        )}
      </Box>

      {step === 'type' && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Type:</Text>
          {types.map((t, i) => {
            const isSelected = i === typeIndex;
            return (
              <Text key={t} color={isSelected ? theme.accent : undefined} bold={isSelected}>
                {isSelected ? '> ' : '  '}
                {t}
              </Text>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {step === 'path'
            ? 'Type path · Enter: next · Esc: cancel'
            : '↑↓ type · ← back · Enter: open editor · Esc: cancel'}
        </Text>
      </Box>
    </Modal>
  );
}
