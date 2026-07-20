/**
 * Resolve the user's listing preference against what a provider can actually do.
 */

import type { Provider } from '@paramhub/types';
import type { ListMode } from '../state/reducer.js';

/**
 * The mode the list should actually run in.
 *
 * Derived on every read rather than stored: a resolved mode would go stale the
 * moment the active provider changes. The two branches mirror the invariants
 * documented on the Provider contract — `hierarchy !== undefined` iff `browse`
 * exists, and `canSearch` iff `search` exists.
 */
export function effectiveListMode(pref: ListMode, provider: Provider | null): ListMode {
  const caps = provider?.getCapabilities();
  if (!caps?.hierarchy || !provider?.browse) return 'flat'; // provider is flat
  if (!caps.canSearch || !provider.search) return 'tree'; // browse-only (e.g. S3 with no buckets configured)
  return pref;
}

/** True when the provider exposes a browsable hierarchy. */
export function supportsHierarchy(provider: Provider | null): boolean {
  return Boolean(provider?.getCapabilities().hierarchy && provider?.browse);
}

/** True when the provider supports both listing styles, so the toggle is meaningful. */
export function supportsBothModes(provider: Provider | null): boolean {
  const caps = provider?.getCapabilities();
  return Boolean(caps?.hierarchy && provider?.browse && caps.canSearch && provider.search);
}
