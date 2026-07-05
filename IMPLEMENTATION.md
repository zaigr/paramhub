# Implementation Details

This document provides an overview of which phases of the implementation are currently in progress, and which files are being worked on. It serves as a reference for tracking the development process and ensuring that all necessary components are being addressed.

---

## Phase 0 — Project Scaffolding ✅ COMPLETE

**Status:** Done  
**Deliverable verified:** `pnpm build` produces all 3 packages, `node packages/app/dist/cli.js` renders "Hello from paramhub!" in the terminal.

### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| Init monorepo (pnpm workspaces, `turbo.json`) | ✅ | pnpm workspace with 3 packages, Turbo for orchestration |
| TypeScript config (`tsconfig.base.json`, per-package) | ✅ | ES2022 target, bundler moduleResolution, strict mode |
| Linting & formatting (ESLint flat config + Prettier) | ✅ | `eslint.config.mjs` with typescript-eslint, `.prettierrc` |
| Build setup (`tsup` for each package) | ✅ | ESM output with declarations and sourcemaps |
| Dev workflow (`turbo dev` — watch mode) | ✅ | `pnpm dev` runs watch mode across all packages |
| Git setup (`.gitignore`) | ✅ | Standard ignores for node_modules, dist, .turbo, etc. |

### Files created

```
paramhub/
├── package.json                          # Root workspace config
├── pnpm-workspace.yaml                   # Workspace package locations
├── turbo.json                            # Turbo pipeline config
├── tsconfig.base.json                    # Shared TS compiler options
├── .gitignore                            # Git ignore rules
├── .prettierrc                           # Prettier formatting config
├── eslint.config.mjs                     # ESLint flat config
├── packages/
│   ├── types/                            # @paramhub/types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/index.ts                  # Placeholder interface
│   ├── app/                              # @paramhub/app
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── cli.ts                    # Entry point (shebang, renders App)
│   │       └── app.tsx                   # Ink component ("Hello from paramhub!")
│   └── provider-aws-ssm/                 # @paramhub/provider-aws-ssm
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       └── src/index.ts                  # Placeholder exports
```

### Key decisions

- **Node >= 20** required (for native ESM, modern APIs)
- **pnpm 9.x** as package manager
- **ESM-only** output (`"type": "module"` in all packages)
- **tsup** for building (fast esbuild-based bundler with dts generation)
- **Turbo** for monorepo task orchestration with topological dependency ordering
- **Ink 5** for the TUI framework (React-based terminal rendering)
- **Changesets skipped** for now (can add later when publishing)

### Verification commands

```sh
pnpm install        # Installs all dependencies
pnpm build          # Builds all 3 packages (types → app, provider-aws-ssm)
pnpm dev            # Starts watch mode across all packages
node packages/app/dist/cli.js  # Renders the Hello TUI
```

---

## Phase 1 — Provider Contract + Command System Types ✅ COMPLETE

**Status:** Done  
**Deliverable verified:** `@paramhub/types` fully defined with all provider contract interfaces and command system types. Mock provider passes all 33 conformance tests including command registration.

### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| Define `@paramhub/types` (Provider interface, Item, SearchResult, metadata) | ✅ | 7 type modules: items, search, actions, tabs, config, commands, provider |
| Define command types (`Command`, `CommandContext`, `ProviderCommand`) | ✅ | Full command system with categories, hotkeys, isEnabled/isVisible |
| Provider includes `getCommands()` | ✅ | Part of the Provider interface from day one |
| Build mock provider | ✅ | In-memory provider with 10 fake items + 3 example commands |
| Provider conformance test suite | ✅ | Shared vitest suite (33 tests) any provider can run |

### Key design decisions

- **Zero React dependency in types** — `CustomTab.render()` returns `unknown`, consumers cast to their framework's element type
- **Command system from day one** — `Provider.getCommands()` is mandatory, ensuring all actions go through the command registry
- **CommandContext** — provides view state, selected item, and active provider to enable/disable commands contextually
- **Conformance suite uses vitest directly** — `runProviderConformanceTests(factory)` can be imported by any provider's test file
- **Mock provider in `@paramhub/types/testing`** — available as `import { MockProviderFactory } from '@paramhub/types/testing'`
- **Pagination in mock** — uses simple index-based nextToken to test pagination flows

### Type system overview

```
Provider Interface
├── Lifecycle: init() → testConnection() → dispose()
├── Capabilities: getCapabilities() → ProviderCapabilities
├── Commands: getCommands() → Command[]
├── Context: getCurrentContext(), switchRegion(), switchProfile()
├── Data: search(), getItem(), getValue(), getItemDetails()
└── Mutations: updateValue?(), createItem?(), deleteItem?()

Command System
├── Command { id, label, category, hotkey, isEnabled?, isVisible?, execute() }
├── ProviderCommand extends Command { providerId }
├── CommandContext { activeProviderId, view, selectedItem, searchQuery }
└── CommandCategory: navigation | search | item | provider | bookmarks | view | system
```

### Verification commands

```sh
pnpm build          # All 3 packages build successfully
pnpm typecheck      # All packages pass type checking
pnpm test           # 33 conformance tests pass
pnpm --filter @paramhub/types test  # Direct test execution
```

---

## Phase 2 — Core TUI Shell + Command Infrastructure

**Status:** Phase 2a, 2b, 2c & 2d complete ✅

---

### Phase 2a — Command Registry & Keybinding Engine ✅ COMPLETE

**Status:** Done  
**Deliverable verified:** `CommandRegistry` singleton operational with fuzzy search (fuse.js), hotkey resolution, and register/unregister lifecycle. Core commands defined and bound. Global keybinding hook captures input and dispatches to commands.

#### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| `CommandRegistry` class (singleton) | ✅ | Register, unregister, search via fuse.js, resolveByHotkey, getByCategory |
| Core commands defined | ✅ | 13 built-in commands: quit, command-palette, navigate-up/down, open-detail, back, focus-search, clear-search, next/prev-tab, reveal-value, copy-value, copy-path |
| `useGlobalKeybindings` hook | ✅ | Ink `useInput` → normalize key → find command → execute. Respects isActive flag |
| Keybinding override loader | ✅ | `applyKeybindingOverrides(overrides)` remaps hotkeys at boot |
| `CommandContext` builder | ✅ | `useCommandContext()` hook derives context from AppState |

#### Key normalization format

- Plain characters: `"a"`, `"z"`, `"1"`, `"/"`
- Ctrl modifiers: `"ctrl+p"`, `"ctrl+q"`, `"ctrl+r"`
- Shift modifiers (non-char): `"shift+tab"`
- Special keys: `"return"`, `"escape"`, `"tab"`, `"backspace"`, `"delete"`
- Arrow keys: `"up"`, `"down"`, `"left"`, `"right"`

---

### Phase 2b — Layout, Navigation & Command Palette ✅ COMPLETE

**Status:** Done  
**Deliverable verified:** Full TUI shell with TopBar (provider tabs), content area, StatusBar (context + hotkey hints), command palette (Ctrl+P with fuzzy search), modal system, focus management, and state management via React context + useReducer.

#### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| `MainLayout.tsx` | ✅ | Top bar + content area + status bar |
| `TopBar.tsx` | ✅ | Provider tabs with icon, name, active highlight |
| `StatusBar.tsx` | ✅ | Region/profile/account context + hotkey hints from registry |
| `CommandPalette.tsx` | ✅ | Modal overlay, fuzzy search, scrollable results, label + hotkey display |
| Modal system | ✅ | Generic `Modal` component shared by palette and future dialogs |
| Focus management | ✅ | `useFocusManagement()` hook tracks active zone, modal steals focus |
| State management | ✅ | React context + `useReducer` with AppState and 17 action types |

#### Key design decisions

- **Registry is a module-level singleton** — imported directly, no React context needed for the registry itself
- **Mock provider hardcoded** — imported from `@paramhub/types/mock` (runtime-safe, no vitest) at boot (Phase 4 adds dynamic loading)
- **Separate state/dispatch contexts** — prevents unnecessary re-renders when only dispatch is needed
- **Focus zones** — `'list' | 'search' | 'detail' | 'modal'` determine which component receives keyboard input
- **Global keybindings deactivated** when modal is open or search is focused
- **Command palette** fuzzy-searches against label (70% weight), description (20%), and ID (10%)
- **Core commands receive dispatch + exit** — they dispatch state actions directly, no intermediate abstraction

#### State architecture

```
AppState
├── Provider: activeProviderId, providers Map, providerContexts Map
├── View: view mode (list | detail | bookmarks | provider-tab)
├── Search & List: searchQuery, items, selectedIndex, isLoading, nextToken
├── Detail: selectedItem, revealedValue
└── UI: modal, focusZone, error

17 Action Types:
  SET_PROVIDER, SET_PROVIDERS, SET_PROVIDER_CONTEXT, SET_VIEW,
  SEARCH_START, SEARCH_SUCCESS, SEARCH_ERROR, SELECT_ITEM,
  SET_SELECTED_ITEM, TOGGLE_REVEAL, OPEN_MODAL, CLOSE_MODAL,
  SET_FOCUS, SET_SEARCH_QUERY, CLEAR_SEARCH, SET_ERROR,
  NAVIGATE_UP, NAVIGATE_DOWN
```

#### Command registry capabilities

- `register(command)` / `registerAll(commands)` — add commands
- `unregister(id)` / `unregisterByPrefix(prefix)` — remove commands
- `getById(id)` / `getAll()` / `getByCategory(category)` — lookup
- `resolveByHotkey(normalizedKey, context)` — hotkey dispatch (checks isEnabled + isVisible)
- `search(query, context)` — fuzzy search for command palette
- `getHotkey(id)` / `setHotkey(id, hotkey)` — keybinding management

#### Verification commands

```sh
pnpm build          # All 3 packages build successfully
pnpm typecheck      # All packages pass type checking
pnpm test           # 33 conformance tests still pass
node packages/app/dist/cli.js  # Renders full TUI with mock provider
```

---

### Phase 2c — Search & List ✅ COMPLETE

**Status:** Done  
**Deliverable verified:** SearchInput captures keyboard input when focused (via `/` hotkey), debounced search calls provider.search(), results render in a viewport-windowed ItemList, pagination triggers at bottom of results, TTL cache avoids redundant calls.

#### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| `TTLCache` utility | ✅ | Generic TTL Map (30s default), prune method for housekeeping |
| `useSearch` hook | ✅ | Debounced (300ms), stale-request detection, cache-first, pagination support |
| `SearchInput.tsx` | ✅ | Manual `useInput` (active only in search zone), Escape/Return/Tab blur to list, Ctrl+U clears |
| `ItemRow.tsx` | ✅ | Selection indicator, path, type badge (secure = yellow) |
| `ItemList.tsx` | ✅ | Viewport windowing, scroll-to-keep-selected-visible, auto-pagination at bottom |
| Wire `core:focus-search` | ✅ | Dispatches `SET_FOCUS zone:'search'` (no longer no-op) |
| Focus gating for search | ✅ | `isGlobalKeybindingsActive` now checks `focusZone !== 'search'` |
| Refactored `ContentArea` | ✅ | Uses SearchInput + ItemList + useSearch, shows empty/error/no-results states |

#### Files created

```
packages/app/src/
├── utils/
│   └── cache.ts                    # TTLCache<K, V> generic utility
├── hooks/
│   └── use-search.ts               # Debounced search with cache + pagination
└── components/
    ├── search/
    │   └── SearchInput.tsx          # Focused text input for search queries
    └── list/
        ├── ItemList.tsx             # Viewport-windowed scrollable list
        └── ItemRow.tsx              # Single parameter row display
```

#### Files modified

```
packages/app/src/
├── app.tsx                          # ContentArea refactored to use new components
├── commands/core-commands.ts        # core:focus-search now dispatches SET_FOCUS
└── hooks/use-focus-management.ts    # Added focusZone !== 'search' check
```

#### Key design decisions

- **SearchInput uses manual `useInput`** — same pattern as CommandPalette, active only when `focusZone === 'search'`, avoids ink-text-input dependency
- **useSearch debounce (300ms)** — prevents excessive provider calls during typing; stale requests are discarded via incrementing request ID
- **Module-level TTLCache** — shared across re-renders, cleared on provider change, 30s TTL prevents stale data
- **Viewport windowing** — calculates visible rows based on terminal height minus chrome (6 rows for TopBar + SearchInput + StatusBar + buffer), centers selection in viewport
- **Pagination trigger** — when selectedIndex reaches within 3 items of the end and nextToken exists, loadNextPage() is called automatically
- **Focus flow**: `/` → focus search → type query → Enter/Escape/Tab → blur to list → Up/Down navigate results → Enter opens detail

#### Data flow

```
User presses "/"
  → global keybinding → core:focus-search → dispatch SET_FOCUS 'search'
  → isGlobalKeybindingsActive becomes false
  → SearchInput's useInput activates

User types "db"
  → SearchInput dispatches SET_SEARCH_QUERY "d", then "db"
  → useSearch detects query change, starts 300ms timer
  → After 300ms: check cache → miss → dispatch SEARCH_START
  → provider.search({query: "db", maxResults: 20})
  → Response → cache.set() → dispatch SEARCH_SUCCESS (items, nextToken)
  → ItemList renders viewport window of results

User presses Escape
  → SearchInput dispatches SET_FOCUS 'list'
  → isGlobalKeybindingsActive becomes true
  → Up/Down/Enter work again for navigation
```

---

### Phase 2d — Detail Panel ✅ COMPLETE

**Status:** Done  
**Deliverable verified:** Opening an item renders `DetailPanel` with provider-supplied fields (`provider.getItemDetails()`), lazily loads the value (`provider.getValue()` only on detail open, cached), masks `secure` values until toggled with `r`, and copies value/path to the clipboard via `core:copy-value` (`c`) / `core:copy-path` (`y`) with transient status feedback.

#### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| `DetailPanel.tsx` | ✅ | Title + provider detail fields + value preview + footer/status hint; sensitive fields masked until revealed |
| `ValuePreview.tsx` | ✅ | Loading / error / masked / revealed states; secure values masked by default |
| Lazy value loading (`useItemValue`) | ✅ | Fetches `getValue()` on open, request-id staleness guard, module-level `TTLCache` reused by copy command |
| `core:reveal-value` (`r`) | ✅ | Already dispatched `TOGGLE_REVEAL`; now drives masking in panel + preview |
| `core:copy-value` (`c`) | ✅ | Resolves provider via `getProvider`, reads cached/fetched value, writes clipboard, sets status |
| `core:copy-path` (`y`) | ✅ | Writes `selectedItem.path` to clipboard, sets status |
| Transient status feedback | ✅ | `statusMessage` state + StatusBar display + 2s auto-clear effect |

#### Files created

```
packages/app/src/
├── hooks/
│   └── use-item-value.ts           # Lazy value loader (cache + staleness guard)
└── components/detail/
    ├── DetailPanel.tsx              # Detail fields + value preview + footer
    └── ValuePreview.tsx             # Masked/revealed value display
```

#### Files modified

```
packages/app/src/
├── app.tsx                          # Render DetailPanel; pass getProvider to commands; status auto-clear
├── commands/core-commands.ts        # copy-value/copy-path wired to clipboardy + getProvider
├── state/reducer.ts                 # detailValue*, statusMessage state + LOAD_VALUE_*/SET_STATUS actions
└── components/layout/StatusBar.tsx  # Show transient statusMessage
packages/app/package.json            # Added clipboardy dependency
```

#### Key design decisions

- **Lazy value loading mirrors `useSearch`** — request-id ref discards stale fetches; a module-level `TTLCache<string,string>` (key `providerId:itemId`) is shared with `core:copy-value` so copying doesn't refetch
- **Copy commands resolve the provider via `getProvider`** — passed into `createCoreCommands`; commands only receive `CommandContext`, so the provider lookup is injected rather than added to the command contract
- **Masking is type-driven** — `secure` items (and `sensitive` detail fields) are masked until `core:reveal-value` toggles `revealedValue`
- **Transient status** — `statusMessage` shown in StatusBar (green), auto-cleared after 2s via an effect in `AppInner` (reducers stay timer-free)

#### Verification commands

```sh
pnpm install        # Adds clipboardy
pnpm typecheck      # All packages pass
pnpm build          # All 3 packages build
pnpm test           # 33 conformance tests still pass
node packages/app/dist/cli.js  # Open an item → details, reveal (r), copy (c/y)
```

---

## Phase 3 — AWS SSM Provider ✅ COMPLETE

**Status:** Done  
**Deliverable verified:** `@paramhub/provider-aws-ssm` implements the full `Provider` contract
against AWS SDK v3 (read + write + region/profile switching) and passes the shared conformance
suite (25 tests) plus 9 provider-specific tests, all against a mocked AWS SDK. The app boots the
real provider when `PARAMHUB_PROVIDER=aws-ssm` is set; the mock remains the default.

### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| Package setup | ✅ | AWS SDK (`client-ssm`, `client-sts`, `credential-providers`), `@smithy/shared-ini-file-loader`, `clipboardy` deps; `vitest` + `aws-sdk-client-mock` dev deps; `vitest.config.ts` |
| `search()` | ✅ | `GetParametersByPath` (recursive) when `pathPrefix` given, else `DescribeParameters` with a `Name Contains` filter; AWS `NextToken` pagination |
| `getItem()` / `getValue()` | ✅ | `DescribeParameters` (Equals filter) for metadata + best-effort `ListTagsForResource`; `GetParameter` with `WithDecryption` for values |
| `getItemDetails()` | ✅ | Name, Type, ARN, Tier, Data Type, Version, Last Modified (+ user), KMS Key ID (secure), Tags |
| `updateValue()` / `createItem()` / `deleteItem()` | ✅ | `PutParameter` (Overwrite for update, type-mapped for create), `DeleteParameter` |
| Region & profile switching | ✅ | Re-instantiates SSM/STS clients, resets cached account |
| `getCommands()` | ✅ | `aws-ssm:copy-arn` (clipboardy, gated on selected item) |
| Cross-platform profile resolution | ✅ | `resolveProfile()` via `loadSharedConfigFiles`: configured → `default` → first available → undefined |
| Conformance tests (mocked AWS) | ✅ | Stateful in-memory store backing `aws-sdk-client-mock`; conformance + unit tests |
| App wiring (env switch) | ✅ | `cli.ts` selects factory by `PARAMHUB_PROVIDER`; passes `AWS_REGION`/`AWS_PROFILE` |

### Files created

```
packages/provider-aws-ssm/
├── src/
│   ├── auth.ts         # SSM/STS client construction (fromNodeProviderChain)
│   ├── config.ts       # config schema, parseConfig, cross-platform resolveProfile/listProfiles
│   ├── mapper.ts       # SSM<->ItemType, parameterToItem, metadataToItem, buildDetailFields
│   ├── commands.ts     # aws-ssm:copy-arn provider command
│   ├── provider.ts     # AwsSsmProvider + AwsSsmProviderFactory
│   └── index.ts        # exports (replaced placeholder)
├── tests/
│   └── aws-ssm-provider.test.ts   # stateful aws-sdk-client-mock + conformance + unit tests
└── vitest.config.ts
```

### Files modified

```
packages/provider-aws-ssm/package.json  # AWS SDK + smithy + clipboardy deps, vitest/aws-sdk-client-mock, test script
packages/app/package.json                # added @paramhub/provider-aws-ssm workspace dep
packages/app/src/cli.ts                  # PARAMHUB_PROVIDER env switch (mock default)
packages/types/tsup.config.ts            # external: ['vitest'] (see key decision below)
```

### Key design decisions

- **Search routing** — `pathPrefix` → `GetParametersByPath` (recursive, max 10); otherwise
  `DescribeParameters` (max 50) with a server-side `Name Contains` filter from `query`. Values are
  never returned by search (loaded lazily via `getValue`)
- **ARN synthesis** — `DescribeParameters` `ParameterMetadata` omits ARN on older API shapes, so
  `metadataToItem` synthesizes `arn:aws:ssm:<region>:<account>:parameter<name>` when the account is
  known (account comes from a lazy, best-effort `STS GetCallerIdentity`, cached)
- **Cross-platform profiles** — profile resolution and `getAvailableProfiles()` use
  `@smithy/shared-ini-file-loader`'s `loadSharedConfigFiles` (honors `HOME`/`USERPROFILE`,
  `AWS_CONFIG_FILE`, etc.) rather than hand-building `~/.aws` paths; falls back gracefully when no
  config files exist
- **Type mapping** — SSM `String`/`SecureString`/`StringList` ↔ `'string'`/`'secure'`/`'list'`;
  `json`/`binary` map back to `String`. `supportedItemTypes` is `['string','secure','list']`
- **`external: ['vitest']` in the types build** — tsup was bundling vitest (a devDependency) into
  `@paramhub/types/dist/testing/index.js`. A bundled vitest copy registers `describe`/`it` against a
  detached runner, so the conformance suite silently collected **zero** tests in any external
  consumer. Externalizing vitest makes the dist use the consumer's runner instance. (The types
  package's own test imports from `src`, which is why this was latent until now)
- **Provider command status** — provider commands receive only `CommandContext` and cannot push a
  status toast (same limitation as the mock); `copy-arn`'s clipboard write still runs
- **Mocked conformance** — a module-level in-memory parameter store backs `aws-sdk-client-mock`
  handlers so the conformance create→update→getValue→delete sequence stays consistent; no live AWS

### Verification commands

```sh
pnpm install                                   # AWS SDK + smithy + clipboardy + dev deps
pnpm --filter @paramhub/provider-aws-ssm test  # conformance (25) + unit (9) = 34, mocked AWS
pnpm build                                      # all 3 packages build (app bundle stays ~43KB; SDK external)
pnpm typecheck                                  # all packages pass
pnpm test                                       # types (33) + provider (34) green

# Manual, real SSM (needs AWS creds/permissions):
PARAMHUB_PROVIDER=aws-ssm AWS_PROFILE=<p> AWS_REGION=<r> node packages/app/dist/cli.js
```

---

## Phase 4 — Provider Discovery & Dynamic Loading ✅ COMPLETE

**Status:** Done  
**Deliverable verified:** Config loaded from `~/.config/paramhub/config.yaml` (XDG-aware, generated on first run). `ProviderManager` dynamically imports provider packages listed in config, initialises them, and registers only the active provider's commands. Tab/Shift+Tab switching swaps provider commands in the registry. Falls back to mock provider if config has no providers or all fail. All 70 tests still pass, build clean.

### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| Config loader (YAML, XDG path, zod validation) | ✅ | `loadConfig()` — reads, validates, generates default on first run |
| `ProviderManager` (dynamic `import()`, lifecycle) | ✅ | Loads enabled entries, factory discovery, non-fatal failures |
| On provider load: register commands with prefix | ✅ | Boot registers first (active) provider only |
| On provider unload/switch: unregister by prefix | ✅ | `unregisterByPrefix(providerId + ':')` on tab switch |
| Provider tabs in top bar (dynamic) | ✅ | Already dynamic from state; hint shown only when >1 provider |
| Tab switching wired (Tab/Shift+Tab) | ✅ | `core:next-tab` / `core:prev-tab` fully implemented |
| Custom tabs rendered in TopBar | ✅ | Passive labels rendered; content via `view:'provider-tab'` in ContentArea |
| First-run config generation | ✅ | `writeDefaultConfig()` writes commented YAML template to XDG path |
| Mock provider fallback | ✅ | Used when no providers configured or all fail to load |

### Files created

```
packages/app/src/
├── config/
│   ├── xdg.ts          # Cross-platform config dir (Windows/macOS/Linux)
│   ├── schema.ts        # Zod schema — AppConfig, ProviderEntry types
│   └── loader.ts        # loadConfig(), writeDefaultConfig(), getConfigFilePath()
└── providers/
    └── manager.ts       # ProviderManager class — loadAll(), dispose, getFailures()
```

### Files modified

```
packages/app/package.json                         # Added yaml ^2.4.0, zod ^3.23.0
packages/app/src/cli.ts                           # Replaced hardcoded bootstrap with config+ProviderManager
packages/app/src/app.tsx                          # config prop, selective command reg, custom tab view
packages/app/src/commands/core-commands.ts        # getProviders option, tab switch logic, switchTab helper
packages/app/src/components/layout/TopBar.tsx     # Custom tab labels, hint only when >1 provider
```

### Key design decisions

- **Selective command registration** — only the active provider's commands are in the registry at any time. Tab switch calls `unregisterByPrefix` + `registerAll` atomically before dispatching `SET_PROVIDER`.
- **Factory discovery** — checks `mod.default?.create` first, then scans named exports for first factory-shaped object. Handles `@paramhub/provider-aws-ssm`'s named `AwsSsmProviderFactory` export without requiring a default export.
- **Mock fallback** — statically imported `MockProviderFactory` is always available; used when `ProviderManager.getAll()` returns empty (no config, all providers failed, etc.)
- **Non-fatal provider failures** — each provider load is individually try/caught; failures are collected and printed to stderr before the alt screen opens.
- **XDG cross-platform** — `xdg.ts` uses `APPDATA` on Windows, `XDG_CONFIG_HOME` or `~/.config` on macOS/Linux; only `node:os` + `node:path`.

### Generated config location

```
macOS/Linux: ~/.config/paramhub/config.yaml
Windows:     %APPDATA%\paramhub\config.yaml
```

### Verification commands

```sh
pnpm install        # adds yaml + zod
pnpm build          # all 3 packages build
pnpm typecheck      # all packages pass
pnpm test           # 70 tests pass (types: 33, provider: 37)

# First-run: generates config file, falls back to mock (no real AWS needed)
node packages/app/dist/cli.js

# With real AWS creds (reads ~/.config/paramhub/config.yaml):
node packages/app/dist/cli.js
```

---

## Phase 5 — Editor Integration & Mutations ✅ COMPLETE

**Status:** Done
**Deliverable verified:** The write loop is closed. `core:edit-value` (`e`) fetches the value,
suspends Ink, hands the terminal to the external editor, shows a colored diff, and saves on confirm.
`core:create-item` (`n`) runs a path→type→editor→confirm flow. `core:delete-item` (`d`) confirms then
deletes. All three are commands, so they also appear in the `Ctrl+P` palette. The editor module is
cross-platform (no hardcoded `/tmp`, no shell, `notepad`/`vi` fallback) and cleans up temp files even
on crash. Typecheck + build clean; all 70 existing tests still pass.

### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| External editor module | ✅ | `$VISUAL` → `$EDITOR` → `vi`/`notepad` fallback; command strings with args split (e.g. `code --wait`) |
| Temp file handling | ✅ | `os.tmpdir()` + `crypto` random name, `0o600` mode; honors `config.editor.command`/`tempDir` |
| Ink suspend/resume | ✅ | `useEditor` hook: `setRawMode(false)` + `stdin.pause()` + leave alt screen → `spawnSync` → re-enter + resume, in try/finally |
| Diff display | ✅ | `diff` package `diffLines` → colored `+`/`-` lines in the confirm modal |
| `core:edit-value` (`e`) | ✅ | Full flow: cached `getValue` → editor → "No changes" short-circuit → diff confirm → `updateValue` → cache update + list refresh |
| `core:create-item` (`n`) | ✅ | `CreateItemModal`: path input → type pick (from `supportedItemTypes`) → editor → confirm → `createItem` |
| `core:delete-item` (`d`) | ✅ | Confirm dialog → `deleteItem` → cache invalidate → back to list + refresh |
| Secure temp cleanup | ✅ | Module-level live-file set + single `process.on('exit')` unlink handler (covers SIGINT/SIGTERM via cli.ts `process.exit`); plus `finally` rm per edit |
| Cross-platform | ✅ | `process.platform` fallback, `spawnSync` without `shell`, `os.tmpdir()`, mode no-op on Windows |

### Files created

```
packages/app/src/
├── editor/
│   └── external.ts                 # resolveEditor, editValueInEditor, temp-file + crash cleanup
├── hooks/
│   └── use-editor.ts               # Ink suspend/resume wrapper + EditorContext/EditorProvider
├── utils/
│   └── terminal.ts                 # shared alt-screen escape sequences + helpers
└── components/modals/
    ├── ConfirmDialog.tsx           # generic y/n confirm; renders body + diff lines
    └── CreateItemModal.tsx         # path → type → editor → confirm form
```

### Files modified

```
packages/app/src/
├── app.tsx                         # useEditor wiring, runEditor into commands, EditorProvider, confirm/create modal cases
├── cli.ts                          # use shared terminal util (removed local alt-screen fns)
├── commands/core-commands.ts       # runEditor option + edit/create/delete commands + buildDiffLines
├── state/reducer.ts                # 'create-item' ModalType, DiffLine/ConfirmModalData, REFRESH_LIST action
├── state/index.ts                  # export DiffLine, ConfirmModalData
└── utils/cache.ts                  # TTLCache.delete(key) for single-entry invalidation
packages/app/package.json           # added diff + @types/diff
```

### Key design decisions

- **`spawnSync` (blocking), no shell** — the simplest correct model for a modal editor handoff and
  avoids POSIX-shell vs `cmd.exe` quoting/injection differences. Node's event loop is blocked during
  the edit, so React cannot re-render mid-edit; every `runEditor` caller dispatches afterwards, which
  triggers Ink's repaint on the re-entered alt screen.
- **Trailing-newline normalization** — editors (notably `vi`) append a trailing newline. A single
  trailing `\n`/`\r\n` is stripped from the edited result so saving an unchanged value isn't reported
  as a change.
- **Editor via context** — `useEditor` is created once in `AppInner` (config-aware) and exposed two
  ways: `runEditor` is injected into `createCoreCommands` for `edit-value`, and `EditorProvider`
  exposes the same instance to `CreateItemModal` (which drives its own editor step), so config editor
  settings apply uniformly. Commands still receive only `CommandContext`; the editor + provider are
  closed over at registration (same injection pattern as the copy commands).
- **Generic confirm modal** — edit (with a diff) and delete (with a path body) share one
  `ConfirmDialog`, carrying `{ title, body?, lines?, confirmLabel?, onConfirm }` in `modal.data`. The
  `onConfirm` callback owns the mutation + cache busting + status, mirroring `ListPicker`'s
  close-then-act pattern.
- **List refresh after mutation** — `REFRESH_LIST` bumps `searchEpoch` (which `useSearch` already
  watches) and drops `nextToken`; callers first `clearSearchCache()` so the reload hits the provider
  rather than stale cache (same invariant as profile/region switching).
- **Crash-safe temp cleanup** — live temp paths tracked in a module set; one `process.on('exit')`
  handler unlinks leftovers. cli.ts's SIGINT/SIGTERM handlers call `process.exit`, which fires
  `exit`, so signal-triggered exits are covered without duplicating logic.

### Verification commands

```sh
pnpm install        # adds diff + @types/diff
pnpm typecheck      # all packages pass
pnpm build          # all 3 packages build (app bundle ~73KB)
pnpm test           # 70 tests pass (types: 33, provider: 37)

# Editor module verified in isolation (esbuild transpile + fake non-interactive editor):
#   - resolveEditor: args splitting, config override, vi/notepad fallback
#   - editValueInEditor: change detection, trailing-newline strip, 0 leftover temp files

# Manual, mock provider (no AWS):
node packages/app/dist/cli.js
#   detail view → e (edit) / d (delete);  list/detail → n (create)
#   EDITOR=vi or EDITOR="code --wait" to exercise fallbacks
```

---

## Phase 6 — Bookmarks

**Status:** Skipped for now (per direction) — Phase 7 was implemented first.

---

## Phase 7 — Themes & Keybinding Customization ✅ COMPLETE

**Status:** Done (plus extras: settings reload, first-run setup wizard)
**Deliverable verified:** Four built-in themes selectable via `config.theme` with semantic tokens
consumed by every component through a `ThemeProvider` (`dark` encodes the pre-theming palette, so
the default look is pixel-identical). Keybinding overrides live on the command registry, so they
survive tab switches and config reloads. `?` opens an auto-generated help overlay listing every
registered command with its *current* hotkey. `core:reload-config` re-reads the config file and
applies theme/keybindings/editor settings live. A first-run setup wizard (theme with live preview →
provider → editor → confirm) writes a fully commented config and hot-loads the chosen provider.
All 47 app tests + 70 existing tests pass.

### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| Theme type definition (semantic tokens) | ✅ | `Theme`: accent, border, muted, success, error, warning, secure, inputText, hotkey, diffAdded, diffRemoved |
| Built-in themes | ✅ | `dark` (original ANSI palette — zero visual diff), `light`, `dracula`, `nord` (hex) |
| Theme context | ✅ | `ThemeProvider` + `useTheme()` (EditorProvider pattern); `setThemeName` enables live switching |
| All components read from theme | ✅ | ~30 hardcoded color sites across 13 files migrated; `dimColor` kept (terminal-native) |
| Theme in config | ✅ | `config.theme` finally consumed; unknown names fall back to `dark` |
| Keybinding config | ✅ | Overrides stored **on the registry** (`setOverrides`); `register()` consults them — fixes loss on tab switch |
| `core:show-help` (`?`) | ✅ | `HelpOverlay` — commands grouped by category, current hotkey right-aligned, scrollable viewport |
| `core:reload-config` (extra) | ✅ | Re-reads config; applies theme + keybindings + editor; warns "restart required" if providers changed |
| `core:setup-wizard` (extra) | ✅ | First-run wizard, re-runnable from the palette |

### Files created

```
packages/app/src/
├── theme/
│   ├── types.ts                 # Theme token interface
│   ├── themes.ts                # dark/light/dracula/nord + resolveTheme/getThemeNames
│   ├── context.tsx              # ThemeProvider + useTheme
│   └── index.ts
├── components/
│   ├── common/SelectList.tsx    # presentational single-select list (extracted from ListPicker)
│   └── modals/
│       ├── HelpOverlay.tsx      # ? — grouped command/keybinding reference
│       └── SetupWizard.tsx      # theme (live preview) → provider → editor → confirm
├── config/template.ts           # renderConfigTemplate() — commented YAML with substitutions
└── utils/keys.ts                # isEnterKey() — treats LF ('\n') as Enter
```

### Files modified

```
packages/app/src/
├── commands/registry.ts         # overrides map; register() applies; setOverrides(); clear() keeps them
├── commands/keybinding-loader.ts# delegates to setOverrides; returns warnings (unknown ids, dup hotkeys)
├── commands/core-commands.ts    # core:show-help/reload-config/setup-wizard; DiffLine kind ('added'|'removed')
├── config/loader.ts             # loadConfig(path?) → { config, firstRun, configPath }; writeConfigFile(); no ENOENT auto-write
├── state/reducer.ts             # ModalType += 'help' | 'setup-wizard'; DiffLine.color → kind
├── app.tsx                      # ThemeProvider; config & providers as state; reloadConfig/applySetup; firstRun → wizard
└── (13 components)              # color literals → theme tokens; isEnterKey in all Enter handlers
```

### Key design decisions

- **`dark` = exact old palette** — theming was a zero-visual-diff refactor by construction (verified
  with snapshot-tui before/after)
- **Overrides live on the registry** — `register()` resolves `overrides.get(id) ?? command.hotkey`, so
  provider commands registered later (tab switch) always get user keybindings; `clear()` (React
  effect cleanup) intentionally keeps overrides
- **`DiffLine.kind`** — diff data carries semantics (`'added'|'removed'`), not Ink colors; the
  confirm dialog maps kind → `theme.diffAdded/diffRemoved` at render
- **Config + provider list are React state** in `AppInner` — the registration/init effects already
  depend on them, so reload/hot-swap re-wires commands, editor, and provider map for free
- **Wizard hot-load** — completion writes the config, then runs a fresh `ProviderManager.loadAll`;
  AWS load failures fall back to the mock with a status message (never crashes first-run);
  `reload-config` deliberately does NOT hot-load (restart-required status) to keep reload simple
- **Enter-as-LF (`isEnterKey`)** — some pty/terminal setups deliver Enter as `'\n'`, which Ink
  reports with `key.return === false`; all Enter handlers (+ `normalizeKey`) treat `'\n'` as return
- **Multi-char input accepted** — SearchInput/CreateItemModal/SetupWizard append whole `input`
  strings (paste and batched delivery), not just single chars

---

## Phase 8 — Polish & Release Prep (partial) ✅ CLI + INTEGRATION TESTS

**Status:** CLI flags, `show-config`, `--default-config`, and integration tests done.
README + npm publish deliberately not done (per direction).

### What was implemented

| Task | Status | Notes |
|------|--------|-------|
| CLI args parser | ✅ | `src/cli-args.ts` — hand-rolled (tiny surface), discriminated-union result |
| `-h` / `--help` | ✅ | Usage text; exits before alt-screen |
| `-v` / `--version` | ✅ | Reads package.json via `createRequire` (works from dist) |
| `--default-config` | ✅ | Prints the commented template (`renderConfigTemplate()`) to stdout |
| `show-config` subcommand | ✅ | Effective (parsed + defaults) config as greppable YAML + `# config file: <path>` header |
| `--config <path>` | ✅ | Config-file override for run/show-config modes |
| Integration tests (Ink) | ✅ | `ink-testing-library` — boot, search, detail (CR + LF Enter), palette, help overlay, keybinding overrides, full wizard walkthroughs |
| Subprocess CLI tests | ✅ | Spawn `dist/cli.js` — version/help/default-config/show-config (XDG + `--config`), unknown-flag exit 1 |
| README + GIF, provider dev guide, npm publish | ❌ | Out of scope this phase |

### Files created

```
packages/app/
├── src/cli-args.ts              # parseCliArgs + USAGE
├── vitest.config.ts
└── tests/
    ├── cli-args.test.ts         # parser table tests
    ├── registry-overrides.test.ts # override survives tab switch/clear
    ├── template.test.ts         # template renders → parses → validates
    ├── theme.test.ts            # all tokens present; resolveTheme fallback
    ├── app-flows.test.tsx       # TUI flows via ink-testing-library + mock provider
    ├── wizard.test.tsx          # first-run trigger, walkthroughs, cancel, palette re-run
    └── cli-subprocess.test.ts   # spawned dist/cli.js flag tests (no TTY needed)
```

### Files modified

```
packages/app/src/cli.ts          # argv dispatch before enterAltScreen; threads configPath/firstRun
packages/app/package.json        # vitest + ink-testing-library, test script
turbo.json                       # test dependsOn ["build"] (subprocess tests need own dist)
```

### Testing notes

- **No fake timers with Ink** — async settling via `vi.waitFor(lastFrame())` polling; a `press()`
  helper paces stdin writes (~80ms) because consecutive writes race focus/state transitions
- **Registry/caches are module singletons** — reset in `beforeEach` (`clear()` + `setOverrides({})` +
  `clearSearchCache()`), every render unmounted in `afterEach`
- **snapshot-tui limitation discovered**: in sandboxed sessions the expect pty buffers all `--key`
  bytes into one merged chunk delivered at script end (with `\r`→`\n`); static frames are reliable,
  multi-key flows are not — documented in the skill, use ink-testing-library for flows

### Verification commands

```sh
pnpm build && pnpm typecheck && pnpm test   # 117 tests: types 33, provider 37, app 47

node packages/app/dist/cli.js --version
node packages/app/dist/cli.js --help
node packages/app/dist/cli.js --default-config
node packages/app/dist/cli.js show-config           # greppable effective config
node packages/app/dist/cli.js show-config --config /path/to/config.yaml

# First-run wizard (fresh config dir):
XDG_CONFIG_HOME=$(mktemp -d) node packages/app/dist/cli.js

# In the TUI: ? = help overlay; Ctrl+P → "Reload Config" / "Run Setup Wizard"
```
