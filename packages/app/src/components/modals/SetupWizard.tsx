/**
 * SetupWizard — first-run configuration flow.
 *
 * Steps: theme (live preview) → provider → editor (platform-aware, with a
 * free-text custom step) → confirm. On confirm the parent (AppInner) writes
 * the config file and hot-loads the chosen providers via `onComplete`.
 *
 * Opened automatically when no config file exists (firstRun) and re-runnable
 * anytime via the `core:setup-wizard` palette command. Esc at any step
 * cancels and reverts the live theme preview.
 */

import { useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppDispatch } from '../../state/index.js';
import { useTheme, getThemeNames } from '../../theme/index.js';
import { isEnterKey } from '../../utils/keys.js';
import SelectList from '../common/SelectList.js';
import type { SelectOption } from '../common/SelectList.js';
import Modal from './Modal.js';

export interface SetupChoices {
  theme: string;
  provider: 'aws-ssm' | 'mock';
  /** Editor command; empty string = $EDITOR / $VISUAL / platform fallback. */
  editorCommand: string;
}

type Step = 'theme' | 'provider' | 'editor' | 'editor-custom' | 'confirm';

const PROVIDER_OPTIONS: SelectOption[] = [
  { label: 'AWS SSM Parameter Store', value: 'aws-ssm', hint: '(needs AWS credentials)' },
  { label: 'None — built-in demo data', value: 'mock' },
];

const CUSTOM_EDITOR = '__custom__';

function buildEditorOptions(): SelectOption[] {
  const isWindows = process.platform === 'win32';
  const fallback = isWindows ? 'notepad' : 'vi';
  return [
    { label: 'System default', value: '', hint: `($EDITOR / $VISUAL, else ${fallback})` },
    ...(isWindows
      ? [{ label: 'notepad', value: 'notepad' }]
      : [
          { label: 'vi', value: 'vi' },
          { label: 'nano', value: 'nano' },
        ]),
    { label: 'VS Code', value: 'code --wait', hint: '(code --wait)' },
    { label: 'Custom…', value: CUSTOM_EDITOR, hint: '(type any command)' },
  ];
}

interface SetupWizardProps {
  configPath: string;
  /** Writes the config + hot-loads providers; throws on failure. */
  onComplete: (choices: SetupChoices) => Promise<void>;
}

export default function SetupWizard({ configPath, onComplete }: SetupWizardProps) {
  const dispatch = useAppDispatch();
  const { theme, themeName, setThemeName } = useTheme();

  // Captured once so Esc can revert the live preview to the pre-wizard theme.
  const initialTheme = useRef(themeName);

  const themeNames = getThemeNames();
  const editorOptions = buildEditorOptions();

  const [step, setStep] = useState<Step>('theme');
  const [themeIndex, setThemeIndex] = useState(() =>
    Math.max(0, themeNames.indexOf(themeName)),
  );
  const [providerIndex, setProviderIndex] = useState(0);
  const [editorIndex, setEditorIndex] = useState(0);
  const [customCommand, setCustomCommand] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setThemeName(initialTheme.current);
    dispatch({ type: 'CLOSE_MODAL' });
  };

  const chosenEditor = () => {
    const value = editorOptions[editorIndex]?.value ?? '';
    return value === CUSTOM_EDITOR ? customCommand.trim() : value;
  };

  const choices = (): SetupChoices => ({
    theme: themeNames[themeIndex] ?? 'dark',
    provider: (PROVIDER_OPTIONS[providerIndex]?.value ?? 'mock') as SetupChoices['provider'],
    editorCommand: chosenEditor(),
  });

  const finish = () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    void onComplete(choices())
      .then(() => {
        dispatch({ type: 'CLOSE_MODAL' });
      })
      .catch((err: unknown) => {
        setSaving(false);
        setError(err instanceof Error ? err.message : 'Failed to write config');
      });
  };

  const moveSelection = (delta: number) => {
    if (step === 'theme') {
      setThemeIndex((i) => {
        const next = Math.max(0, Math.min(themeNames.length - 1, i + delta));
        // Live preview — the whole UI re-renders in the highlighted theme.
        setThemeName(themeNames[next]!);
        return next;
      });
    } else if (step === 'provider') {
      setProviderIndex((i) => Math.max(0, Math.min(PROVIDER_OPTIONS.length - 1, i + delta)));
    } else if (step === 'editor') {
      setEditorIndex((i) => Math.max(0, Math.min(editorOptions.length - 1, i + delta)));
    }
  };

  const goBack = () => {
    if (step === 'provider') setStep('theme');
    else if (step === 'editor') setStep('provider');
    else if (step === 'editor-custom') setStep('editor');
    else if (step === 'confirm') setStep('editor');
  };

  const advance = () => {
    if (step === 'theme') setStep('provider');
    else if (step === 'provider') setStep('editor');
    else if (step === 'editor') {
      if (editorOptions[editorIndex]?.value === CUSTOM_EDITOR) setStep('editor-custom');
      else setStep('confirm');
    } else if (step === 'editor-custom') {
      if (customCommand.trim().length > 0) setStep('confirm');
    } else if (step === 'confirm') finish();
  };

  useInput((input, key) => {
    if (saving) return;
    if (key.escape) {
      cancel();
      return;
    }
    if (isEnterKey(input, key)) {
      advance();
      return;
    }
    if (key.leftArrow) {
      goBack();
      return;
    }

    if (step === 'editor-custom') {
      if (key.backspace || key.delete) {
        setCustomCommand((c) => c.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (key.tab || key.upArrow || key.downArrow || key.rightArrow) return;
      // Accept multi-char input too (paste / batched delivery)
      if (input) setCustomCommand((c) => c + input);
      return;
    }

    if (key.upArrow || (key.ctrl && input === 'k')) moveSelection(-1);
    else if (key.downArrow || (key.ctrl && input === 'j')) moveSelection(1);
  });

  const stepNumber =
    step === 'theme' ? 1 : step === 'provider' ? 2 : step === 'confirm' ? 4 : 3;

  const summary = choices();

  return (
    <Modal title={`Setup (${stepNumber}/4)`} width={64}>
      {step === 'theme' && (
        <Box flexDirection="column">
          <Text dimColor>Pick a color theme (previewed live):</Text>
          <SelectList
            options={themeNames.map((name) => ({ label: name, value: name }))}
            selectedIndex={themeIndex}
          />
        </Box>
      )}

      {step === 'provider' && (
        <Box flexDirection="column">
          <Text dimColor>Which parameter store do you use?</Text>
          <SelectList options={PROVIDER_OPTIONS} selectedIndex={providerIndex} />
        </Box>
      )}

      {step === 'editor' && (
        <Box flexDirection="column">
          <Text dimColor>Editor for parameter values:</Text>
          <SelectList options={editorOptions} selectedIndex={editorIndex} />
        </Box>
      )}

      {step === 'editor-custom' && (
        <Box flexDirection="column">
          <Text dimColor>Editor command (e.g. &quot;code --wait&quot;):</Text>
          <Box>
            <Text>{customCommand}</Text>
            <Text bold>_</Text>
          </Box>
        </Box>
      )}

      {step === 'confirm' && (
        <Box flexDirection="column">
          <Text>Theme: {summary.theme}</Text>
          <Text>
            Provider:{' '}
            {PROVIDER_OPTIONS.find((o) => o.value === summary.provider)?.label ?? summary.provider}
          </Text>
          <Text>Editor: {summary.editorCommand || 'system default'}</Text>
          <Box marginTop={1}>
            <Text dimColor wrap="truncate-end">
              Writes {configPath}
            </Text>
          </Box>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={theme.error}>{error}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {saving
            ? 'Saving…'
            : step === 'editor-custom'
              ? 'Type command · Enter: next · ← back · Esc: cancel'
              : step === 'confirm'
                ? 'Enter: save · ← back · Esc: cancel'
                : '↑↓ choose · Enter: next · ← back · Esc: cancel'}
        </Text>
      </Box>
    </Modal>
  );
}
