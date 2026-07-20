/**
 * React context for application state.
 *
 * Provides global state and dispatch to the entire component tree.
 * Uses separate contexts for state and dispatch to avoid unnecessary re-renders.
 */

import { createContext, useContext, useReducer } from 'react';
import type { Dispatch } from 'react';
import { appReducer, initialState } from './reducer.js';
import type { AppState, Action, ListMode } from './reducer.js';

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<Action> | null>(null);

interface AppStateProviderProps {
  children: React.ReactNode;
  /** Fallback listing preference from config (`list.defaultMode`). */
  initialListMode?: ListMode;
  /** Per-provider listing preferences restored from the UI state file. */
  initialListModes?: Record<string, ListMode>;
}

/**
 * Provider component that wraps the app with state management.
 *
 * Preferences are seeded into the initial state rather than dispatched from an
 * effect, so the very first list fetch already runs in the remembered mode —
 * an effect would make the app flash the wrong mode before correcting itself.
 */
export function AppStateProvider({
  children,
  initialListMode,
  initialListModes,
}: AppStateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState, (base) => ({
    ...base,
    defaultListMode: initialListMode ?? base.defaultListMode,
    listModes: initialListModes ?? base.listModes,
  }));

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

/** Hook to access the current application state. */
export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (state === null) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return state;
}

/** Hook to access the dispatch function for state updates. */
export function useAppDispatch(): Dispatch<Action> {
  const dispatch = useContext(AppDispatchContext);
  if (dispatch === null) {
    throw new Error('useAppDispatch must be used within AppStateProvider');
  }
  return dispatch;
}
