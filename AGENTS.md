# AGENTS.md

Instructions for AI agents working on this codebase.

---

## Project Overview

**paramhub** is a terminal UI (TUI) application for browsing, searching, and editing cloud parameter stores (AWS SSM, Azure Key Vault, etc.). Built with Ink (React for terminals) in a pnpm monorepo.

---

## Monorepo Structure

```
paramhub/
├── packages/
│   ├── types/               # @paramhub/types — shared interfaces & provider contract
│   ├── app/                 # @paramhub/app — main TUI application (Ink/React)
│   └── provider-aws-ssm/   # @paramhub/provider-aws-ssm — AWS SSM provider
├── package.json             # Root workspace (private, scripts delegate to turbo)
├── pnpm-workspace.yaml      # Declares packages/* as workspace members
├── turbo.json               # Turbo pipeline (build, dev, lint, typecheck)
├── tsconfig.base.json       # Shared TypeScript compiler options
├── eslint.config.mjs        # ESLint flat config (typescript-eslint)
├── .prettierrc              # Prettier formatting rules
├── HIGH_LEVEL_PLAN.md       # Architecture & phased development plan
└── IMPLEMENTATION.md        # Phase completion tracking
```

### Package dependency graph

```
@paramhub/app ──────────────► @paramhub/types
@paramhub/provider-aws-ssm ─► @paramhub/types
```

`@paramhub/types` has zero runtime dependencies and must be built first.

---

## Commands

All commands are run from the **repository root**.

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies across the workspace |
| `pnpm build` | Build all packages (topological order via Turbo) |
| `pnpm dev` | Start watch mode for all packages (persistent) |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm format` | Format all files with Prettier (write mode) |
| `pnpm format:check` | Check formatting without modifying files |
| `pnpm typecheck` | Run `tsc --noEmit` in all packages |

### Running a single package

```sh
pnpm --filter @paramhub/app build
pnpm --filter @paramhub/types dev
pnpm --filter @paramhub/provider-aws-ssm typecheck
```

### Running the app

```sh
node packages/app/dist/cli.js
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.x (strict mode, ES2022 target) |
| Module system | ESM-only (`"type": "module"` in all packages) |
| Package manager | pnpm 9.x with workspaces |
| Monorepo orchestrator | Turborepo 2.x |
| Bundler | tsup (esbuild-based, produces ESM + .d.ts + sourcemaps) |
| TUI framework | Ink 5 (React 18 for the terminal) |
| Linting | ESLint 9 flat config with `typescript-eslint` |
| Formatting | Prettier 3.x |
| Node requirement | >= 20.0.0 |

---

## TypeScript Configuration

- Base config is in `tsconfig.base.json` (strict, ESNext module, bundler resolution)
- Each package extends it with its own `tsconfig.json` setting `outDir` and `rootDir`
- JSX is set to `react-jsx` (no need for `import React` in .tsx files)
- All packages output declarations (`declaration: true`) and declaration maps

---

## Coding Conventions

- **ESM imports** — always use `.js` extension in relative imports (TypeScript resolves .ts/.tsx to .js in output)
- **Single quotes**, **semicolons**, **trailing commas** (enforced by Prettier)
- **Unused variables** prefixed with `_` (ESLint rule)
- **No `any`** — prefer `unknown` with type narrowing (ESLint warns on explicit `any`)
- **Functional React components** — use default exports for page-level components
- **Named exports** for utilities, types, and hooks

---

## Adding a New Package

1. Create directory under `packages/<name>/`
2. Add `package.json` with:
   - `"name": "@paramhub/<name>"`
   - `"type": "module"`
   - `"exports"` field pointing to `./dist/index.js` and `./dist/index.d.ts`
   - Scripts: `build`, `dev`, `typecheck`
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `tsup.config.ts` with ESM format + dts
5. Add `src/index.ts` as the entry point
6. Run `pnpm install` to link workspace dependencies

---

## Architecture Principles

1. **Every user-facing action is a command** — nothing bypasses the command registry
2. **Provider plugin system** — providers implement a contract defined in `@paramhub/types`
3. **Providers are npm packages** — loaded dynamically via config, not hardcoded
4. **State management** — React context + `useReducer` in the app package
5. **No runtime deps in types** — `@paramhub/types` is interfaces only

---

## Development Phases

See `HIGH_LEVEL_PLAN.md` for the full architecture and `IMPLEMENTATION.md` for current progress. The phases are:

0. ~~Project Scaffolding~~ (done)
1. Provider Contract + Command System Types
2. Core TUI Shell + Command Infrastructure
3. AWS SSM Provider
4. Provider Discovery & Dynamic Loading
5. Editor Integration & Mutations
6. Bookmarks
7. Themes & Keybinding Customization
8. Polish & Release Prep

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails with "Cannot find module" | Run `pnpm build` from root (types must build before dependents) |
| Type errors after changing types package | Rebuild types first: `pnpm --filter @paramhub/types build` |
| Stale turbo cache | Delete `.turbo/` directories or run with `--force` |
| pnpm install issues | Delete `node_modules` in all packages and root, re-run `pnpm install` |
