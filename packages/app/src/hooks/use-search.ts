/**
 * useSearch — Debounced search hook that drives the parameter list.
 *
 * Watches the searchQuery in app state. When it changes (debounced 300ms),
 * calls provider.search() and dispatches results into state.
 * Provides loadNextPage() for pagination.
 * Uses TTLCache to avoid redundant provider calls.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Dispatch } from 'react';
import type { Provider, SearchResult } from '@paramhub/types';
import type { Action, AppState } from '../state/reducer.js';
import { TTLCache } from '../utils/cache.js';
import { conciseError } from '../utils/error.js';

/** Debounce delay in milliseconds. */
const DEBOUNCE_MS = 300;

/** Build a cache key from search parameters. */
function cacheKey(providerId: string, query: string, nextToken?: string): string {
  return `${providerId}:${query}:${nextToken ?? ''}`;
}

interface UseSearchOptions {
  provider: Provider | null;
  state: Pick<AppState, 'searchQuery' | 'nextToken' | 'items' | 'activeProviderId' | 'isLoading' | 'searchEpoch'>;
  dispatch: Dispatch<Action>;
}

interface UseSearchReturn {
  loadNextPage: () => void;
}

// Module-level cache shared across re-renders (cleared on provider change)
const searchCache = new TTLCache<string, SearchResult>();

/**
 * Clear the module-level search cache.
 *
 * Needed after a profile/region switch: the active provider id is unchanged,
 * so the "clear cache on provider change" effect below will not fire, yet the
 * cached results belong to the old profile/region.
 */
export function clearSearchCache(): void {
  searchCache.clear();
}

export function useSearch({ provider, state, dispatch }: UseSearchOptions): UseSearchReturn {
  const { searchQuery, activeProviderId, isLoading, searchEpoch } = state;

  const requestIdRef = useRef(0);
  const lastProviderRef = useRef<string | null>(null);

  // Clear cache when provider changes
  useEffect(() => {
    if (activeProviderId !== lastProviderRef.current) {
      searchCache.clear();
      lastProviderRef.current = activeProviderId;
    }
  }, [activeProviderId]);

  const runSearch = useCallback(
    (query: string, nextToken: string | undefined, append: boolean, requestId: number) => {
      const key = cacheKey(activeProviderId ?? '', query, nextToken);
      const cached = searchCache.get(key);

      if (cached) {
        dispatch({
          type: 'SEARCH_SUCCESS',
          items: cached.items,
          nextToken: cached.nextToken,
          append,
        });
        return;
      }

      // search() is optional on the contract — browse-only providers have no
      // server-side name search. Until the list can drive provider.browse(),
      // such a provider renders as empty rather than throwing.
      if (!provider?.search) {
        dispatch({ type: 'SEARCH_SUCCESS', items: [], nextToken: undefined, append: false });
        return;
      }

      dispatch({ type: 'SEARCH_START', query });

      provider
        .search({ query, maxResults: 20, nextToken })
        .then((result) => {
          if (requestId !== requestIdRef.current) return;

          searchCache.set(key, result);
          dispatch({
            type: 'SEARCH_SUCCESS',
            items: result.items,
            nextToken: result.nextToken,
            append,
          });
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return;

          const message = conciseError(err instanceof Error ? err.message : 'Search failed');
          dispatch({ type: 'SEARCH_ERROR', error: message });
        });
    },
    [provider, activeProviderId, dispatch],
  );

  // Debounced search effect
  useEffect(() => {
    if (!provider) return;

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      if (requestId !== requestIdRef.current) return;

      runSearch(searchQuery, undefined, false, requestId);
    }, DEBOUNCE_MS);

    return () => { clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, provider, activeProviderId, searchEpoch]);

  const loadNextPage = useCallback(() => {
    if (!provider || !state.nextToken || isLoading) return;

    runSearch(searchQuery, state.nextToken, true, ++requestIdRef.current);
  }, [provider, state.nextToken, isLoading, searchQuery, runSearch]);

  return { loadNextPage };
}
