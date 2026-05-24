/**
 * MainLayout component — Orchestrates the top bar, content area, and status bar.
 *
 * This is the root layout component that structures the terminal UI.
 * It renders the TopBar, a flexible content area (passed as children),
 * and the StatusBar. Uses the full terminal height.
 */

import { Box, useStdout } from 'ink';
import type { Provider } from '@paramhub/types';
import TopBar from './TopBar.js';
import StatusBar from './StatusBar.js';

interface MainLayoutProps {
  providers: Provider[];
  children: React.ReactNode;
}

export default function MainLayout({ providers, children }: MainLayoutProps) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;

  return (
    <Box flexDirection="column" width="100%" height={terminalHeight}>
      <TopBar providers={providers} />
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {children}
      </Box>
      <StatusBar />
    </Box>
  );
}
