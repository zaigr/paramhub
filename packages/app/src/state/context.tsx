/**
 * React context for application state.
 *
 * Provides global state and dispatch to the entire component tree.
 * Uses separate contexts for state and dispatch to avoid unnecessary re-renders.
 */

import { createContext, useContext, useReducer } from 'react';
import type { Dispatch } from 'react';
import { appReducer, initialState } from './reducer.js';
import type { AppState, Action } from './reducer.js';

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<Action> | null>(null);

/** Provider component that wraps the app with state management. */
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

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
