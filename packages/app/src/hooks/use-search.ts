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

/** Debounce delay in milliseconds. */
const DEBOUNCE_MS = 300;

/** Build a cache key from search parameters. */
function cacheKey(providerId: string, query: string, nextToken?: string): string {
  return `${providerId}:${query}:${nextToken ?? ''}`;
}

interface UseSearchOptions {
  provider: Provider | null;
  state: Pick<AppState, 'searchQuery' | 'nextToken' | 'items' | 'activeProviderId' | 'isLoading'>;
  dispatch: Dispatch<Action>;
}

interface UseSearchReturn {
  loadNextPage: () => void;
}

// Module-level cache shared across re-renders (cleared on provider change)
const searchCache = new TTLCache<string, SearchResult>();

export function useSearch({ provider, state, dispatch }: UseSearchOptions): UseSearchReturn {
  const { searchQuery, activeProviderId, isLoading } = state;

  // Track the current request to detect stale responses
  const requestIdRef = useRef(0);
  const lastProviderRef = useRef<string | null>(null);

  // Clear cache when provider changes
  useEffect(() => {
    if (activeProviderId !== lastProviderRef.current) {
      searchCache.clear();
      lastProviderRef.current = activeProviderId;
    }
  }, [activeProviderId]);

  // Debounced search effect
  useEffect(() => {
    if (!provider || !searchQuery.trim()) {
      // If query is empty, clear results
      if (!searchQuery.trim() && state.items.length > 0) {
        dispatch({ type: 'CLEAR_SEARCH' });
      }
      return;
    }

    const currentRequestId = ++requestIdRef.current;

    const timer = setTimeout(() => {
      // Check if this request is still current
      if (currentRequestId !== requestIdRef.current) return;

      const key = cacheKey(activeProviderId ?? '', searchQuery);
      const cached = searchCache.get(key);

      if (cached) {
        dispatch({
          type: 'SEARCH_SUCCESS',
          items: cached.items,
          nextToken: cached.nextToken,
          append: false,
        });
        return;
      }

      dispatch({ type: 'SEARCH_START', query: searchQuery });

      provider
        .search({ query: searchQuery, maxResults: 20 })
        .then((result) => {
          // Ignore stale responses
          if (currentRequestId !== requestIdRef.current) return;

          searchCache.set(key, result);
          dispatch({
            type: 'SEARCH_SUCCESS',
            items: result.items,
            nextToken: result.nextToken,
            append: false,
          });
        })
        .catch((err: unknown) => {
          if (currentRequestId !== requestIdRef.current) return;

          const message = err instanceof Error ? err.message : 'Search failed';
          dispatch({ type: 'SEARCH_ERROR', error: message });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, provider, activeProviderId]);

  // Load next page (pagination)
  const loadNextPage = useCallback(() => {
    if (!provider || !state.nextToken || isLoading) return;

    const currentRequestId = ++requestIdRef.current;
    const key = cacheKey(activeProviderId ?? '', searchQuery, state.nextToken);
    const cached = searchCache.get(key);

    if (cached) {
      dispatch({
        type: 'SEARCH_SUCCESS',
        items: cached.items,
        nextToken: cached.nextToken,
        append: true,
      });
      return;
    }

    dispatch({ type: 'SEARCH_START', query: searchQuery });

    provider
      .search({ query: searchQuery, maxResults: 20, nextToken: state.nextToken })
      .then((result) => {
        if (currentRequestId !== requestIdRef.current) return;

        searchCache.set(key, result);
        dispatch({
          type: 'SEARCH_SUCCESS',
          items: result.items,
          nextToken: result.nextToken,
          append: true,
        });
      })
      .catch((err: unknown) => {
        if (currentRequestId !== requestIdRef.current) return;

        const message = err instanceof Error ? err.message : 'Pagination failed';
        dispatch({ type: 'SEARCH_ERROR', error: message });
      });
  }, [provider, state.nextToken, isLoading, activeProviderId, searchQuery, dispatch]);

  return { loadNextPage };
}
