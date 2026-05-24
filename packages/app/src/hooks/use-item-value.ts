/**
 * useItemValue — Lazily loads a parameter value when the detail panel opens.
 *
 * Watches the selected item and calls provider.getValue(id) once, dispatching
 * results into state. Uses a TTLCache to avoid redundant provider calls when
 * re-opening the same item. Stale requests are discarded via a request-id ref.
 */

import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { Item, Provider } from '@paramhub/types';
import type { Action } from '../state/reducer.js';
import { TTLCache } from '../utils/cache.js';

/** Build a cache key from provider + item id. */
export function valueCacheKey(providerId: string, itemId: string): string {
  return `${providerId}:${itemId}`;
}

/** Module-level cache shared across re-renders and with copy commands. */
export const valueCache = new TTLCache<string, string>();

interface UseItemValueOptions {
  provider: Provider | null;
  item: Item | null;
  dispatch: Dispatch<Action>;
}

export function useItemValue({ provider, item, dispatch }: UseItemValueOptions): void {
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!provider || !item) return;

    const key = valueCacheKey(provider.id, item.id);
    const cached = valueCache.get(key);
    if (cached !== undefined) {
      dispatch({ type: 'LOAD_VALUE_SUCCESS', value: cached });
      return;
    }

    const requestId = ++requestIdRef.current;
    dispatch({ type: 'LOAD_VALUE_START' });

    provider
      .getValue(item.id)
      .then((value) => {
        if (requestId !== requestIdRef.current) return;
        valueCache.set(key, value);
        dispatch({ type: 'LOAD_VALUE_SUCCESS', value });
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return;
        const message = err instanceof Error ? err.message : 'Failed to load value';
        dispatch({ type: 'LOAD_VALUE_ERROR', error: message });
      });
  }, [provider, item?.id]);
}
