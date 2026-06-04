/**
 * ListPicker component — filterable single-select overlay.
 *
 * Backs both the region picker and the profile picker (same UX), keyed off the
 * active modal type. Fetches its options from the active provider on mount
 * (getAvailableRegions / getAvailableProfiles), highlights the current value,
 * and on select runs the switch + cache-bust + reload sequence.
 *
 * Mirrors CommandPalette's input handling: type to filter, ↑↓ to move,
 * Enter selects, Esc cancels.
 */

import { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Provider } from '@paramhub/types';
import { useAppState, useAppDispatch } from '../../state/index.js';
import { clearSearchCache } from '../../hooks/use-search.js';
import { valueCache } from '../../hooks/use-item-value.js';
import { conciseError } from '../../utils/error.js';
import Modal from './Modal.js';

/** Maximum number of options to display at once. */
const MAX_VISIBLE_RESULTS = 8;

type PickerKind = 'region' | 'profile';

interface PickerSpec {
  kind: PickerKind;
  title: string;
  getOptions: (p: Provider) => Promise<string[]>;
  switchTo: (p: Provider, value: string) => Promise<void>;
  current: (region?: string, profile?: string) => string | undefined;
}

const REGION_SPEC: PickerSpec = {
  kind: 'region',
  title: 'Switch Region',
  getOptions: (p) => p.getAvailableRegions?.() ?? Promise.resolve([]),
  switchTo: (p, v) => p.switchRegion?.(v) ?? Promise.resolve(),
  current: (region) => region,
};

const PROFILE_SPEC: PickerSpec = {
  kind: 'profile',
  title: 'Switch Profile',
  getOptions: (p) => p.getAvailableProfiles?.() ?? Promise.resolve([]),
  switchTo: (p, v) => p.switchProfile?.(v) ?? Promise.resolve(),
  current: (_region, profile) => profile,
};

export default function ListPicker({ kind }: { kind: PickerKind }) {
  const spec = kind === 'region' ? REGION_SPEC : PROFILE_SPEC;

  const state = useAppState();
  const dispatch = useAppDispatch();

  const provider = state.activeProviderId
    ? state.providers.get(state.activeProviderId) ?? null
    : null;
  const context = state.activeProviderId
    ? state.providerContexts.get(state.activeProviderId)
    : undefined;
  const currentValue = spec.current(context?.region, context?.profile);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [options, setOptions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch options on mount
  useEffect(() => {
    if (!provider) {
      setError('No active provider');
      return;
    }
    let cancelled = false;
    spec
      .getOptions(provider)
      .then((opts) => {
        if (cancelled) return;
        setOptions(opts);
        // Pre-select the current value if present
        const idx = currentValue ? opts.indexOf(currentValue) : -1;
        if (idx >= 0) setSelectedIndex(idx);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load options');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const results = useMemo(() => {
    if (!options) return [];
    if (!query) return options;
    const lower = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lower));
  }, [options, query]);

  const clampedIndex = Math.max(0, Math.min(selectedIndex, results.length - 1));

  const close = () => dispatch({ type: 'CLOSE_MODAL' });

  const selectValue = (value: string) => {
    // Close first so the UI is responsive; switch work runs async after.
    dispatch({ type: 'CLOSE_MODAL' });

    if (!provider || value === currentValue) return;

    void (async () => {
      // Same provider id, so useSearch's auto cache-clear won't fire — bust
      // both caches explicitly so stale results from the previous
      // profile/region can't leak into the new context.
      const refresh = (ctx: Awaited<ReturnType<Provider['getCurrentContext']>>) => {
        dispatch({ type: 'SET_PROVIDER_CONTEXT', providerId: provider.id, context: ctx });
        clearSearchCache();
        valueCache.clear();
        dispatch({ type: 'CLEAR_SEARCH' });
      };

      try {
        await spec.switchTo(provider, value);
        // Probe the new credentials up front so a bad profile/region surfaces
        // immediately as a clear, persistent error — instead of silently
        // "switching" and then failing later with a cryptic search error.
        const test = await provider.testConnection();
        const ctx = await provider.getCurrentContext();
        refresh(ctx);

        if (test.ok) {
          dispatch({ type: 'SET_ERROR', error: null });
          dispatch({ type: 'SET_STATUS', message: `Switched to ${value}` });
        } else {
          dispatch({ type: 'SET_ERROR', error: `${value}: ${conciseError(test.message)}` });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Switch failed';
        dispatch({ type: 'SET_ERROR', error: `Failed to switch to ${value}: ${conciseError(message)}` });
      }
    })();
  };

  useInput((input, key) => {
    if (key.escape) {
      close();
      return;
    }
    if (key.return) {
      const value = results[clampedIndex];
      if (value) selectValue(value);
      return;
    }
    if (key.upArrow || (key.ctrl && input === 'k')) {
      setSelectedIndex(Math.max(0, clampedIndex - 1));
      return;
    }
    if (key.downArrow || (key.ctrl && input === 'j')) {
      setSelectedIndex(Math.min(results.length - 1, clampedIndex + 1));
      return;
    }
    if (key.ctrl || key.meta) return;
    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }
    if (key.tab || key.leftArrow || key.rightArrow) return;
    if (input) {
      setQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  const startIndex = Math.max(
    0,
    Math.min(clampedIndex - Math.floor(MAX_VISIBLE_RESULTS / 2), results.length - MAX_VISIBLE_RESULTS),
  );
  const visibleResults = results.slice(startIndex, startIndex + MAX_VISIBLE_RESULTS);

  return (
    <Modal title={spec.title} width={56}>
      <Box>
        <Text color="gray">&gt; </Text>
        <Text>{query}</Text>
        <Text dimColor>{query.length === 0 ? 'Type to filter...' : ''}</Text>
      </Box>
      <Box flexDirection="column">
        {error ? (
          <Text color="red">  {error}</Text>
        ) : options === null ? (
          <Text dimColor>  Loading…</Text>
        ) : visibleResults.length === 0 ? (
          <Text dimColor>  No matches</Text>
        ) : (
          visibleResults.map((value, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === clampedIndex;
            const isCurrent = value === currentValue;
            const prefix = isSelected ? '> ' : '  ';
            return (
              <Text key={value} color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {prefix}
                {value}
                {isCurrent ? <Text dimColor> (current)</Text> : ''}
              </Text>
            );
          })
        )}
      </Box>
      <Box>
        <Text dimColor>
          {options ? `${results.length} option${results.length !== 1 ? 's' : ''}` : ''}
          {' · ↑↓ nav · Enter select · Esc close'}
        </Text>
      </Box>
    </Modal>
  );
}
