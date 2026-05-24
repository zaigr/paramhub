/**
 * TopBar component — Provider tabs and app title.
 *
 * Displays available provider tabs with icons, highlights the active provider,
 * and shows the app name.
 */

import { Box, Text } from 'ink';
import type { Provider } from '@paramhub/types';
import { useAppState } from '../../state/index.js';

interface TopBarProps {
  providers: Provider[];
}

export default function TopBar({ providers }: TopBarProps) {
  const { activeProviderId } = useAppState();

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={1}>
        <Text bold color="cyan">
          paramhub
        </Text>
        <Text dimColor>│</Text>
        {providers.map((provider) => {
          const isActive = provider.id === activeProviderId;
          return (
            <Box key={provider.id} marginRight={1}>
              <Text
                color={isActive ? 'cyan' : undefined}
                bold={isActive}
                dimColor={!isActive}
              >
                {provider.icon ? `${provider.icon} ` : ''}
                {provider.displayName}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box>
        <Text dimColor>Tab/Shift+Tab: switch</Text>
      </Box>
    </Box>
  );
}
