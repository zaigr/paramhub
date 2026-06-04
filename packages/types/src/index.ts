/**
 * @paramhub/types
 *
 * Shared type definitions and provider contract for paramhub.
 * This package has zero runtime dependencies.
 */

// ── Item types ──
export type { ItemType, UniversalMetadata, Item, DetailField } from './items.js';

// ── Search types ──
export type { SearchOptions, SearchResult } from './search.js';

// ── Action types ──
export type { CustomAction, ActionResult } from './actions.js';

// ── Tab types ──
export type { CustomTab } from './tabs.js';

// ── Config types ──
export type { ProviderConfigField } from './config.js';

// ── Command types ──
export type {
  CommandContext,
  CommandCategory,
  Command,
  ProviderCommand,
} from './commands.js';

// ── Provider types ──
export type {
  ProviderContext,
  AccountInfo,
  ProviderCapabilities,
  ConnectionTestResult,
  Provider,
  ProviderFactory,
} from './provider.js';
