/**
 * TopBar component — Provider tabs and app title.
 *
 * Displays available provider tabs with icons, highlights the active provider,
 * and shows the app name.
 */

import { Box, Text } from 'ink';
import type { Provider } from '@paramhub/types';
import { useAppState } from '../../state/index.js';
import { useTheme } from '../../theme/index.js';

interface TopBarProps {
  providers: Provider[];
}

export default function TopBar({ providers }: TopBarProps) {
  const { activeProviderId, activeCustomTabId, view } = useAppState();
  const { theme } = useTheme();

  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const customTabs = activeProvider?.getCapabilities().customTabs ?? [];

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={1}>
        <Text bold color={theme.accent}>
          paramhub
        </Text>
        <Text dimColor>│</Text>
        {providers.map((provider) => {
          const isActive = provider.id === activeProviderId;
          return (
            <Box key={provider.id} marginRight={1}>
              <Text
                color={isActive ? theme.accent : undefined}
                bold={isActive}
                dimColor={!isActive}
              >
                {provider.icon ? `${provider.icon} ` : ''}
                {provider.displayName}
              </Text>
            </Box>
          );
        })}
        {customTabs.length > 0 && <Text dimColor>│</Text>}
        {customTabs.map((tab) => {
          const isActive = view === 'provider-tab' && activeCustomTabId === tab.id;
          return (
            <Box key={tab.id} marginRight={1}>
              <Text color={isActive ? theme.accent : undefined} bold={isActive} dimColor={!isActive}>
                {tab.label}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box>
        <Text dimColor>{providers.length > 1 ? 'Tab/Shift+Tab: switch' : ''}</Text>
      </Box>
    </Box>
  );
}
