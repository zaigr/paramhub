/**
 * Provider configuration schema types.
 *
 * Providers declare their configuration fields via `getConfigSchema()`.
 * The app uses this to validate config and potentially render config UI.
 */

/** A single configuration field that a provider requires or supports. */
export interface ProviderConfigField {
  /** The config key (used in config file, e.g., "defaultRegion"). */
  key: string;
  /** Human-readable label for display. */
  label: string;
  /** The field value type. */
  type: 'string' | 'select' | 'boolean';
  /** Whether this field is required for the provider to initialize. */
  required: boolean;
  /** Default value if not specified in config. */
  default?: string;
  /** Available options (only for 'select' type). */
  options?: string[];
}
