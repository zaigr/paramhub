/**
 * Application state and reducer for paramhub.
 *
 * Follows the architectural pattern: React context + useReducer.
 * All state transitions are explicit actions.
 */

import type { Item, ProviderContext, Provider } from '@paramhub/types';

/** The type of modal currently displayed. */
export type ModalType =
  | 'command-palette'
  | 'confirm'
  | 'create-item'
  | 'region-picker'
  | 'profile-picker'
  | 'help'
  | 'setup-wizard';

export interface ModalState {
  type: ModalType;
  data?: unknown;
}

/** A single rendered diff/preview line for the confirm modal. */
export interface DiffLine {
  text: string;
  /** Semantic kind; mapped to theme colors at render time. */
  kind?: 'added' | 'removed';
}

/**
 * Payload for the generic confirm modal (modal.data when type === 'confirm').
 * Used by edit (with a diff) and delete (with a body) flows.
 */
export interface ConfirmModalData {
  title: string;
  /** Optional one-line body (e.g. the path being deleted). */
  body?: string;
  /** Optional preview/diff lines. */
  lines?: DiffLine[];
  /** Label for the confirm action shown in the hint (default "Confirm"). */
  confirmLabel?: string;
  /** Invoked when the user confirms; errors are surfaced by the callback. */
  onConfirm: () => void | Promise<void>;
}

/** View modes for the main content area. */
export type ViewMode = 'list' | 'detail' | 'bookmarks' | 'provider-tab';

/** Focus zones determine which component receives keyboard input. */
export type FocusZone = 'list' | 'search' | 'detail' | 'modal';

/** The complete application state. */
export interface AppState {
  // Provider
  activeProviderId: string | null;
  providers: Map<string, Provider>;
  providerContexts: Map<string, ProviderContext>;

  // View
  view: ViewMode;
  activeCustomTabId?: string;

  // Search & List
  searchQuery: string;
  items: Item[];
  selectedIndex: number;
  isLoading: boolean;
  nextToken?: string;
  /** Bumped to force a list reload even when searchQuery is unchanged (e.g. after a profile/region switch). */
  searchEpoch: number;

  // Detail
  selectedItem: Item | null;
  revealedValue: boolean;
  detailValue: string | null;
  detailValueLoading: boolean;
  detailValueError: string | null;

  // UI
  modal: ModalState | null;
  focusZone: FocusZone;
  error: string | null;
  statusMessage: string | null;
  /** True while an external GUI editor is open; drives the waiting overlay. */
  editingExternally: boolean;
}

/** All possible state transitions. */
export type Action =
  | { type: 'SET_PROVIDER'; providerId: string }
  | { type: 'SET_PROVIDERS'; providers: Map<string, Provider> }
  | { type: 'SET_PROVIDER_CONTEXT'; providerId: string; context: ProviderContext }
  | { type: 'SET_VIEW'; view: ViewMode }
  | { type: 'SEARCH_START'; query: string }
  | { type: 'SEARCH_SUCCESS'; items: Item[]; nextToken?: string; append: boolean }
  | { type: 'SEARCH_ERROR'; error: string }
  | { type: 'SELECT_ITEM'; index: number }
  | { type: 'SET_SELECTED_ITEM'; item: Item | null }
  | { type: 'TOGGLE_REVEAL' }
  | { type: 'LOAD_VALUE_START' }
  | { type: 'LOAD_VALUE_SUCCESS'; value: string }
  | { type: 'LOAD_VALUE_ERROR'; error: string }
  | { type: 'SET_STATUS'; message: string | null }
  | { type: 'SET_EDITING'; value: boolean }
  | { type: 'OPEN_MODAL'; modal: ModalState }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_FOCUS'; zone: FocusZone }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'NAVIGATE_UP' }
  | { type: 'NAVIGATE_DOWN' }
  | { type: 'REFRESH_LIST' };

/** Initial application state. */
export const initialState: AppState = {
  activeProviderId: null,
  providers: new Map(),
  providerContexts: new Map(),
  view: 'list',
  searchQuery: '',
  items: [],
  selectedIndex: 0,
  isLoading: false,
  nextToken: undefined,
  searchEpoch: 0,
  selectedItem: null,
  revealedValue: false,
  detailValue: null,
  detailValueLoading: false,
  detailValueError: null,
  modal: null,
  focusZone: 'list',
  error: null,
  statusMessage: null,
  editingExternally: false,
};

/** Main application reducer. */
export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PROVIDER':
      return {
        ...state,
        activeProviderId: action.providerId,
        items: [],
        selectedIndex: 0,
        searchQuery: '',
        nextToken: undefined,
        selectedItem: null,
        revealedValue: false,
        detailValue: null,
        detailValueLoading: false,
        detailValueError: null,
        view: 'list',
      };

    case 'SET_PROVIDERS':
      return { ...state, providers: action.providers };

    case 'SET_PROVIDER_CONTEXT': {
      const contexts = new Map(state.providerContexts);
      contexts.set(action.providerId, action.context);
      return { ...state, providerContexts: contexts };
    }

    case 'SET_VIEW':
      return { ...state, view: action.view };

    case 'SEARCH_START':
      return { ...state, searchQuery: action.query, isLoading: true, error: null };

    case 'SEARCH_SUCCESS':
      return {
        ...state,
        items: action.append ? [...state.items, ...action.items] : action.items,
        nextToken: action.nextToken,
        isLoading: false,
        selectedIndex: action.append ? state.selectedIndex : 0,
      };

    case 'SEARCH_ERROR':
      // Drop the pagination token: ItemList auto-triggers loadNextPage during
      // render while hasNextPage && !isLoading, so keeping a token after a
      // failed page-load would re-fire the request every render forever.
      return { ...state, isLoading: false, error: action.error, nextToken: undefined };

    case 'SELECT_ITEM':
      return {
        ...state,
        selectedIndex: Math.max(0, Math.min(action.index, state.items.length - 1)),
      };

    case 'SET_SELECTED_ITEM':
      return {
        ...state,
        selectedItem: action.item,
        revealedValue: false,
        detailValue: null,
        detailValueLoading: false,
        detailValueError: null,
      };

    case 'TOGGLE_REVEAL':
      return { ...state, revealedValue: !state.revealedValue };

    case 'LOAD_VALUE_START':
      return { ...state, detailValueLoading: true, detailValueError: null };

    case 'LOAD_VALUE_SUCCESS':
      return { ...state, detailValue: action.value, detailValueLoading: false };

    case 'LOAD_VALUE_ERROR':
      return { ...state, detailValueLoading: false, detailValueError: action.error };

    case 'SET_STATUS':
      return { ...state, statusMessage: action.message };

    case 'SET_EDITING':
      return { ...state, editingExternally: action.value };

    case 'OPEN_MODAL':
      return { ...state, modal: action.modal, focusZone: 'modal' };

    case 'CLOSE_MODAL':
      return {
        ...state,
        modal: null,
        focusZone: state.view === 'detail' ? 'detail' : 'list',
      };

    case 'SET_FOCUS':
      return { ...state, focusZone: action.zone };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    case 'CLEAR_SEARCH':
      // Clear nextToken too: a leftover token from the previous query/context
      // is invalid here and would be fired blindly by ItemList's auto-paginate.
      // Bump searchEpoch so the list reloads (default empty-query results) even
      // when searchQuery was already '' — e.g. right after a profile/region switch.
      return {
        ...state,
        searchQuery: '',
        items: [],
        selectedIndex: 0,
        nextToken: undefined,
        searchEpoch: state.searchEpoch + 1,
      };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'NAVIGATE_UP':
      return {
        ...state,
        selectedIndex: Math.max(0, state.selectedIndex - 1),
      };

    case 'NAVIGATE_DOWN':
      return {
        ...state,
        selectedIndex: Math.min(state.items.length - 1, state.selectedIndex + 1),
      };

    case 'REFRESH_LIST':
      // Force useSearch to re-run for the current query even though it is
      // unchanged (after a mutation). Callers clear the module-level search
      // cache first, so the reload hits the provider. nextToken is dropped so
      // ItemList's auto-paginate cannot fire a stale token mid-refresh.
      return { ...state, searchEpoch: state.searchEpoch + 1, nextToken: undefined };

    default:
      return state;
  }
}
