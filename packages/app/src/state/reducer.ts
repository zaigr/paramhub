/**
 * Application state and reducer for paramhub.
 *
 * Follows the architectural pattern: React context + useReducer.
 * All state transitions are explicit actions.
 */

import type { BranchNode, Item, ProviderContext, Provider, TreeNode } from '@paramhub/types';

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

/**
 * How the list enumerates a provider.
 *
 * Deliberately NOT a ViewMode: every command gated on `view === 'list'` and
 * CLOSE_MODAL's focus restore assume list-or-detail, so a third view would
 * silently disable navigation, search, and create.
 */
export type ListMode = 'tree' | 'flat';

/** One level of the tree drill-in stack. */
export interface BranchFrame {
  /** Provider-opaque BranchNode.path — passed to browse() verbatim. */
  path: string;
  /** Display name for the breadcrumb. */
  name: string;
  /** Selection index at this level, restored on drill-out. */
  selectedIndex: number;
}

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
  /** The current level: branches and leaves in tree mode, all leaves in flat mode. */
  nodes: TreeNode[];
  selectedIndex: number;
  isLoading: boolean;
  nextToken?: string;
  /** Bumped to force a list reload even when searchQuery is unchanged (e.g. after a profile/region switch). */
  searchEpoch: number;
  /**
   * Last chosen listing preference per provider id, remembered across restarts.
   *
   * Per provider because the right mode is a property of the store's shape: a
   * shallow SSM tree may read better flat while an S3 bucket list only makes
   * sense as a tree. Read with listModeFor(), never directly — a provider with
   * no entry falls back to defaultListMode, and what is actually *possible*
   * still depends on capabilities (see effectiveListMode).
   */
  listModes: Record<string, ListMode>;
  /** Fallback from config (`list.defaultMode`) for providers with no remembered choice. */
  defaultListMode: ListMode;
  /**
   * The drill-in stack. Empty means the provider's `hierarchy.rootPath`.
   *
   * The browsed path is derived from this (`branchStack.at(-1)?.path`) and never
   * stored — the reducer has no provider access, so it cannot know whether the
   * root is '/' (SSM) or '' (S3).
   */
  branchStack: BranchFrame[];
  /**
   * Selection index at the root level.
   *
   * The root has no BranchFrame to carry it, so without this, drilling in from
   * the second root branch and coming straight back would land on the first.
   */
  rootSelectedIndex: number;
  /**
   * Selection to apply to the *next* completed load, if any.
   *
   * Drilling out restores a remembered cursor, but the reload it triggers
   * arrives later and LIST_SUCCESS zeroes the selection on every fresh page.
   * Parking the index here lets that load consume it instead of clobbering it.
   */
  pendingSelectedIndex?: number;

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
  | { type: 'LIST_SUCCESS'; nodes: TreeNode[]; nextToken?: string; append: boolean }
  | { type: 'LIST_ERROR'; error: string }
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
  | { type: 'REFRESH_LIST' }
  | { type: 'SET_LIST_MODE'; mode: ListMode }
  | { type: 'TOGGLE_LIST_MODE' }
  | { type: 'ENTER_BRANCH'; branch: BranchNode }
  | { type: 'LEAVE_BRANCH' }
  | { type: 'SET_BRANCH_DEPTH'; depth: number };

/** Initial application state. */
export const initialState: AppState = {
  activeProviderId: null,
  providers: new Map(),
  providerContexts: new Map(),
  view: 'list',
  searchQuery: '',
  nodes: [],
  selectedIndex: 0,
  isLoading: false,
  nextToken: undefined,
  searchEpoch: 0,
  listModes: {},
  defaultListMode: 'tree',
  branchStack: [],
  rootSelectedIndex: 0,
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

/** The listing preference for a provider, falling back to the config default. */
export function listModeFor(
  state: Pick<AppState, 'listModes' | 'defaultListMode' | 'activeProviderId'>,
  providerId: string | null = state.activeProviderId,
): ListMode {
  return (providerId ? state.listModes[providerId] : undefined) ?? state.defaultListMode;
}

/**
 * Reset every field scoped to one (provider, mode, branch path) listing.
 *
 * `nextToken` is scoped to the browsed path — a token from browse('/app') fired
 * against '/app/prod' returns the wrong nodes, not merely wasted work. And
 * ItemList calls onLoadNextPage() *during render*, so a retained token is
 * re-fired immediately rather than lying dormant.
 *
 * Every action that changes the provider, the mode, or the path must spread
 * this, so a missed reset reads as a visible omission at the call site.
 */
function resetListing(): Pick<
  AppState,
  'nodes' | 'selectedIndex' | 'nextToken' | 'pendingSelectedIndex'
> {
  return { nodes: [], selectedIndex: 0, nextToken: undefined, pendingSelectedIndex: undefined };
}

/** Main application reducer. */
export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PROVIDER':
      return {
        ...state,
        ...resetListing(),
        activeProviderId: action.providerId,
        searchQuery: '',
        // The new provider has its own rootPath; the old stack is meaningless.
        branchStack: [],
        rootSelectedIndex: 0,
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

    case 'LIST_SUCCESS': {
      const nodes = action.append ? [...state.nodes, ...action.nodes] : action.nodes;
      const fresh =
        state.pendingSelectedIndex === undefined
          ? 0
          : Math.max(0, Math.min(state.pendingSelectedIndex, nodes.length - 1));
      return {
        ...state,
        nodes,
        nextToken: action.nextToken,
        isLoading: false,
        selectedIndex: action.append ? state.selectedIndex : fresh,
        pendingSelectedIndex: undefined,
        // A successful load supersedes any earlier failure. Cleared here and
        // not only in SEARCH_START because a cache hit dispatches LIST_SUCCESS
        // on its own — which is exactly the path back from a mode that errored
        // (the previous level is still cached), so the stale error would
        // otherwise sit above a perfectly good list.
        error: null,
      };
    }

    case 'LIST_ERROR':
      // Drop the pagination token: ItemList auto-triggers loadNextPage during
      // render while hasNextPage && !isLoading, so keeping a token after a
      // failed page-load would re-fire the request every render forever.
      return { ...state, isLoading: false, error: action.error, nextToken: undefined };

    case 'SELECT_ITEM':
      return {
        ...state,
        selectedIndex: Math.max(0, Math.min(action.index, state.nodes.length - 1)),
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
        ...resetListing(),
        searchQuery: '',
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
        selectedIndex: Math.min(state.nodes.length - 1, state.selectedIndex + 1),
      };

    case 'REFRESH_LIST':
      // Force useSearch to re-run for the current query even though it is
      // unchanged (after a mutation). Callers clear the module-level search
      // cache first, so the reload hits the provider. nextToken is dropped so
      // ItemList's auto-paginate cannot fire a stale token mid-refresh.
      return { ...state, searchEpoch: state.searchEpoch + 1, nextToken: undefined };

    case 'SET_LIST_MODE':
    case 'TOGGLE_LIST_MODE': {
      const current = listModeFor(state);
      const mode =
        action.type === 'SET_LIST_MODE' ? action.mode : current === 'tree' ? 'flat' : 'tree';
      if (mode === current) {
        return state;
      }
      // With no active provider there is nothing to key the choice to, so move
      // the default instead — otherwise the toggle would appear to do nothing.
      const listModes = state.activeProviderId
        ? { ...state.listModes, [state.activeProviderId]: mode }
        : state.listModes;
      // The token's *kind* changes with the mode — a SearchResult token is not
      // interchangeable with a BrowseResult token.
      return {
        ...state,
        ...resetListing(),
        listModes,
        defaultListMode: state.activeProviderId ? state.defaultListMode : mode,
        searchQuery: '',
        // Flat mode has no path; drop the stack so returning to tree starts at root.
        branchStack: [],
        rootSelectedIndex: 0,
        searchEpoch: state.searchEpoch + 1,
      };
    }

    case 'ENTER_BRANCH': {
      // Record where the cursor was so LEAVE_BRANCH can put it back. At the
      // root that lives in rootSelectedIndex, since there is no frame for it.
      const parent = state.branchStack.at(-1);
      const stack: BranchFrame[] = [
        ...state.branchStack.slice(0, -1),
        ...(parent ? [{ ...parent, selectedIndex: state.selectedIndex }] : []),
        { path: action.branch.path, name: action.branch.name, selectedIndex: 0 },
      ];
      return {
        ...state,
        ...resetListing(),
        branchStack: stack,
        rootSelectedIndex: parent ? state.rootSelectedIndex : state.selectedIndex,
        searchQuery: '',
        // The list hook keys its effect on searchEpoch; without the bump,
        // entering a branch with an already-empty query would not re-fetch.
        searchEpoch: state.searchEpoch + 1,
      };
    }

    case 'LEAVE_BRANCH': {
      if (state.branchStack.length === 0) {
        return state;
      }
      const stack = state.branchStack.slice(0, -1);
      return {
        ...state,
        ...resetListing(),
        branchStack: stack,
        searchQuery: '',
        searchEpoch: state.searchEpoch + 1,
        // Parked, not applied: the list is empty until the reload lands.
        pendingSelectedIndex: stack.at(-1)?.selectedIndex ?? state.rootSelectedIndex,
      };
    }

    case 'SET_BRANCH_DEPTH': {
      const depth = Math.max(0, Math.min(action.depth, state.branchStack.length));
      if (depth === state.branchStack.length) {
        return state;
      }
      const stack = state.branchStack.slice(0, depth);
      return {
        ...state,
        ...resetListing(),
        branchStack: stack,
        searchQuery: '',
        searchEpoch: state.searchEpoch + 1,
        pendingSelectedIndex: stack.at(-1)?.selectedIndex ?? state.rootSelectedIndex,
      };
    }

    default:
      return state;
  }
}
