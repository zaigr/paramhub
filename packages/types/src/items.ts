/**
 * Core item types for paramhub.
 *
 * These types represent parameters/secrets stored in cloud parameter stores.
 */

/** Supported parameter value types across all providers. */
export type ItemType = 'string' | 'secure' | 'binary' | 'json' | 'list';

/** Universal metadata fields common to all providers. */
export interface UniversalMetadata {
  lastModified?: Date;
  version?: number;
  createdBy?: string;
  size?: number;
  tags?: Record<string, string>;
}

/**
 * A single parameter/secret item from a provider.
 *
 * The `value` field is undefined until explicitly loaded via `provider.getValue()`.
 */
export interface Item {
  /** Unique identifier within the provider (e.g., SSM ARN or full path). */
  id: string;
  /** Full path / key name. */
  path: string;
  /** Display name (typically the last segment of the path). */
  name: string;
  /** The type of the parameter value. */
  type: ItemType;
  /** The parameter value. Undefined until explicitly loaded. */
  value?: string;
  /** Universal metadata common across providers. */
  metadata: UniversalMetadata;
  /** Provider-specific metadata (e.g., SSM tier, data type, policies). */
  providerMetadata?: Record<string, unknown>;
}

/**
 * A field to display in the detail panel.
 *
 * Providers return these from `getItemDetails()` to show
 * both universal and provider-specific information.
 */
export interface DetailField {
  /** Human-readable label (e.g., "ARN", "Last Modified"). */
  label: string;
  /** The field value as a display string. */
  value: string;
  /** If true, the value should be masked by default. */
  sensitive?: boolean;
  /** If true, a "copy" action should be available for this field. */
  copyable?: boolean;
}
