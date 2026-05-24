/**
 * Root application component for paramhub.
 *
 * Initializes the mock provider, registers commands, sets up state management,
 * and renders the main layout with global keybinding handling.
 */

import { useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import type { Provider } from '@paramhub/types';
import { AppStateProvider, useAppState, useAppDispatch } from './state/index.js';
import { commandRegistry, createCoreCommands } from './commands/index.js';
import { useCommandContext } from './hooks/use-command-context.js';
import { useGlobalKeybindings } from './hooks/use-global-keybindings.js';
import { useFocusManagement } from './hooks/use-focus-management.js';
import { useSearch } from './hooks/use-search.js';
import { useStatus } from './hooks/use-status.js';
import MainLayout from './components/layout/MainLayout.js';
import CommandPalette from './components/CommandPalette.js';
import SearchInput from './components/search/SearchInput.js';
import ItemList from './components/list/ItemList.js';
import DetailPanel from './components/detail/DetailPanel.js';

/** Content area — renders the current view based on app state. */
function ContentArea() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  // Get the active provider for search
  const activeProvider = state.activeProviderId
    ? state.providers.get(state.activeProviderId) ?? null
    : null;

  // Search hook — debounced, cached, with pagination
  const { loadNextPage } = useSearch({
    provider: activeProvider,
    state,
    dispatch,
  });

  // When the command palette is open, render it centered in the content area
  if (state.modal?.type === 'command-palette') {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <CommandPalette />
      </Box>
    );
  }

  if (state.view === 'list') {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <SearchInput />
        {state.items.length === 0 && !state.isLoading && !state.searchQuery && (
          <Box paddingY={1}>
            <Text dimColor>No items loaded. Press / to search or Ctrl+P for commands.</Text>
          </Box>
        )}
        {state.items.length === 0 && !state.isLoading && state.searchQuery && (
          <Box paddingY={1}>
            <Text dimColor>No results for &quot;{state.searchQuery}&quot;</Text>
          </Box>
        )}
        {state.error && (
          <Box paddingY={1}>
            <Text color="red">Error: {state.error}</Text>
          </Box>
        )}
        <ItemList
          items={state.items}
          selectedIndex={state.selectedIndex}
          isLoading={state.isLoading}
          hasNextPage={!!state.nextToken}
          onLoadNextPage={loadNextPage}
        />
      </Box>
    );
  }

  if (state.view === 'detail') {
    return <DetailPanel provider={activeProvider} />;
  }

  return (
    <Box paddingY={1}>
      <Text dimColor>Select an item to view details</Text>
    </Box>
  );
}

/** Inner app component with access to state context. */
function AppInner({ providers }: { providers: Provider[] }) {
  const dispatch = useAppDispatch();
  const context = useCommandContext();
  const { isGlobalKeybindingsActive } = useFocusManagement();
  const { exit } = useApp();

  const { setStatus } = useStatus();

  // Register core commands on mount
  useEffect(() => {
    const getProvider = (id: string | null): Provider | null =>
      id ? providers.find((p) => p.id === id) ?? null : null;
    const coreCommands = createCoreCommands({ dispatch, exit, getProvider, setStatus });
    commandRegistry.registerAll(coreCommands);

    // Register provider commands
    for (const provider of providers) {
      const providerCommands = provider.getCommands();
      commandRegistry.registerAll(providerCommands);
    }

    return () => {
      commandRegistry.clear();
    };
  }, [dispatch, exit, providers, setStatus]);

  // Initialize providers on mount
  useEffect(() => {
    const providerMap = new Map<string, Provider>();
    for (const p of providers) {
      providerMap.set(p.id, p);
    }
    dispatch({ type: 'SET_PROVIDERS', providers: providerMap });

    // Set the first provider as active
    if (providers.length > 0) {
      const first = providers[0]!;
      dispatch({ type: 'SET_PROVIDER', providerId: first.id });

      // Load provider context
      first.getCurrentContext().then((ctx) => {
        dispatch({ type: 'SET_PROVIDER_CONTEXT', providerId: first.id, context: ctx });
      });
    }
  }, [providers, dispatch]);

  // Global keybindings
  useGlobalKeybindings(context, { isActive: isGlobalKeybindingsActive });

  return (
    <MainLayout providers={providers}>
      <ContentArea />
    </MainLayout>
  );
}

/** Root App component — wraps with state provider. */
export default function App({ providers }: { providers: Provider[] }) {
  return (
    <AppStateProvider>
      <AppInner providers={providers} />
    </AppStateProvider>
  );
}
