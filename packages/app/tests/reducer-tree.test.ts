/**
 * Reducer unit tests for tree navigation and the pagination-token invariant.
 *
 * The token invariant is the reason this file exists: ItemList calls
 * onLoadNextPage() *during render*, and a browse token is scoped to the browsed
 * path — so any action that changes provider, mode, or path must drop it, or the
 * next render fires a stale token against the wrong path.
 */

import { describe, it, expect } from 'vitest';
import type { BranchNode, Item, TreeNode } from '@paramhub/types';
import { appReducer, initialState, listModeFor } from '../src/state/reducer.js';
import type { Action, AppState } from '../src/state/reducer.js';

function leaf(path: string): TreeNode {
  const item: Item = {
    id: path,
    path,
    name: path.split('/').pop() ?? path,
    type: 'string',
    metadata: {},
  };
  return { kind: 'leaf', item };
}

function branch(path: string): BranchNode {
  return { kind: 'branch', path, name: path.split('/').pop() ?? path };
}

/** A loaded list sitting inside /app, with a pagination token outstanding. */
function loaded(overrides: Partial<AppState> = {}): AppState {
  return {
    ...initialState,
    activeProviderId: 'mock',
    nodes: [branch('/app/prod'), leaf('/app/flags')],
    selectedIndex: 1,
    nextToken: 'page-2',
    branchStack: [{ path: '/app', name: 'app', selectedIndex: 3 }],
    rootSelectedIndex: 2,
    searchQuery: 'host',
    ...overrides,
  };
}

describe('appReducer — pagination token invariant', () => {
  // A token is scoped to (provider, mode, path). Every action that changes any
  // of those must drop it; this table is the complete set.
  const actions: Array<[string, Action]> = [
    ['SET_PROVIDER', { type: 'SET_PROVIDER', providerId: 'other' }],
    ['CLEAR_SEARCH', { type: 'CLEAR_SEARCH' }],
    ['LIST_ERROR', { type: 'LIST_ERROR', error: 'boom' }],
    ['REFRESH_LIST', { type: 'REFRESH_LIST' }],
    ['ENTER_BRANCH', { type: 'ENTER_BRANCH', branch: branch('/app/prod') }],
    ['LEAVE_BRANCH', { type: 'LEAVE_BRANCH' }],
    ['SET_BRANCH_DEPTH', { type: 'SET_BRANCH_DEPTH', depth: 0 }],
    ['TOGGLE_LIST_MODE', { type: 'TOGGLE_LIST_MODE' }],
    ['SET_LIST_MODE', { type: 'SET_LIST_MODE', mode: 'flat' }],
  ];

  for (const [name, action] of actions) {
    it(`${name} drops nextToken`, () => {
      expect(appReducer(loaded(), action).nextToken).toBeUndefined();
    });
  }
});

describe('appReducer — tree navigation', () => {
  it('ENTER_BRANCH pushes a frame and remembers the cursor', () => {
    const next = appReducer(loaded({ branchStack: [], selectedIndex: 1 }), {
      type: 'ENTER_BRANCH',
      branch: branch('/app'),
    });
    expect(next.branchStack).toEqual([{ path: '/app', name: 'app', selectedIndex: 0 }]);
    // The root has no frame, so its cursor is kept separately.
    expect(next.rootSelectedIndex).toBe(1);
    expect(next.nodes).toEqual([]);
    expect(next.searchQuery).toBe('');
    expect(next.searchEpoch).toBe(initialState.searchEpoch + 1);
  });

  it('ENTER_BRANCH records the cursor on the parent frame when nested', () => {
    const next = appReducer(loaded({ selectedIndex: 1 }), {
      type: 'ENTER_BRANCH',
      branch: branch('/app/prod'),
    });
    expect(next.branchStack).toEqual([
      { path: '/app', name: 'app', selectedIndex: 1 },
      { path: '/app/prod', name: 'prod', selectedIndex: 0 },
    ]);
    // Untouched: we did not come from the root.
    expect(next.rootSelectedIndex).toBe(2);
  });

  it('LEAVE_BRANCH pops and parks the root cursor for the pending reload', () => {
    const next = appReducer(loaded(), { type: 'LEAVE_BRANCH' });
    expect(next.branchStack).toEqual([]);
    // Parked rather than applied — the list is empty until the reload lands,
    // and LIST_SUCCESS would otherwise zero it.
    expect(next.pendingSelectedIndex).toBe(2);
    expect(next.selectedIndex).toBe(0);
  });

  it('LEAVE_BRANCH restores the parent frame cursor when nested', () => {
    const state = loaded({
      branchStack: [
        { path: '/app', name: 'app', selectedIndex: 4 },
        { path: '/app/prod', name: 'prod', selectedIndex: 0 },
      ],
    });
    expect(appReducer(state, { type: 'LEAVE_BRANCH' }).pendingSelectedIndex).toBe(4);
  });

  it('LEAVE_BRANCH at the root is a no-op', () => {
    const state = loaded({ branchStack: [] });
    expect(appReducer(state, { type: 'LEAVE_BRANCH' })).toBe(state);
  });

  it('LIST_SUCCESS consumes a parked selection, clamped to the new list', () => {
    const state = loaded({ nodes: [], pendingSelectedIndex: 9, nextToken: undefined });
    const next = appReducer(state, {
      type: 'LIST_SUCCESS',
      nodes: [leaf('/a'), leaf('/b')],
      append: false,
    });
    expect(next.selectedIndex).toBe(1);
    expect(next.pendingSelectedIndex).toBeUndefined();
  });

  it('LIST_SUCCESS clears a stale error from a previous failed load', () => {
    // Must not rely on SEARCH_START for this: a cache hit dispatches
    // LIST_SUCCESS with no SEARCH_START before it.
    const state = loaded({ error: 'flat mode needs "buckets" configured' });
    const next = appReducer(state, {
      type: 'LIST_SUCCESS',
      nodes: [leaf('/a')],
      append: false,
    });
    expect(next.error).toBeNull();
  });

  it('LIST_SUCCESS otherwise resets the selection to the top', () => {
    const next = appReducer(loaded(), {
      type: 'LIST_SUCCESS',
      nodes: [leaf('/a'), leaf('/b')],
      append: false,
    });
    expect(next.selectedIndex).toBe(0);
  });

  it('LIST_SUCCESS with append keeps the current selection', () => {
    const next = appReducer(loaded(), {
      type: 'LIST_SUCCESS',
      nodes: [leaf('/c')],
      append: true,
    });
    expect(next.selectedIndex).toBe(1);
    expect(next.nodes).toHaveLength(3);
  });

  it('TOGGLE_LIST_MODE flips the mode and drops the stack', () => {
    const next = appReducer(loaded(), { type: 'TOGGLE_LIST_MODE' });
    expect(listModeFor(next)).toBe('flat');
    expect(next.branchStack).toEqual([]);
    expect(next.rootSelectedIndex).toBe(0);
    expect(next.searchQuery).toBe('');
  });

  it('remembers the mode against the active provider, not globally', () => {
    const next = appReducer(loaded(), { type: 'TOGGLE_LIST_MODE' });
    expect(next.listModes).toEqual({ mock: 'flat' });
    // The config fallback is untouched, so other providers keep their default.
    expect(next.defaultListMode).toBe('tree');
    expect(listModeFor(next, 'other')).toBe('tree');
  });

  it('moves the default when there is no provider to key the choice to', () => {
    const next = appReducer(loaded({ activeProviderId: null }), { type: 'TOGGLE_LIST_MODE' });
    expect(next.listModes).toEqual({});
    expect(next.defaultListMode).toBe('flat');
  });

  it('listModeFor prefers a remembered choice over the config default', () => {
    const state = loaded({ listModes: { mock: 'flat' }, defaultListMode: 'tree' });
    expect(listModeFor(state)).toBe('flat');
    expect(listModeFor(state, 'unseen')).toBe('tree');
  });

  it('SET_LIST_MODE to the current mode is a no-op', () => {
    const state = loaded({ listModes: { mock: 'tree' } });
    expect(appReducer(state, { type: 'SET_LIST_MODE', mode: 'tree' })).toBe(state);
  });

  it('SET_PROVIDER clears the stack so the new provider starts at its own root', () => {
    const next = appReducer(loaded(), { type: 'SET_PROVIDER', providerId: 'other' });
    expect(next.branchStack).toEqual([]);
    expect(next.rootSelectedIndex).toBe(0);
    expect(next.nodes).toEqual([]);
  });

  it('SET_BRANCH_DEPTH truncates the stack to the requested depth', () => {
    const state = loaded({
      branchStack: [
        { path: '/app', name: 'app', selectedIndex: 4 },
        { path: '/app/prod', name: 'prod', selectedIndex: 1 },
        { path: '/app/prod/db', name: 'db', selectedIndex: 0 },
      ],
    });
    const next = appReducer(state, { type: 'SET_BRANCH_DEPTH', depth: 1 });
    expect(next.branchStack.map((f) => f.name)).toEqual(['app']);
    expect(next.pendingSelectedIndex).toBe(4);
  });

  it('SET_BRANCH_DEPTH at the current depth is a no-op', () => {
    const state = loaded();
    expect(appReducer(state, { type: 'SET_BRANCH_DEPTH', depth: 1 })).toBe(state);
  });
});

describe('appReducer — selection clamping', () => {
  it('NAVIGATE_DOWN clamps against nodes.length', () => {
    const state = loaded({ selectedIndex: 1 }); // 2 nodes
    expect(appReducer(state, { type: 'NAVIGATE_DOWN' }).selectedIndex).toBe(1);
  });

  it('NAVIGATE_UP clamps at zero', () => {
    const state = loaded({ selectedIndex: 0 });
    expect(appReducer(state, { type: 'NAVIGATE_UP' }).selectedIndex).toBe(0);
  });

  it('SELECT_ITEM clamps into range', () => {
    expect(appReducer(loaded(), { type: 'SELECT_ITEM', index: 99 }).selectedIndex).toBe(1);
    expect(appReducer(loaded(), { type: 'SELECT_ITEM', index: -5 }).selectedIndex).toBe(0);
  });
});
