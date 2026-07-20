/**
 * AWS S3 provider.
 *
 * Implements the paramhub Provider contract against AWS SDK v3. Buckets are the
 * top level of the hierarchy: browsing the root lists buckets, and drilling in
 * walks key prefixes.
 */

import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectTaggingCommand,
  GetBucketLocationCommand,
} from '@aws-sdk/client-s3';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import type {
  BranchNode,
  BrowseOptions,
  BrowseResult,
  Command,
  ConnectionTestResult,
  DetailField,
  Item,
  ItemType,
  LeafNode,
  Provider,
  ProviderCapabilities,
  ProviderConfigField,
  ProviderContext,
  ProviderFactory,
  SearchOptions,
  SearchResult,
  TreeNode,
} from '@paramhub/types';
import { AWS_REGIONS, DEFAULT_REGION, resolveProfile, listProfiles } from '@paramhub/aws-common';

import { createS3Client, createStsClient, describeAwsError } from './auth.js';
import { getConfigSchema, parseConfig, DEFAULT_MAX_VALUE_BYTES } from './config.js';
import {
  S3_DELIMITER,
  buildDetailFields,
  joinS3Path,
  objectItemType,
  objectToItem,
  splitS3Path,
} from './mapper.js';

/** S3 keys have no leading delimiter, so the top of the hierarchy is the empty path. */
const S3_ROOT_PATH = '';

const LIST_MAX = 100;

/** Page cap for a client-side filtered search, so a huge bucket cannot hang the TUI. */
const SEARCH_MAX_PAGES = 20;

export class AwsS3Provider implements Provider {
  readonly id = 'aws-s3';
  readonly displayName = 'AWS S3';
  readonly icon = '🪣';

  private region = DEFAULT_REGION;
  private profile: string | undefined;
  private buckets: string[] = [];
  private maxValueBytes = DEFAULT_MAX_VALUE_BYTES;
  private sts!: STSClient;
  private account: string | undefined;

  /** Default client, and one per resolved bucket region. */
  private clients = new Map<string, S3Client>();
  /** bucket → region, so a cross-region bucket costs one lookup, not one per call. */
  private bucketRegions = new Map<string, string>();

  getConfigSchema(): ProviderConfigField[] {
    return getConfigSchema();
  }

  async init(config: Record<string, unknown>): Promise<void> {
    const parsed = parseConfig(config);
    this.region = parsed.region;
    this.buckets = parsed.buckets;
    this.maxValueBytes = parsed.maxValueBytes;
    this.profile = await resolveProfile(parsed.configuredProfile);
    this.rebuildClients();
  }

  private rebuildClients(): void {
    for (const client of this.clients.values()) {
      client.destroy();
    }
    this.clients.clear();
    this.bucketRegions.clear();
    this.clients.set(this.region, createS3Client(this.region, this.profile));
    this.sts?.destroy();
    this.sts = createStsClient(this.region, this.profile);
    this.account = undefined;
  }

  private clientFor(region: string): S3Client {
    let client = this.clients.get(region);
    if (!client) {
      client = createS3Client(region, this.profile);
      this.clients.set(region, client);
    }
    return client;
  }

  /** The default client — correct for ListBuckets, which is global. */
  private get s3(): S3Client {
    return this.clientFor(this.region);
  }

  /**
   * A client signed for the bucket's own region.
   *
   * followRegionRedirects already makes cross-region calls *correct*, but it
   * costs a wasted round trip every time. Caching the region removes that for
   * everything after the first call.
   */
  private async clientForBucket(bucket: string): Promise<S3Client> {
    const cached = this.bucketRegions.get(bucket);
    if (cached) {
      return this.clientFor(cached);
    }
    try {
      const res = await this.s3.send(new GetBucketLocationCommand({ Bucket: bucket }));
      // us-east-1 reports null/undefined, and eu-west-1 still reports legacy 'EU'.
      const raw = res.LocationConstraint;
      const region = !raw ? 'us-east-1' : raw === 'EU' ? 'eu-west-1' : String(raw);
      this.bucketRegions.set(bucket, region);
      return this.clientFor(region);
    } catch {
      // Best effort: fall back to the default client and let
      // followRegionRedirects sort it out.
      return this.s3;
    }
  }

  /**
   * Run an AWS call, rethrowing failures with a descriptive message.
   *
   * AWS errors often carry an empty `.message`, which surfaces as a useless
   * "Unknown error" in the UI.
   */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw new Error(describeAwsError(err), { cause: err });
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.s3.send(new ListBucketsCommand({}));
      return { ok: true, message: `Connected to AWS S3 (${this.region})` };
    } catch (err) {
      return { ok: false, message: describeAwsError(err) };
    }
  }

  async dispose(): Promise<void> {
    for (const client of this.clients.values()) {
      client.destroy();
    }
    this.clients.clear();
    this.sts?.destroy();
  }

  getCapabilities(): ProviderCapabilities {
    return {
      canEdit: true,
      canDelete: true,
      canCreate: true,
      canSearch: true,
      canSwitchRegion: true,
      canSwitchAccount: true,
      hierarchy: { delimiter: S3_DELIMITER, rootPath: S3_ROOT_PATH },
      supportedItemTypes: ['string', 'json', 'binary'],
      customActions: [],
      customTabs: [],
    };
  }

  getCommands(): Command[] {
    return [];
  }

  async getCurrentContext(): Promise<ProviderContext> {
    if (!this.account) {
      try {
        const res = await this.sts.send(new GetCallerIdentityCommand({}));
        this.account = res.Account;
      } catch {
        // Best-effort: leave account undefined if STS is unavailable.
      }
    }
    const label = this.account ?? this.profile ?? 'aws';
    return {
      account: this.account,
      region: this.region,
      profile: this.profile,
      displayLabel: `${label} / ${this.region}`,
    };
  }

  async getAvailableRegions(): Promise<string[]> {
    return AWS_REGIONS;
  }

  async getAvailableProfiles(): Promise<string[]> {
    return listProfiles();
  }

  async switchRegion(region: string): Promise<void> {
    this.region = region;
    this.rebuildClients();
  }

  async switchProfile(profile: string): Promise<void> {
    this.profile = profile;
    this.rebuildClients();
  }

  /**
   * Enumerate the direct children of a branch.
   *
   * At the root that means buckets; below it, ListObjectsV2 with a delimiter
   * does the prefix grouping server-side. Unlike SSM, S3's
   * NextContinuationToken covers CommonPrefixes and Contents together, so it
   * passes straight through as BrowseResult.nextToken.
   *
   * Branches are emitted before leaves *within a page*. A global ordering is
   * impossible when paging, which the contract permits — it requires only that
   * nodes are direct children and that pages do not repeat.
   */
  async browse(options: BrowseOptions): Promise<BrowseResult> {
    const { path = S3_ROOT_PATH, maxResults = LIST_MAX, nextToken } = options;

    if (path === S3_ROOT_PATH) {
      return this.browseBuckets(maxResults, nextToken);
    }

    const { bucket, key } = splitS3Path(path);
    // Branch paths are always delimiter-terminated, matching S3's own
    // CommonPrefixes convention, so a prefix round-trips untouched.
    const prefix = key === '' || key.endsWith(S3_DELIMITER) ? key : key + S3_DELIMITER;
    const client = await this.clientForBucket(bucket);

    const res = await this.run(() =>
      client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: S3_DELIMITER,
          MaxKeys: maxResults,
          ContinuationToken: nextToken,
        }),
      ),
    );

    const branches: BranchNode[] = (res.CommonPrefixes ?? []).flatMap((cp) => {
      const p = cp.Prefix;
      if (!p) return [];
      const full = joinS3Path(bucket, p);
      return [
        {
          kind: 'branch',
          path: full,
          // Trailing delimiter stripped before taking the last segment.
          name: p.slice(prefix.length).replace(/\/$/, ''),
        },
      ];
    });

    const leaves: LeafNode[] = (res.Contents ?? []).flatMap((o) => {
      const k = o.Key;
      // Skip the zero-byte marker object consoles create for a "folder";
      // otherwise every branch shows a phantom empty-named leaf.
      if (!k || k === prefix) return [];
      return [
        {
          kind: 'leaf',
          item: objectToItem({
            bucket,
            key: k,
            size: o.Size,
            lastModified: o.LastModified,
            etag: o.ETag,
            storageClass: o.StorageClass,
          }),
        },
      ];
    });

    const nodes: TreeNode[] = [...branches, ...leaves];
    return { nodes, nextToken: res.NextContinuationToken };
  }

  private async browseBuckets(
    maxResults: number,
    nextToken: string | undefined,
  ): Promise<BrowseResult> {
    const res = await this.run(() => this.s3.send(new ListBucketsCommand({})));
    const all: TreeNode[] = (res.Buckets ?? []).flatMap((b) =>
      b.Name
        ? [{ kind: 'branch' as const, path: b.Name + S3_DELIMITER, name: b.Name }]
        : [],
    );

    // ListBuckets pagination is recent and unevenly available, so page the
    // (small, bounded) result client-side with an index token.
    const start = nextToken ? Number.parseInt(nextToken, 10) : 0;
    const end = start + maxResults;
    return {
      nodes: all.slice(start, end),
      nextToken: end < all.length ? String(end) : undefined,
    };
  }

  /**
   * Find objects by substring.
   *
   * S3 has no server-side name filter, so matching is client-side over a
   * prefix listing — which means paging must continue until enough matches
   * accumulate, or matches that sit on later pages would vanish.
   *
   * Needs somewhere to scan: either a `pathPrefix` naming the bucket, or
   * `buckets` in the provider config. Flat mode never scopes, so it is the
   * configured buckets or nothing.
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const { query, pathPrefix, maxResults = 20, nextToken } = options;

    if (pathPrefix) {
      const { bucket, key } = splitS3Path(pathPrefix);
      return this.searchBucket(bucket, key, query, maxResults, nextToken);
    }

    if (this.buckets.length === 0) {
      // Nothing to scope the scan to, and fanning out over every bucket in the
      // account would hang the TUI. Fail loudly rather than returning an empty
      // list: silently showing nothing reads as "this store is empty" when the
      // real cause is a missing setting the user can fix.
      throw new Error(
        'AWS S3 flat mode needs "buckets" configured — press t to browse buckets as a tree',
      );
    }

    return this.searchConfiguredBuckets(query, maxResults, nextToken);
  }

  /**
   * Scan one bucket, filtering client-side.
   *
   * Cursors are `StartAfter` keys rather than S3 continuation tokens: filtering
   * means a page can yield more matches than `maxResults`, and an opaque
   * continuation token cannot resume from the middle of a page. S3 lists keys in
   * lexicographic order, so the last key emitted is an exact, resumable cursor.
   */
  private async searchBucket(
    bucket: string,
    prefix: string,
    query: string,
    maxResults: number,
    startAfter: string | undefined,
  ): Promise<SearchResult> {
    const q = query ? query.toLowerCase() : undefined;
    const client = await this.clientForBucket(bucket);
    const items: Item[] = [];
    let cursor = startAfter;
    let pages = 0;
    let exhausted = false;

    while (items.length < maxResults && pages < SEARCH_MAX_PAGES) {
      const res = await this.run(() =>
        client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            // No Delimiter: pathPrefix search is documented as recursive.
            MaxKeys: LIST_MAX,
            StartAfter: cursor,
          }),
        ),
      );
      pages += 1;

      const contents = res.Contents ?? [];
      if (contents.length === 0) {
        exhausted = true;
        break;
      }

      let truncated = false;
      for (const o of contents) {
        const key = o.Key;
        if (!key) continue;
        cursor = key;
        // Skip the zero-byte markers that stand in for a prefix.
        if (key.endsWith(S3_DELIMITER)) continue;

        const item = objectToItem({
          bucket,
          key,
          size: o.Size,
          lastModified: o.LastModified,
          etag: o.ETag,
          storageClass: o.StorageClass,
        });
        if (
          q === undefined ||
          item.path.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
        ) {
          items.push(item);
          if (items.length >= maxResults) {
            truncated = true;
            break;
          }
        }
      }

      if (truncated) {
        break;
      }
      if (!res.IsTruncated) {
        exhausted = true;
        break;
      }
    }

    return { items, nextToken: exhausted ? undefined : cursor };
  }

  /** Fan out across the configured buckets, with a `<bucketIndex>:<token>` cursor. */
  private async searchConfiguredBuckets(
    query: string,
    maxResults: number,
    nextToken: string | undefined,
  ): Promise<SearchResult> {
    let index = 0;
    let token: string | undefined;
    if (nextToken) {
      const cut = nextToken.indexOf(':');
      index = Number.parseInt(nextToken.slice(0, cut), 10);
      token = nextToken.slice(cut + 1) || undefined;
    }

    const items: Item[] = [];
    while (index < this.buckets.length && items.length < maxResults) {
      const bucket = this.buckets[index]!;
      const page = await this.searchBucket(bucket, '', query, maxResults - items.length, token);
      items.push(...page.items);

      if (page.nextToken) {
        return { items, nextToken: `${index}:${page.nextToken}` };
      }
      index += 1;
      token = undefined;
    }

    return {
      items,
      nextToken: index < this.buckets.length ? `${index}:` : undefined,
    };
  }

  async getItem(id: string): Promise<Item> {
    const { bucket, key } = splitS3Path(id);
    const client = await this.clientForBucket(bucket);
    const res = await this.run(() =>
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    );

    const item = objectToItem({
      bucket,
      key,
      size: res.ContentLength,
      lastModified: res.LastModified,
      etag: res.ETag,
      storageClass: res.StorageClass,
      contentType: res.ContentType,
      versionId: res.VersionId,
      serverSideEncryption: res.ServerSideEncryption,
    });
    item.metadata.tags = await this.loadTags(bucket, key);
    return item;
  }

  private async loadTags(
    bucket: string,
    key: string,
  ): Promise<Record<string, string> | undefined> {
    try {
      const client = await this.clientForBucket(bucket);
      const res = await client.send(
        new GetObjectTaggingCommand({ Bucket: bucket, Key: key }),
      );
      const tags = res.TagSet ?? [];
      if (tags.length === 0) {
        return undefined;
      }
      return Object.fromEntries(tags.map((t) => [t.Key ?? '', t.Value ?? '']));
    } catch {
      return undefined;
    }
  }

  async getValue(id: string): Promise<string> {
    const { bucket, key } = splitS3Path(id);
    const client = await this.clientForBucket(bucket);

    const res = await this.run(() =>
      client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    );

    if (objectItemType(key, res.ContentType) === 'binary') {
      throw new Error(`Object is binary and cannot be displayed: ${key}`);
    }

    const size = res.ContentLength ?? 0;
    if (size > this.maxValueBytes) {
      // Rejected rather than truncated: the edit flow writes this value back,
      // so a truncated read would silently destroy the tail of the object.
      throw new Error(
        `Object too large to display (${formatBytes(size)}, limit ${formatBytes(this.maxValueBytes)})`,
      );
    }

    const body = res.Body;
    if (!body) {
      throw new Error(`Object has no body: ${key}`);
    }
    return body.transformToString();
  }

  getItemDetails(item: Item): DetailField[] {
    return buildDetailFields(item);
  }

  async updateValue(id: string, newValue: string): Promise<void> {
    const { bucket, key } = splitS3Path(id);
    const client = await this.clientForBucket(bucket);

    // Preserve the existing Content-Type; PutObject would otherwise reset it to
    // the SDK default and reclassify the object on the next read.
    let contentType: string | undefined;
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      contentType = head.ContentType;
    } catch {
      // New or inaccessible: let S3 pick.
    }

    await this.run(() =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: newValue,
          ContentType: contentType,
        }),
      ),
    );
  }

  async createItem(path: string, value: string, type: ItemType): Promise<Item> {
    const { bucket, key } = splitS3Path(path);
    const client = await this.clientForBucket(bucket);
    const contentType = type === 'json' ? 'application/json' : 'text/plain';

    const res = await this.run(() =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: value,
          ContentType: contentType,
        }),
      ),
    );

    return objectToItem({
      bucket,
      key,
      size: Buffer.byteLength(value),
      lastModified: new Date(),
      etag: res.ETag,
      contentType,
      versionId: res.VersionId,
    });
  }

  async deleteItem(id: string): Promise<void> {
    const { bucket, key } = splitS3Path(id);
    const client = await this.clientForBucket(bucket);
    await this.run(() => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })));
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AwsS3ProviderFactory: ProviderFactory = {
  create(): Provider {
    return new AwsS3Provider();
  },
};
