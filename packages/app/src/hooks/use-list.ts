/**
 * useList — Debounced hook that drives the parameter list.
 *
 * Dispatches to `provider.browse()` or `provider.search()` depending on the
 * effective list mode and whether a query is active, then feeds the result into
 * state as TreeNodes. Provides loadNextPage() for pagination and uses a TTLCache
 * to avoid redundant provider calls.
 *
 * Browse and search deliberately share one hook. Two hooks writing the same
 * state slice would each carry their own staleness counter, and neither could
 * invalidate the other — so a slow browse() issued before a mode toggle could
 * land after a fast search() and overwrite it.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Dispatch } from 'react';
import type { Item, Provider, TreeNode } from '@paramhub/types';
import type { Action, AppState, ListMode } from '../state/reducer.js';
import { TTLCache } from '../utils/cache.js';
import { conciseError } from '../utils/error.js';

/** Debounce delay in milliseconds. */
const DEBOUNCE_MS = 300;

const PAGE_SIZE = 20;

interface CachedPage {
  nodes: TreeNode[];
  nextToken?: string;
}

/**
 * Build a cache key.
 *
 * Mode and browse path are part of the key: without them a browse of '/app'
 * and a flat search for '' would collide on the same entry.
 */
function cacheKey(
  providerId: string,
  mode: ListMode,
  browsePath: string | undefined,
  query: string,
  nextToken?: string,
): string {
  return `${providerId}:${mode}:${browsePath ?? ''}:${query}:${nextToken ?? ''}`;
}

interface UseListOptions {
  provider: Provider | null;
  mode: ListMode;
  /** Current branch path, or undefined at the provider's rootPath. */
  browsePath: string | undefined;
  state: Pick<AppState, 'searchQuery' | 'nextToken' | 'activeProviderId' | 'isLoading' | 'searchEpoch'>;
  dispatch: Dispatch<Action>;
}

interface UseListReturn {
  loadNextPage: () => void;
}

// Module-level cache shared across re-renders (cleared on provider change)
const listCache = new TTLCache<string, CachedPage>();

/**
 * Clear the module-level list cache.
 *
 * Needed after a profile/region switch: the active provider id is unchanged,
 * so the "clear cache on provider change" effect below will not fire, yet the
 * cached results belong to the old profile/region.
 */
export function clearListCache(): void {
  listCache.clear();
}

/** Wrap search results as leaves so the list has one node type to render. */
function toLeaves(items: Item[]): TreeNode[] {
  return items.map((item) => ({ kind: 'leaf', item }));
}

/**
 * Narrow a browsed level to the nodes matching `query`.
 *
 * Tree mode filters the level the user is standing on rather than issuing a
 * search, because a level can contain branches and `search()` returns only
 * Items — so at the S3 root, where every node is a bucket, a search can never
 * match anything. Recursive search across the whole store is what flat mode
 * ("t") is for.
 *
 * Applied here rather than at render time: selectedIndex, NAVIGATE_DOWN and
 * CommandContext.selectedNode all index into state.nodes, so filtering only
 * the display would let the cursor point at a row that is not on screen.
 */
function filterNodes(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  return nodes.filter((node) =>
    node.kind === 'branch'
      ? node.name.toLowerCase().includes(q)
      : node.item.name.toLowerCase().includes(q) || node.item.path.toLowerCase().includes(q),
  );
}

export function useList({
  provider,
  mode,
  browsePath,
  state,
  dispatch,
}: UseListOptions): UseListReturn {
  const { searchQuery, activeProviderId, isLoading, searchEpoch } = state;

  const requestIdRef = useRef(0);
  const lastProviderRef = useRef<string | null>(null);

  // Clear cache when provider changes
  useEffect(() => {
    if (activeProviderId !== lastProviderRef.current) {
      listCache.clear();
      lastProviderRef.current = activeProviderId;
    }
  }, [activeProviderId]);

  const runList = useCallback(
    (query: string, nextToken: string | undefined, append: boolean, requestId: number) => {
      const tree = mode === 'tree';
      // Tree mode browses the level regardless of the query — the query only
      // narrows what came back — so every query shares one cache entry per
      // level, and typing never refetches.
      const key = cacheKey(activeProviderId ?? '', mode, browsePath, tree ? '' : query, nextToken);
      const cached = listCache.get(key);

      const emit = (page: CachedPage) => {
        dispatch({
          type: 'LIST_SUCCESS',
          nodes: tree ? filterNodes(page.nodes, query) : page.nodes,
          nextToken: page.nextToken,
          append,
        });
      };

      if (cached) {
        emit(cached);
        return;
      }

      // Pick the call: browse enumerates a level, search finds items anywhere
      // in the store. A provider may implement only one of them.
      const fetch: Promise<CachedPage> | null = tree
        ? provider?.browse
          ? provider
              .browse({ path: browsePath, maxResults: PAGE_SIZE, nextToken })
              .then((r) => ({ nodes: r.nodes, nextToken: r.nextToken }))
          : null
        : provider?.search
          ? provider
              .search({ query, maxResults: PAGE_SIZE, nextToken })
              .then((r) => ({ nodes: toLeaves(r.items), nextToken: r.nextToken }))
          : null;

      // Neither capability is usable here. Render empty rather than throwing.
      if (!fetch) {
        dispatch({ type: 'LIST_SUCCESS', nodes: [], nextToken: undefined, append: false });
        return;
      }

      dispatch({ type: 'SEARCH_START', query });

      fetch
        .then((page) => {
          if (requestId !== requestIdRef.current) return;

          // Cache the unfiltered level so changing the query is instant.
          listCache.set(key, page);
          emit(page);
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return;

          const message = conciseError(err instanceof Error ? err.message : 'Search failed');
          dispatch({ type: 'LIST_ERROR', error: message });
        });
    },
    [provider, activeProviderId, mode, browsePath, dispatch],
  );

  // Debounced load effect
  useEffect(() => {
    if (!provider) return;

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      if (requestId !== requestIdRef.current) return;

      runList(searchQuery, undefined, false, requestId);
    }, DEBOUNCE_MS);

    return () => { clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, provider, activeProviderId, searchEpoch, mode, browsePath]);

  const loadNextPage = useCallback(() => {
    if (!provider || !state.nextToken || isLoading) return;

    // Routed through the same dispatcher, so a browse token can never be
    // handed to search() (or vice versa) after a mode or path change.
    runList(searchQuery, state.nextToken, true, ++requestIdRef.current);
  }, [provider, state.nextToken, isLoading, searchQuery, runList]);

  return { loadNextPage };
}
