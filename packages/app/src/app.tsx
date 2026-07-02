/**
 * Root application component for paramhub.
 *
 * Initializes the mock provider, registers commands, sets up state management,
 * and renders the main layout with global keybinding handling.
 */

import React, { useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import type { Provider } from '@paramhub/types';
import type { AppConfig } from './config/schema.js';
import { AppStateProvider, useAppState, useAppDispatch } from './state/index.js';
import { commandRegistry, createCoreCommands, applyKeybindingOverrides } from './commands/index.js';
import { useCommandContext } from './hooks/use-command-context.js';
import { useGlobalKeybindings } from './hooks/use-global-keybindings.js';
import { useFocusManagement } from './hooks/use-focus-management.js';
import { useSearch } from './hooks/use-search.js';
import { useStatus } from './hooks/use-status.js';
import { useEditor, EditorProvider } from './hooks/use-editor.js';
import MainLayout from './components/layout/MainLayout.js';
import CommandPalette from './components/CommandPalette.js';
import ListPicker from './components/modals/ListPicker.js';
import ConfirmDialog from './components/modals/ConfirmDialog.js';
import CreateItemModal from './components/modals/CreateItemModal.js';
import Modal from './components/modals/Modal.js';
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

  // An external GUI editor is open: keep the TUI on screen but show a waiting
  // overlay on top of whatever was there (list, detail, or a modal).
  if (state.editingExternally) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Modal title="Waiting for editor…">
          <Text dimColor>Save &amp; close the file in your editor to continue.</Text>
        </Modal>
      </Box>
    );
  }

  const base = <BaseView activeProvider={activeProvider} onLoadNextPage={loadNextPage} />;

  const modal = state.modal;
  let overlay: React.ReactNode = null;
  if (modal?.type === 'command-palette') {
    overlay = <CommandPalette />;
  } else if (modal?.type === 'region-picker' || modal?.type === 'profile-picker') {
    overlay = <ListPicker kind={modal.type === 'region-picker' ? 'region' : 'profile'} />;
  } else if (modal?.type === 'confirm') {
    overlay = <ConfirmDialog />;
  } else if (modal?.type === 'create-item') {
    overlay = <CreateItemModal />;
  }

  if (overlay) {
    return <FloatingLayer base={base}>{overlay}</FloatingLayer>;
  }

  return base;
}

// The overlay is absolute so it composites over the base (later in tree order)
// without disturbing its layout; centering lives on the absolute box alone so
// the in-flow base view keeps its natural size.
function FloatingLayer({ base, children }: { base: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {base}
      <Box
        position="absolute"
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
      >
        {children}
      </Box>
    </Box>
  );
}

function BaseView({
  activeProvider,
  onLoadNextPage,
}: {
  activeProvider: Provider | null;
  onLoadNextPage: () => void;
}) {
  const state = useAppState();

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
          onLoadNextPage={onLoadNextPage}
        />
      </Box>
    );
  }

  if (state.view === 'detail') {
    return <DetailPanel provider={activeProvider} />;
  }

  if (state.view === 'provider-tab' && state.activeCustomTabId) {
    const customTab = activeProvider
      ?.getCapabilities()
      .customTabs.find((t) => t.id === state.activeCustomTabId);
    if (customTab) return customTab.render() as React.ReactElement;
  }

  return (
    <Box paddingY={1}>
      <Text dimColor>Select an item to view details</Text>
    </Box>
  );
}

/** Inner app component with access to state context. */
function AppInner({ providers, config }: { providers: Provider[]; config?: AppConfig }) {
  const dispatch = useAppDispatch();
  const context = useCommandContext();
  const { isGlobalKeybindingsActive } = useFocusManagement();
  const { exit } = useApp();

  const { setStatus } = useStatus();
  const editor = useEditor({
    editorCommand: config?.editor?.command,
    tempDir: config?.editor?.tempDir,
    gui: config?.editor?.gui,
  });

  // Register core commands on mount
  useEffect(() => {
    const getProvider = (id: string | null): Provider | null =>
      id ? providers.find((p) => p.id === id) ?? null : null;
    const getProviders = (): Provider[] => providers;
    const coreCommands = createCoreCommands({
      dispatch,
      exit,
      getProvider,
      getProviders,
      setStatus,
      runEditor: editor.runEditor,
    });
    commandRegistry.registerAll(coreCommands);

    // Apply keybinding overrides from config
    if (config?.keybindings && Object.keys(config.keybindings).length > 0) {
      applyKeybindingOverrides(config.keybindings);
    }

    // Register commands only for the initially active provider
    if (providers.length > 0) {
      commandRegistry.registerAll(providers[0]!.getCommands());
    }

    return () => {
      commandRegistry.clear();
    };
  }, [dispatch, exit, providers, setStatus, config, editor.runEditor]);

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
    <EditorProvider value={editor}>
      <MainLayout providers={providers}>
        <ContentArea />
      </MainLayout>
    </EditorProvider>
  );
}

/** Root App component — wraps with state provider. */
export default function App({ providers, config }: { providers: Provider[]; config?: AppConfig }) {
  return (
    <AppStateProvider>
      <AppInner providers={providers} config={config} />
    </AppStateProvider>
  );
}
