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

### Files created/modified

```
packages/types/
├── src/
│   ├── index.ts              # Barrel re-exports all type modules
│   ├── items.ts              # Item, ItemType, UniversalMetadata, DetailField
│   ├── search.ts             # SearchOptions, SearchResult
│   ├── actions.ts            # CustomAction, ActionResult
│   ├── tabs.ts               # CustomTab (framework-agnostic render)
│   ├── config.ts             # ProviderConfigField
│   ├── commands.ts           # Command, CommandContext, CommandCategory, ProviderCommand
│   ├── provider.ts           # Provider, ProviderFactory, ProviderContext, ProviderCapabilities
│   └── testing/
│       ├── index.ts          # Testing barrel export
│       ├── mock-provider.ts  # MockProvider + MockProviderFactory
│       └── conformance.ts    # runProviderConformanceTests() shared suite
├── tests/
│   └── mock-provider.test.ts # Runs conformance + mock-specific tests
├── package.json              # Added vitest, "./testing" export path, test script
├── tsup.config.ts            # Added testing entry point
└── vitest.config.ts          # Vitest configuration

turbo.json                    # Added "test" task
package.json (root)           # Added "test" script
```

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
