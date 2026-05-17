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

## Phase 1 — Provider Contract + Command System Types

**Status:** Not started

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
