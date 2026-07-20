/**
 * Root application component for paramhub.
 *
 * Initializes the mock provider, registers commands, sets up state management,
 * and renders the main layout with global keybinding handling.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import type { Provider } from '@paramhub/types';
import { MockProviderFactory } from '@paramhub/types/mock';
import type { AppConfig } from './config/schema.js';
import { AppConfigSchema } from './config/schema.js';
import { loadConfig, writeConfigFile, getConfigFilePath } from './config/loader.js';
import { renderConfigTemplate } from './config/template.js';
import { ProviderManager } from './providers/manager.js';
import { conciseError } from './utils/error.js';
import { AppStateProvider, useAppState, useAppDispatch } from './state/index.js';
import { commandRegistry, createCoreCommands, applyKeybindingOverrides } from './commands/index.js';
import { useCommandContext } from './hooks/use-command-context.js';
import { useGlobalKeybindings } from './hooks/use-global-keybindings.js';
import { useFocusManagement } from './hooks/use-focus-management.js';
import { useSearch } from './hooks/use-search.js';
import { useStatus } from './hooks/use-status.js';
import { useEditor, EditorProvider } from './hooks/use-editor.js';
import { ThemeProvider, useTheme } from './theme/index.js';
import MainLayout from './components/layout/MainLayout.js';
import CommandPalette from './components/CommandPalette.js';
import ListPicker from './components/modals/ListPicker.js';
import ConfirmDialog from './components/modals/ConfirmDialog.js';
import CreateItemModal from './components/modals/CreateItemModal.js';
import HelpOverlay from './components/modals/HelpOverlay.js';
import SetupWizard from './components/modals/SetupWizard.js';
import type { SetupChoices } from './components/modals/SetupWizard.js';
import Modal from './components/modals/Modal.js';
import SearchInput from './components/search/SearchInput.js';
import ItemList from './components/list/ItemList.js';
import DetailPanel from './components/detail/DetailPanel.js';

/** Content area — renders the current view based on app state. */
function ContentArea({
  configPath,
  onSetupComplete,
}: {
  configPath: string;
  onSetupComplete: (choices: SetupChoices) => Promise<void>;
}) {
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
  } else if (modal?.type === 'help') {
    overlay = <HelpOverlay />;
  } else if (modal?.type === 'setup-wizard') {
    overlay = <SetupWizard configPath={configPath} onComplete={onSetupComplete} />;
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
  const { theme } = useTheme();

  if (state.view === 'list') {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
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
            <Text color={theme.error}>Error: {state.error}</Text>
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

interface AppProps {
  providers: Provider[];
  config?: AppConfig;
  /** Path of the config file (used by reload + the setup wizard). */
  configPath?: string;
  /** True when no config file exists yet — opens the setup wizard on boot. */
  firstRun?: boolean;
}

/** Inner app component with access to state context. */
function AppInner({
  providers: initialProviders,
  config: initialConfig,
  configPath = getConfigFilePath(),
  firstRun = false,
}: AppProps) {
  const dispatch = useAppDispatch();
  const context = useCommandContext();
  const { isGlobalKeybindingsActive } = useFocusManagement();
  const { exit } = useApp();
  const { setThemeName } = useTheme();

  // Config and providers are state: reload-config swaps the config, the setup
  // wizard hot-swaps the provider list. Effects below depend on both, so the
  // command registry / editor / provider map re-wire automatically.
  const [config, setConfig] = useState<AppConfig>(
    () => initialConfig ?? AppConfigSchema.parse({}),
  );
  const [providerList, setProviderList] = useState(initialProviders);

  const { setStatus } = useStatus();
  const editor = useEditor({
    editorCommand: config.editor?.command,
    tempDir: config.editor?.tempDir,
    gui: config.editor?.gui,
  });

  /** Re-read the config file; applies theme + keybindings + editor settings. */
  const reloadConfig = useCallback(async () => {
    const { config: fresh } = await loadConfig(configPath);
    const providersChanged =
      JSON.stringify(fresh.providers) !== JSON.stringify(config.providers);
    commandRegistry.setOverrides(fresh.keybindings);
    setThemeName(fresh.theme);
    setConfig(fresh);
    setStatus(
      providersChanged
        ? 'Config reloaded — provider changes require a restart'
        : 'Config reloaded',
    );
  }, [configPath, config.providers, setStatus, setThemeName]);

  /** Setup wizard completion: write config, apply it, hot-load providers. */
  const applySetup = useCallback(
    async (choices: SetupChoices) => {
      await writeConfigFile(
        configPath,
        renderConfigTemplate({
          theme: choices.theme,
          awsEnabled: choices.provider === 'aws-ssm',
          mockEnabled: choices.provider === 'mock',
          editorCommand: choices.editorCommand,
        }),
      );

      const { config: fresh } = await loadConfig(configPath);
      commandRegistry.setOverrides(fresh.keybindings);
      setThemeName(fresh.theme);
      setConfig(fresh);

      // Hot-load the chosen providers so first-run works without a restart.
      const manager = new ProviderManager();
      await manager.loadAll(fresh.providers);
      let next = manager.getAll();
      if (next.length === 0) {
        const failure = manager.getFailures()[0];
        const mock = MockProviderFactory.create();
        await mock.init({});
        next = [mock];
        setStatus(
          failure
            ? `Provider failed (${conciseError(failure.error.message)}) — using demo data`
            : 'Config saved — using demo data',
        );
      } else {
        setStatus('Setup complete');
      }

      const replaced = providerList;
      setProviderList(next);
      // Best-effort disposal of the swapped-out instances; the new ones are
      // released at process exit.
      for (const p of replaced) {
        void p.dispose().catch(() => {});
      }
    },
    [configPath, providerList, setStatus, setThemeName],
  );

  // Register core + active-provider commands; re-runs on config/provider change.
  useEffect(() => {
    const getProvider = (id: string | null): Provider | null =>
      id ? providerList.find((p) => p.id === id) ?? null : null;
    const getProviders = (): Provider[] => providerList;
    const coreCommands = createCoreCommands({
      dispatch,
      exit,
      getProvider,
      getProviders,
      setStatus,
      runEditor: editor.runEditor,
      reloadConfig,
    });
    commandRegistry.registerAll(coreCommands);

    // Register commands only for the initially active provider
    if (providerList.length > 0) {
      commandRegistry.registerAll(providerList[0]!.getCommands());
    }

    // Apply keybinding overrides from config. Stored on the registry, so
    // commands registered later (tab switches) pick them up too.
    applyKeybindingOverrides(config.keybindings ?? {});

    return () => {
      commandRegistry.clear();
    };
  }, [dispatch, exit, providerList, setStatus, config, editor.runEditor, reloadConfig]);

  // Initialize providers on mount and after a wizard hot-swap
  useEffect(() => {
    const providerMap = new Map<string, Provider>();
    for (const p of providerList) {
      providerMap.set(p.id, p);
    }
    dispatch({ type: 'SET_PROVIDERS', providers: providerMap });

    // Set the first provider as active
    if (providerList.length > 0) {
      const first = providerList[0]!;
      dispatch({ type: 'SET_PROVIDER', providerId: first.id });

      // Load provider context
      first.getCurrentContext().then((ctx) => {
        dispatch({ type: 'SET_PROVIDER_CONTEXT', providerId: first.id, context: ctx });
      });
    }
  }, [providerList, dispatch]);

  // First run: open the setup wizard.
  useEffect(() => {
    if (firstRun) {
      dispatch({ type: 'OPEN_MODAL', modal: { type: 'setup-wizard' } });
    }
  }, [firstRun, dispatch]);

  // Global keybindings
  useGlobalKeybindings(context, { isActive: isGlobalKeybindingsActive });

  return (
    <EditorProvider value={editor}>
      <MainLayout providers={providerList}>
        <ContentArea configPath={configPath} onSetupComplete={applySetup} />
      </MainLayout>
    </EditorProvider>
  );
}

/** Root App component — wraps with state + theme providers. */
export default function App(props: AppProps) {
  return (
    <AppStateProvider>
      <ThemeProvider initialThemeName={props.config?.theme}>
        <AppInner {...props} />
      </ThemeProvider>
    </AppStateProvider>
  );
}
