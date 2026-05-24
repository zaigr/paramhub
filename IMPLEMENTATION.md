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

**Status:** Phase 2a & 2b complete

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

### Phase 2d — Detail Panel

**Status:** Not started

---

## Phase 3 — AWS SSM Provider

**Status:** Not started

---

## Phase 4 — Provider Discovery & Dynamic Loading

**Status:** Not started

---

## Phase 5 — Editor Integration & Mutations

**Status:** Not started

---

## Phase 6 — Bookmarks

**Status:** Not started

---

## Phase 7 — Themes & Keybinding Customization

**Status:** Not started

---

## Phase 8 — Polish & Release Prep

**Status:** Not started
