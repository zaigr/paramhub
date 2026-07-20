/**
 * Provider interface contract for paramhub.
 *
 * All cloud parameter store providers must implement this interface.
 * Providers are loaded dynamically at runtime based on user configuration.
 */

import type { Item, ItemType, DetailField } from './items.js';
import type { SearchOptions, SearchResult } from './search.js';
import type { BrowseOptions, BrowseResult, HierarchyInfo } from './tree.js';
import type { CustomAction } from './actions.js';
import type { CustomTab } from './tabs.js';
import type { ProviderConfigField } from './config.js';
import type { Command } from './commands.js';

/** Context information about the provider's current connection state. */
export interface ProviderContext {
  /** Account identifier (e.g., AWS account ID, Azure subscription). */
  account?: string;
  /** Region or location (e.g., "us-east-1"). */
  region?: string;
  /** Named profile (e.g., AWS CLI profile name). */
  profile?: string;
  /** Human-readable label for display (e.g., "123456789012 / us-east-1"). */
  displayLabel: string;
}

/** Information about an available account/subscription. */
export interface AccountInfo {
  /** Account identifier. */
  id: string;
  /** Human-readable label. */
  label: string;
}

/** Declares what operations and features a provider supports. */
export interface ProviderCapabilities {
  /** Whether the provider supports editing parameter values. */
  canEdit: boolean;
  /** Whether the provider supports deleting parameters. */
  canDelete: boolean;
  /** Whether the provider supports creating new parameters. */
  canCreate: boolean;
  /** Whether the provider supports search/filtering. False when `search()` is absent. */
  canSearch: boolean;
  /** Whether the provider supports switching regions. */
  canSwitchRegion: boolean;
  /** Whether the provider supports switching accounts/profiles. */
  canSwitchAccount: boolean;
  /** Hierarchy description. Absent when the provider is flat and has no `browse()`. */
  hierarchy?: HierarchyInfo;
  /** The item types this provider can work with. */
  supportedItemTypes: ItemType[];
  /** Provider-specific custom actions available for items. */
  customActions: CustomAction[];
  /** Provider-specific custom tabs to render in the UI. */
  customTabs: CustomTab[];
}

/** Result of a connection test. */
export interface ConnectionTestResult {
  /** Whether the connection was successful. */
  ok: boolean;
  /** Optional message (e.g., error details on failure). */
  message?: string;
}

/**
 * The core provider interface that all paramhub providers must implement.
 *
 * Providers encapsulate all interaction with a specific cloud parameter store
 * (AWS SSM, Azure Key Vault, GCP Secret Manager, etc.).
 */
export interface Provider {
  /** Unique provider identifier (e.g., "aws-ssm", "azure-kv"). */
  readonly id: string;
  /** Human-readable display name (e.g., "AWS SSM Parameter Store"). */
  readonly displayName: string;
  /** Optional icon (emoji or nerd-font character). */
  readonly icon?: string;

  // ── Lifecycle ──

  /** Returns the configuration schema for this provider. */
  getConfigSchema(): ProviderConfigField[];
  /** Initialize the provider with the given configuration. */
  init(config: Record<string, unknown>): Promise<void>;
  /** Test that the provider can connect to its backend. */
  testConnection(): Promise<ConnectionTestResult>;
  /** Clean up resources (close connections, etc.). */
  dispose(): Promise<void>;

  // ── Capabilities ──

  /** Returns the capabilities of this provider. */
  getCapabilities(): ProviderCapabilities;

  // ── Commands ──

  /**
   * Returns commands contributed by this provider.
   *
   * These are registered in the global command registry and appear
   * in the command palette alongside core commands.
   */
  getCommands(): Command[];

  // ── Context Switching ──

  /** Get the provider's current connection context. */
  getCurrentContext(): Promise<ProviderContext>;
  /** Get available regions (if supported). */
  getAvailableRegions?(): Promise<string[]>;
  /** Get available profiles (if supported). */
  getAvailableProfiles?(): Promise<string[]>;
  /** Switch to a different region (if supported). */
  switchRegion?(region: string): Promise<void>;
  /** Switch to a different profile (if supported). */
  switchProfile?(profile: string): Promise<void>;

  // ── Data ──

  /**
   * Search for items matching the given options.
   *
   * A provider must implement `search`, `browse`, or both. Omit this when the
   * backing store has no usable name search (S3) and expose data via `browse()`.
   */
  search?(options: SearchOptions): Promise<SearchResult>;
  /** Enumerate the direct children of a branch. Requires `capabilities.hierarchy`. */
  browse?(options: BrowseOptions): Promise<BrowseResult>;
  /** Get a single item by ID (without loading its value). */
  getItem(id: string): Promise<Item>;
  /** Get the decrypted/raw value of an item. */
  getValue(id: string): Promise<string>;
  /** Get detail fields for display in the detail panel. */
  getItemDetails(item: Item): DetailField[];

  // ── Mutations (optional based on capabilities) ──

  /** Update the value of an existing item. */
  updateValue?(id: string, newValue: string): Promise<void>;
  /** Create a new item. */
  createItem?(path: string, value: string, type: ItemType): Promise<Item>;
  /** Delete an item. */
  deleteItem?(id: string): Promise<void>;
}

/** Factory for creating provider instances. */
export interface ProviderFactory {
  /** Create a new provider instance. */
  create(): Provider;
}
