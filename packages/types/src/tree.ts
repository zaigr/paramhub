/**
 * Tree types for paramhub providers that expose a browsable hierarchy.
 *
 * Terminology is tree-shaped (branch/leaf) rather than filesystem-shaped:
 * these are prefixes in a key namespace, not directories.
 */

import type { Item } from './items.js';

/** An interior node — a prefix that groups other nodes. */
export interface BranchNode {
  kind: 'branch';
  /**
   * Provider-opaque branch path.
   *
   * Must round-trip into `browse()` verbatim to enumerate this branch's
   * children. The format is provider-defined (e.g. S3 `app/prod/`,
   * SSM `/app/prod`) — consumers must not normalize, trim, or append delimiters.
   */
  path: string;
  /** Display name — the last path segment, without the delimiter. */
  name: string;
}

/** A terminal node wrapping a concrete item. */
export interface LeafNode {
  kind: 'leaf';
  /** The item at this position. As in search results, `value` is undefined. */
  item: Item;
}

/** A single node in a provider's hierarchy. */
export type TreeNode = BranchNode | LeafNode;

/** Describes a provider's hierarchy. Absent when the provider is flat. */
export interface HierarchyInfo {
  /** Path segment delimiter (e.g. "/"). */
  delimiter: string;
  /** Path to pass to `browse()` for the top level (e.g. "" for S3, "/" for SSM). */
  rootPath: string;
}

/** Options passed to `provider.browse()`. */
export interface BrowseOptions {
  /** Branch to enumerate. Omit to browse `HierarchyInfo.rootPath`. */
  path?: string;
  /** Maximum number of nodes to return per page. */
  maxResults?: number;
  /** Pagination token from a previous browse result. */
  nextToken?: string;
}

/** Result returned from `provider.browse()`. */
export interface BrowseResult {
  /**
   * The direct children of the browsed path.
   *
   * Never recursive: a returned leaf's path must not contain any further
   * delimiter beyond the branch being browsed.
   */
  nodes: TreeNode[];
  /**
   * Pagination token for the next page, or undefined if no more nodes.
   *
   * Opaque and scoped to the provider *and* the browsed path — not
   * interchangeable with a `SearchResult.nextToken`.
   */
  nextToken?: string;
}
