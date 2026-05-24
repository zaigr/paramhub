/**
 * StatusBar component — Context info and hotkey hints.
 *
 * Shows the current provider context (region, profile, account) and
 * most common hotkey hints derived from the command registry.
 */

import { Box, Text } from 'ink';
import type { ProviderContext } from '@paramhub/types';
import { useAppState } from '../../state/index.js';
import { commandRegistry } from '../../commands/registry.js';

/** Get abbreviated hotkey hints for the status bar. */
function getHotkeyHints(): Array<{ label: string; hotkey: string }> {
  const hintCommands = [
    'core:toggle-command-palette',
    'core:focus-search',
    'core:quit',
  ];

  const hints: Array<{ label: string; hotkey: string }> = [];
  for (const id of hintCommands) {
    const hotkey = commandRegistry.getHotkey(id);
    const cmd = commandRegistry.getById(id);
    if (cmd && hotkey) {
      hints.push({ label: cmd.label, hotkey });
    }
  }
  return hints;
}

export default function StatusBar() {
  const { activeProviderId, providerContexts, error } = useAppState();

  const context: ProviderContext | undefined = activeProviderId
    ? providerContexts.get(activeProviderId)
    : undefined;

  const hints = getHotkeyHints();

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={1}>
        {context ? (
          <>
            {context.region && (
              <Text color="yellow">{context.region}</Text>
            )}
            {context.profile && (
              <>
                <Text dimColor>│</Text>
                <Text color="green">{context.profile}</Text>
              </>
            )}
            {context.account && (
              <>
                <Text dimColor>│</Text>
                <Text dimColor>{context.account}</Text>
              </>
            )}
          </>
        ) : (
          <Text dimColor>No provider active</Text>
        )}
        {error && (
          <>
            <Text dimColor>│</Text>
            <Text color="red">{error}</Text>
          </>
        )}
      </Box>
      <Box gap={2}>
        {hints.map((hint) => (
          <Text key={hint.hotkey} dimColor>
            <Text color="white">{hint.hotkey}</Text> {hint.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
