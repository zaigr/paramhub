/**
 * Search types for paramhub provider contract.
 */

import type { Item } from './items.js';

/** Options passed to `provider.search()`. */
export interface SearchOptions {
  /** The search query string (matched against paths/names). */
  query: string;
  /**
   * Optional path prefix to scope the search to one subtree.
   *
   * A branch path exactly as produced by `provider.browse()`. The search is
   * recursive — every descendant is eligible, not just direct children.
   */
  pathPrefix?: string;
  /** Maximum number of results to return per page. */
  maxResults?: number;
  /** Pagination token from a previous search result. */
  nextToken?: string;
}

/** Result returned from `provider.search()`. */
export interface SearchResult {
  /** The items matching the search criteria. */
  items: Item[];
  /** Pagination token for the next page, or undefined if no more results. */
  nextToken?: string;
}
