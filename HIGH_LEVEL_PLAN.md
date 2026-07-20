# High-Level Architecture & Development Plan

## Project Name Placeholder: `paramhub`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        @paramhub/app                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     TUI Shell (Ink)                   │  │
│  │  ┌─────────┬──────────┬───────────┬───────────────┐   │  │
│  │  │ Top Bar │ Provider │ Provider  │  Provider ... │   │  │
│  │  │ (tabs)  │  Tab 1   │  Tab 2    │               │   │  │
│  │  ├─────────┴──────────┴───────────┴───────────────┤   │  │
│  │  │              Active View                        │   │  │
│  │  │  ┌──────────────────────────────────────────┐   │   │  │
│  │  │  │  Search Bar                              │   │   │  │
│  │  │  ├──────────────────────────────────────────┤   │   │  │
│  │  │  │  Item List (flat, scrollable, filtered)  │   │   │  │
│  │  │  ├──────────────────────────────────────────┤   │   │  │
│  │  │  │  Detail / Preview Panel                  │   │   │  │
│  │  │  └──────────────────────────────────────────┘   │   │  │
│  │  ├─────────────────────────────────────────────────┤   │  │
│  │  │ Status Bar (context, region, account, hotkeys)  │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────────────────┴─────────────────────────────┐  │
│  │              Provider Manager (Plugin Host)            │  │
│  │  discover → load → init → register tabs/actions        │  │
│  └──────┬──────────────────┬──────────────────┬──────────┘  │
│         │                  │                  │              │
│  ┌──────┴──────┐  ┌───────┴───────┐  ┌───────┴──────────┐  │
│  │ @paramhub/  │  │ @paramhub/    │  │ @paramhub/       │  │
│  │ provider-   │  │ provider-     │  │ provider-        │  │
│  │ aws-ssm     │  │ azure-kv      │  │ <third-party>    │  │
│  └──────┬──────┘  └───────┬───────┘  └───────┬──────────┘  │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
   ┌──────┴──────┐  ┌───────┴───────┐  ┌───────┴───────┐
   │  AWS SDK v3 │  │  Azure SDK    │  │  Whatever SDK │
   └─────────────┘  └───────────────┘  └───────────────┘
```

---

## Package Structure (pnpm Monorepo)

```
paramhub/
├── packages/
│   ├── app/                          # Main TUI application
│   │   ├── src/
│   │   │   ├── cli.ts                # Entry point, arg parsing (yargs/commander)
│   │   │   ├── app.tsx               # Root Ink component
│   │   │   ├── config/
│   │   │   │   ├── loader.ts         # XDG-aware config loading
│   │   │   │   ├── schema.ts         # Config validation (zod)
│   │   │   │   └── defaults.ts
│   │   │   ├── providers/
│   │   │   │   ├── manager.ts        # Discovery, loading, lifecycle
│   │   │   │   └── registry.ts       # Active provider registry
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── TopBar.tsx         # Provider tabs + context info
│   │   │   │   │   ├── StatusBar.tsx      # Hotkey hints, connection status
│   │   │   │   │   └── MainLayout.tsx
│   │   │   │   ├── search/
│   │   │   │   │   └── SearchInput.tsx
│   │   │   │   ├── list/
│   │   │   │   │   ├── ItemList.tsx       # Scrollable flat list
│   │   │   │   │   └── ItemRow.tsx
│   │   │   │   ├── detail/
│   │   │   │   │   ├── DetailPanel.tsx    # Universal + provider metadata
│   │   │   │   │   └── ValuePreview.tsx   # Masked/revealed value display
│   │   │   │   ├── bookmarks/
│   │   │   │   │   └── BookmarkManager.tsx
│   │   │   │   ├── modals/
│   │   │   │   │   ├── ConfirmDialog.tsx
│   │   │   │   │   ├── RegionPicker.tsx
│   │   │   │   │   └── AccountPicker.tsx
│   │   │   │   └── shared/
│   │   │   │       ├── Spinner.tsx
│   │   │   │       └── ErrorBoundary.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useProvider.ts
│   │   │   │   ├── useSearch.ts       # Debounced search w/ pagination
│   │   │   │   ├── useBookmarks.ts
│   │   │   │   ├── useKeybindings.ts
│   │   │   │   └── useEditor.ts       # External editor spawn
│   │   │   ├── state/
│   │   │   │   ├── context.tsx        # React context for global state
│   │   │   │   └── reducer.ts
│   │   │   ├── theme/
│   │   │   │   ├── index.ts
│   │   │   │   ├── themes/            # Built-in themes
│   │   │   │   │   ├── dark.ts
│   │   │   │   │   ├── light.ts
│   │   │   │   │   └── dracula.ts
│   │   │   │   └── types.ts
│   │   │   ├── editor/
│   │   │   │   └── external.ts        # $EDITOR/$VISUAL integration
│   │   │   └── utils/
│   │   │       ├── cache.ts           # TTL cache for items
│   │   │       └── clipboard.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── types/                         # @paramhub/types — the provider contract
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── provider.ts            # Provider interface
│   │   │   ├── items.ts               # Item, metadata types
│   │   │   ├── search.ts              # Search types
│   │   │   ├── actions.ts             # Custom action types
│   │   │   ├── tabs.ts               # Custom tab types
│   │   │   └── config.ts              # Provider config types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── provider-aws-ssm/             # @paramhub/provider-aws-ssm
│       ├── src/
│       │   ├── index.ts               # Exports provider factory
│       │   ├── provider.ts            # SSM provider implementation
│       │   ├── auth.ts                # AWS credential chain + profile handling
│       │   ├── mapper.ts              # SSM Parameter → Item mapping
│       │   ├── config.ts              # SSM-specific config schema
│       │   └── actions.ts             # SSM-specific actions (copy ARN, etc.)
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                       # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── turbo.json
```

---

## Provider Interface Contract (`@paramhub/types`)

```typescript
// ── items.ts ──

export type ItemType = 'string' | 'secure' | 'binary' | 'json' | 'list';

export interface UniversalMetadata {
  lastModified?: Date;
  version?: number;
  createdBy?: string;
  size?: number;
  tags?: Record<string, string>;
}

export interface Item {
  id: string;           // unique within provider (e.g., SSM ARN or path)
  path: string;         // full path / key name
  name: string;         // display name (last segment of path)
  type: ItemType;
  value?: string;       // undefined until explicitly loaded
  metadata: UniversalMetadata;
  providerMetadata?: Record<string, unknown>;
}

export interface DetailField {
  label: string;
  value: string;
  sensitive?: boolean;  // render masked by default
  copyable?: boolean;
}

// ── search.ts ──

export interface SearchOptions {
  query: string;
  pathPrefix?: string;
  maxResults?: number;
  nextToken?: string;
}

export interface SearchResult {
  items: Item[];
  nextToken?: string;
}

// ── actions.ts ──

export interface CustomAction {
  id: string;
  label: string;
  hotkey?: string;
  /** action receives the currently selected item */
  execute(item: Item): Promise<ActionResult>;
}

export interface ActionResult {
  message: string;
  refreshList?: boolean;
}

// ── tabs.ts ──

export interface CustomTab {
  id: string;
  label: string;
  /** Ink component to render */
  render: () => React.ReactElement;
}

// ── config.ts ──

export interface ProviderConfigField {
  key: string;
  label: string;
  type: 'string' | 'select' | 'boolean';
  required: boolean;
  default?: string;
  options?: string[];   // for 'select' type
}

// ── provider.ts ──

export interface ProviderContext {
  account?: string;     // AWS account ID, Azure subscription, etc.
  region?: string;
  profile?: string;
  displayLabel: string; // e.g. "123456789012 / us-east-1"
}

export interface AccountInfo {
  id: string;
  label: string;
}

export interface ProviderCapabilities {
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canSearch: boolean;
  canSwitchRegion: boolean;
  canSwitchAccount: boolean;
  supportedItemTypes: ItemType[];
  customActions: CustomAction[];
  customTabs: CustomTab[];
}

export interface Provider {
  readonly id: string;
  readonly displayName: string;
  readonly icon?: string;               // emoji or nerd-font char

  // ── lifecycle ──
  getConfigSchema(): ProviderConfigField[];
  init(config: Record<string, unknown>): Promise<void>;
  testConnection(): Promise<{ ok: boolean; message?: string }>;
  dispose(): Promise<void>;

  // ── capabilities ──
  getCapabilities(): ProviderCapabilities;

  // ── context switching ──
  getCurrentContext(): Promise<ProviderContext>;
  getAvailableRegions?(): Promise<string[]>;
  getAvailableProfiles?(): Promise<string[]>;
  switchRegion?(region: string): Promise<void>;
  switchProfile?(profile: string): Promise<void>;

  // ── data ──
  search(options: SearchOptions): Promise<SearchResult>;
  getItem(id: string): Promise<Item>;
  getValue(id: string): Promise<string>;
  getItemDetails(item: Item): DetailField[];

  // ── mutations ──
  updateValue?(id: string, newValue: string): Promise<void>;
  createItem?(path: string, value: string, type: ItemType): Promise<Item>;
  deleteItem?(id: string): Promise<void>;
}

// ── factory ──

export interface ProviderFactory {
  create(): Provider;
}
```

---

## Provider Discovery & Loading

```typescript
// packages/app/src/providers/manager.ts

/**
 * Config shape:
 * 
 * providers:
 *   - package: "@paramhub/provider-aws-ssm"
 *     enabled: true
 *     config:
 *       defaultRegion: "us-east-1"
 *       defaultProfile: "default"
 *   - package: "@paramhub/provider-azure-kv"
 *     enabled: true
 *     config:
 *       subscription: "xxx"
 */

interface ProviderEntry {
  package: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

class ProviderManager {
  private providers: Map<string, Provider> = new Map();

  async loadAll(entries: ProviderEntry[]): Promise<void> {
    for (const entry of entries.filter(e => e.enabled)) {
      try {
        // Dynamic import of the npm package
        const mod = await import(entry.package);
        const factory: ProviderFactory = mod.default ?? mod;
        const provider = factory.create();
        await provider.init(entry.config);
        const conn = await provider.testConnection();
        if (conn.ok) {
          this.providers.set(provider.id, provider);
        }
        // Surface connection failures in UI, don't crash
      } catch (err) {
        // Log: failed to load provider entry.package
      }
    }
  }

  getAll(): Provider[] { /* ... */ }
  getById(id: string): Provider | undefined { /* ... */ }
  async disposeAll(): Promise<void> { /* ... */ }
}
```

---

## Application State

```typescript
// packages/app/src/state/reducer.ts

interface AppState {
  // Provider
  activeProviderId: string | null;
  providerContexts: Map<string, ProviderContext>;

  // View
  view: 'list' | 'detail' | 'bookmarks' | 'provider-tab';
  activeCustomTabId?: string;

  // Search & List
  searchQuery: string;
  items: Item[];
  selectedIndex: number;
  isLoading: boolean;
  nextToken?: string;      // pagination cursor

  // Detail
  selectedItem: Item | null;
  revealedValue: boolean;

  // Bookmarks
  bookmarks: Bookmark[];

  // UI
  modal: ModalState | null; // region picker, account picker, confirm, etc.
  theme: ThemeName;
  error: string | null;
}

type Action =
  | { type: 'SET_PROVIDER'; providerId: string }
  | { type: 'SEARCH_START'; query: string }
  | { type: 'SEARCH_SUCCESS'; result: SearchResult; append: boolean }
  | { type: 'SEARCH_ERROR'; error: string }
  | { type: 'SELECT_ITEM'; index: number }
  | { type: 'LOAD_VALUE_SUCCESS'; value: string }
  | { type: 'TOGGLE_REVEAL' }
  | { type: 'SET_VIEW'; view: AppState['view'] }
  | { type: 'OPEN_MODAL'; modal: ModalState }
  | { type: 'CLOSE_MODAL' }
  | { type: 'ADD_BOOKMARK'; bookmark: Bookmark }
  | { type: 'REMOVE_BOOKMARK'; id: string }
  | { type: 'SET_CONTEXT'; context: ProviderContext }
  | { type: 'SET_THEME'; theme: ThemeName }
  // ...
```

---

## Key User Flows

```
┌─ LAUNCH ─────────────────────────────────────────────────┐
│ 1. Parse CLI args (--profile, --region, --config)        │
│ 2. Load config from XDG path                             │
│ 3. Load & init providers                                 │
│ 4. Render TUI, activate first provider                   │
│ 5. Auto-search (list all / load initial page)            │
└──────────────────────────────────────────────────────────┘

┌─ SEARCH ─────────────────────────────────────────────────┐
│ 1. User types in search bar                              │
│ 2. Debounce 300ms                                        │
│ 3. Call provider.search({ query })                       │
│ 4. Render results in flat list                           │
│ 5. Arrow keys navigate, Enter opens detail               │
│ 6. Reaching list bottom → load next page (nextToken)     │
└──────────────────────────────────────────────────────────┘

┌─ EDIT VALUE ─────────────────────────────────────────────┐
│ 1. User presses 'e' on selected item                     │
│ 2. provider.getValue(id) → fetch current value           │
│ 3. Write to temp file (/tmp/paramhub-XXXXX)              │
│ 4. Spawn $EDITOR with temp file                          │
│ 5. Ink unmounts, terminal handed to editor                │
│ 6. On editor exit: read temp file                        │
│ 7. Diff old vs new, show confirm dialog                  │
│ 8. provider.updateValue(id, newValue)                    │
│ 9. Delete temp file, re-render TUI                       │
└──────────────────────────────────────────────────────────┘

┌─ SWITCH REGION ──────────────────────────────────────────┐
│ 1. User presses hotkey (e.g., Ctrl+R)                    │
│ 2. Open RegionPicker modal                               │
│ 3. provider.getAvailableRegions() → list                 │
│ 4. User selects → provider.switchRegion(region)          │
│ 5. Clear list, re-search, update status bar              │
└──────────────────────────────────────────────────────────┘
```

---

## Keybinding Defaults

```
Global:
  Tab / Shift+Tab     Switch provider tab
  Ctrl+R              Switch region
  Ctrl+P              Command palette (switch profile, other actions with fuzzy search)
  Ctrl+B              Toggle bookmarks view
  Ctrl+S              Save current search as bookmark
  Ctrl+Q / q          Quit
  ?                   Show help overlay

List View:
  /                   Focus search input
  ↑ / ↓  (k / j)     Navigate list
  Enter               Open detail panel
  Esc                 Clear search / back to list
  Page Up/Down        Scroll page

Detail View:
  e                   Edit value in $EDITOR
  r                   Reveal / mask value toggle
  c                   Copy value to clipboard
  y                   Copy path to clipboard
  d                   Delete (with confirmation)
  n                   Create new item
  Esc                 Back to list
```

Stored in config and overridable:

```yaml
# ~/.config/paramhub/config.yaml
keybindings:
  switchRegion: "ctrl+r"
  commandPalette: "ctrl+p"
  toggleBookmarks: "ctrl+b"
  editValue: "e"
  revealValue: "r"
  # ...
```

---

## Config File Structure

```yaml
# ~/.config/paramhub/config.yaml

theme: "dark"                   # dark | light | dracula | nord

defaultProvider: "aws-ssm"

providers:
  - package: "@paramhub/provider-aws-ssm"
    enabled: true
    config:
      defaultRegion: "us-east-1"
      defaultProfile: "default"
      # provider-specific options
      decryptSecureStrings: true

keybindings:
  # overrides only, defaults apply for unset keys
  switchRegion: "ctrl+r"

cache:
  enabled: true
  ttlSeconds: 30

editor:
  command: ""                   # empty = use $EDITOR / $VISUAL
  tempDir: ""                   # empty = OS default temp

bookmarks:
  # managed by the app, but stored here
  - label: "prod db passwords"
    provider: "aws-ssm"
    query: "/prod/db/"
    region: "us-east-1"
    profile: "prod"
  - label: "staging api keys"
    provider: "aws-ssm"
    query: "/staging/api/"
```

You're right — here's the updated plan with the command system as a foundational piece woven in from the start.

---

## Development Plan

### Phase 0 — Project Scaffolding (Days 1–2)

| Task | Detail |
|------|--------|
| Init monorepo | pnpm workspaces, `turbo.json` |
| TypeScript config | `tsconfig.base.json`, per-package configs |
| Linting & formatting | ESLint flat config + Prettier |
| Build setup | `tsup` for each package |
| Dev workflow | `turbo dev` — watch mode across packages |
| Git setup | `.gitignore`, conventional commits, changesets |

**Deliverable:** `pnpm dev` runs, `pnpm build` produces all packages, empty Ink app renders "Hello".

---

### Phase 1 — Provider Contract + Command System Types (Days 3–5)

| Task | Detail |
|------|--------|
| Define `@paramhub/types` | Provider interface, Item, SearchResult, metadata types |
| Define command types | `Command`, `CommandContext`, `ProviderCommand` interfaces |
| Provider includes `getCommands()` | Part of the provider contract from day one |
| Build mock provider | In-memory provider with fake items + 2-3 example custom commands |
| Provider conformance test suite | Shared vitest suite any provider can run against itself |

**Deliverable:** `@paramhub/types` complete. Mock provider passes conformance tests including command registration.

---

### Phase 2 — Core TUI Shell + Command Infrastructure (Days 6–16)

#### 2a — Command Registry & Keybinding Engine (Days 6–8)

| Task | Detail |
|------|--------|
| `CommandRegistry` class | Register, unregister, search (fuse.js), resolve by hotkey |
| Core commands defined | All built-in actions declared as commands (navigate, edit, quit, etc.) |
| `useGlobalKeybindings` hook | Ink `useInput` → normalize key → find command → execute |
| Keybinding override loader | Read config, remap hotkeys on command objects at boot |
| `CommandContext` builder | Derives context from current app state for `isEnabled`/`isVisible` checks |

#### 2b — Layout, Navigation & Command Palette (Days 9–12)

| Task | Detail |
|------|--------|
| `MainLayout.tsx` | Top bar, content area, status bar |
| `TopBar.tsx` | Provider tabs |
| `StatusBar.tsx` | Context info + most common hotkey hints (auto-derived from registry) |
| `CommandPalette.tsx` | Modal overlay, fuzzy search input, scrollable results showing label + hotkey |
| Modal system | Generic modal layer (palette, confirmations, pickers share same mechanism) |
| Focus management | Which component owns keyboard input, palette captures all input when open |
| State management | React context + `useReducer` |

#### 2c — Search & List (Days 13–14)

| Task | Detail |
|------|--------|
| `SearchInput.tsx` | Text input, triggered via `core:focus-search` command |
| `useSearch` hook | Debounced, calls `provider.search()`, pagination |
| `ItemList.tsx` | Scrollable flat list, type indicators, selection |
| Pagination | Scroll-to-bottom triggers next page load |
| Cache layer | Simple TTL Map wrapping provider calls |

#### 2d — Detail Panel (Days 15–16)

| Task | Detail |
|------|--------|
| `DetailPanel.tsx` | Universal + provider-specific metadata fields via `provider.getItemDetails()` |
| `ValuePreview.tsx` | Masked by default for `secure` type, revealed via `core:reveal-value` command |
| Lazy value loading | `provider.getValue()` called only on detail open |
| Copy actions | `core:copy-value` and `core:copy-path` commands with clipboard |

**Deliverable:** Fully navigable TUI with mock provider. Command palette works (`Ctrl+P`), all navigation and item actions are commands discoverable through it. Search, scroll, view details, copy values.

---

### Phase 3 — AWS SSM Provider (Days 17–23)

| Task | Detail |
|------|--------|
| Package setup | `@paramhub/provider-aws-ssm` |
| `search()` | `GetParametersByPath` + `DescribeParameters`, pagination |
| `getValue()` | `GetParameter` with decryption |
| `getItemDetails()` | ARN, tier, data type, policies as detail fields |
| `updateValue()` | `PutParameter` with overwrite |
| `createItem()` / `deleteItem()` | Standard mutations |
| Region & profile switching | Re-instantiate client |
| `getCommands()` | Provider-specific commands: copy ARN, add tag, etc. |
| Conformance tests | Mocked AWS SDK |

**Deliverable:** Working SSM browsing. Provider commands appear in command palette alongside core commands.

---

### Phase 4 — Provider Discovery & Dynamic Loading (Days 24–27)

| Task | Detail |
|------|--------|
| Config loader | YAML from XDG path, zod validation |
| `ProviderManager` | Dynamic `import()` of configured packages, lifecycle management |
| On provider load | Call `provider.getCommands()`, register with prefix in registry |
| On provider unload/switch | Unregister commands by provider prefix |
| Provider tabs in top bar | Dynamic from loaded providers |
| Tab switching | State per-provider preserved, commands swap when switching tabs |
| Custom tabs | Provider `customTabs` rendered as additional tab entries |
| First-run config generation | Default config with SSM if none exists |

**Deliverable:** Multiple providers load dynamically. Each contributes its own commands to the palette. Switching providers updates available commands.

---

### Phase 5 — Editor Integration & Mutations (Days 28–32)

| Task | Detail |
|------|--------|
| External editor module | `$EDITOR` → `$VISUAL` → `vi` fallback |
| Temp file handling | Unique file, `0600` permissions, cleanup in `finally` |
| Ink suspend/resume | Hand terminal to editor, reclaim on exit |
| Diff display | Show old vs new inline after editor closes |
| `core:edit-value` command wired | Full flow: fetch → temp file → editor → diff → confirm → save |
| `core:create-item` command | Modal for path → editor for value → type pick → confirm |
| `core:delete-item` command | Confirmation modal → delete |
| Secure temp cleanup | Always delete, even on crash (signal handlers) |

**Deliverable:** Full edit cycle through commands. Press `e` or find "Edit Value" in palette — same flow.

---

### Phase 6 — Bookmarks (Days 33–36)

| Task | Detail |
|------|--------|
| Bookmark data model | `{ id, label, provider, query, region?, profile?, createdAt }` |
| Persistence | Read/write to config YAML |
| `core:save-bookmark` command | Modal: enter label → save current query + context |
| `core:toggle-bookmarks` command | Switch to bookmarks view |
| `core:activate-bookmark` command | Visible only in bookmarks view, Enter to execute |
| `core:delete-bookmark` command | Visible only in bookmarks view, with confirmation |
| Bookmark indicator | ★ in status bar when current search matches a bookmark |

**Deliverable:** Bookmarks fully functional, all actions are commands in the palette.

---

### Phase 7 — Themes & Keybinding Customization (Days 37–40)

| Task | Detail |
|------|--------|
| Theme type definition | Semantic color tokens |
| Built-in themes | `dark`, `light`, `dracula`, `nord` |
| Theme context | All components read from theme |
| Theme in config | `theme: "dracula"` |
| Keybinding config | Map of `commandId → hotkey`, applied at boot via override loader |
| `core:show-help` command | Auto-generated overlay from registry — lists all commands with current hotkeys grouped by category |

**Deliverable:** Themes work. Keybindings customizable. Help overlay is a live reference generated from command registry.

---

### Phase 8 — Polish & Release Prep (Days 41–47)

| Task | Detail |
|------|--------|
| Error handling sweep | Every provider call wrapped, friendly messages |
| Loading states | Spinners for search, value load, connection test |
| Empty states | "No results", "No providers configured", "Press / to search" |
| Responsive layout | Narrow terminal handling |
| CLI flags | `--profile`, `--region`, `--config`, `--provider`, `--version`, `--help` |
| README + GIF demo | Install, usage, architecture overview |
| Provider dev guide | How to create a `@paramhub/provider-*` package |
| npm publish setup | changesets, scoped packages, CI |
| Integration tests | Launch with mock provider, exercise full flows |

**Deliverable:** Publishable to npm. `npx @paramhub/app` works.

---

## Architectural Invariant

> **Every user-facing action is a command.** Nothing bypasses the registry. If it can't be found in `Ctrl+P`, it doesn't exist.

This means:
- Adding a new feature = registering a new command
- Provider extensibility = provider returns commands
- Keybinding customization = remapping command IDs to different hotkeys
- Help/docs = auto-generated from registry metadata
- Status bar hints = top N commands by category with their current hotkeys

---

## Dependency Summary

```
@paramhub/app
├── ink
├── ink-text-input
├── react
├── fuse.js              # fuzzy search for command palette
├── cosmiconfig
├── zod
├── yaml
├── clipboardy
├── diff
├── @paramhub/types

@paramhub/types
├── (zero runtime deps)

@paramhub/provider-aws-ssm
├── @paramhub/types
├── @aws-sdk/client-ssm
├── @aws-sdk/credential-providers
├── @smithy/shared-ini-file-loader
```

---

## Phase Progress View

```
Phase 0  ██░░░░░░░░░░░░░░  Scaffolding
Phase 1  ████░░░░░░░░░░░░  Contract + Command Types + Mock
Phase 2  █████████░░░░░░░  TUI Shell + Command Palette + Search/Detail
Phase 3  █████████████░░░  AWS SSM Provider
Phase 4  ██████████████░░  Plugin Loading (commands register/unregister)
Phase 5  ███████████████░  Editor + Mutations (as commands)
Phase 6  ████████████████  Bookmarks (as commands)
Phase 7  ████████████████  Themes + Keybinding customization
Phase 8  ████████████████  Polish + Ship
```

---
