/**
 * @paramhub/types
 *
 * Shared type definitions and provider contract for paramhub.
 * This package has zero runtime dependencies.
 *
 * Almost everything here is type-only; `./path.js` is the sole runtime export,
 * shared by providers so path-splitting behaviour cannot drift between them.
 */

// ── Item types ──
export type { ItemType, UniversalMetadata, Item, DetailField } from './items.js';

// ── Search types ──
export type { SearchOptions, SearchResult } from './search.js';

// ── Tree types ──
export type {
  BranchNode,
  LeafNode,
  TreeNode,
  HierarchyInfo,
  BrowseOptions,
  BrowseResult,
} from './tree.js';

// ── Path helpers ──
export { lastSegment, DEFAULT_DELIMITER } from './path.js';

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
