/**
 * AWS SSM Parameter Store provider.
 *
 * Implements the paramhub Provider contract against AWS SDK v3.
 */

import {
  SSMClient,
  DescribeParametersCommand,
  GetParameterCommand,
  GetParametersByPathCommand,
  PutParameterCommand,
  DeleteParameterCommand,
  ListTagsForResourceCommand,
  ResourceTypeForTagging,
  type ParameterStringFilter,
} from '@aws-sdk/client-ssm';
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
import { lastSegment } from '@paramhub/types';
import { AWS_REGIONS } from '@paramhub/aws-common';

import { createSsmClient, createStsClient, describeAwsError } from './auth.js';
import {
  DEFAULT_REGION,
  getConfigSchema,
  listProfiles,
  parseConfig,
  resolveProfile,
} from './config.js';
import {
  buildDetailFields,
  itemTypeToSsmType,
  metadataToItem,
  parameterToItem,
} from './mapper.js';
import { getCommands } from './commands.js';

const DESCRIBE_MAX = 50;
const GET_BY_PATH_MAX = 10;

/** SSM paths are absolute, so the top of the hierarchy is the delimiter itself. */
const SSM_ROOT_PATH = '/';
const SSM_DELIMITER = '/';

/**
 * Page cap for a single browse() scan (20 × 50 = 1000 parameters per branch).
 *
 * browse() must read the whole subtree before it can report a complete branch
 * set (see the docblock on browse), so this bounds a pathological branch rather
 * than paginating.
 */
const BROWSE_MAX_PAGES = 20;

export class AwsSsmProvider implements Provider {
  readonly id = 'aws-ssm';
  readonly displayName = 'AWS SSM Parameter Store';
  readonly icon = '☁️';

  private region = DEFAULT_REGION;
  private profile: string | undefined;
  private decrypt = true;
  private ssm!: SSMClient;
  private sts!: STSClient;
  private account: string | undefined;

  getConfigSchema(): ProviderConfigField[] {
    return getConfigSchema();
  }

  async init(config: Record<string, unknown>): Promise<void> {
    const { region, configuredProfile, decrypt } = parseConfig(config);
    this.region = region;
    this.decrypt = decrypt;
    this.profile = await resolveProfile(configuredProfile);
    this.rebuildClients();
  }

  private rebuildClients(): void {
    this.ssm = createSsmClient(this.region, this.profile);
    this.sts = createStsClient(this.region, this.profile);
    this.account = undefined;
  }

  /**
   * Run an AWS call, rethrowing failures with a descriptive message.
   *
   * AWS errors often carry an empty `.message` (opaque `UnknownError`s,
   * credential failures), which surfaces as a useless "Unknown error" in the
   * UI. Normalize every fallible call through describeAwsError so callers and
   * the status bar always see the real cause (error name + HTTP status).
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
      await this.ssm.send(new DescribeParametersCommand({ MaxResults: 1 }));
      return { ok: true, message: `Connected to AWS SSM (${this.region})` };
    } catch (err) {
      return { ok: false, message: describeAwsError(err) };
    }
  }

  async dispose(): Promise<void> {
    this.ssm?.destroy();
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
      hierarchy: { delimiter: SSM_DELIMITER, rootPath: SSM_ROOT_PATH },
      supportedItemTypes: ['string', 'secure', 'list'],
      customActions: [],
      customTabs: [],
    };
  }

  getCommands(): Command[] {
    return getCommands();
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

  async search(options: SearchOptions): Promise<SearchResult> {
    const { query, pathPrefix, maxResults, nextToken } = options;

    if (pathPrefix) {
      return this.searchByPath(pathPrefix, query, maxResults, nextToken);
    }
    return this.searchByDescribe(query, maxResults, nextToken);
  }

  private async searchByPath(
    pathPrefix: string,
    query: string,
    maxResults: number | undefined,
    nextToken: string | undefined,
  ): Promise<SearchResult> {
    const target = maxResults ?? GET_BY_PATH_MAX;
    const q = query ? query.toLowerCase() : undefined;
    const items: Item[] = [];
    let token = nextToken;

    // GetParametersByPath caps MaxResults at 10 and offers no name filter, so
    // query matching happens client-side. Keep reading pages until we have
    // enough matches or AWS runs out, otherwise a query whose matches sit on
    // later pages would yield an empty first page.
    do {
      const res = await this.run(() =>
        this.ssm.send(
          new GetParametersByPathCommand({
            Path: pathPrefix,
            Recursive: true,
            WithDecryption: false,
            MaxResults: GET_BY_PATH_MAX,
            NextToken: token,
          }),
        ),
      );

      for (const param of res.Parameters ?? []) {
        const item = parameterToItem(param);
        if (
          q === undefined ||
          item.path.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
        ) {
          items.push(item);
        }
      }
      token = res.NextToken;
    } while (token && items.length < target);

    return { items, nextToken: token };
  }

  private async searchByDescribe(
    query: string,
    maxResults: number | undefined,
    nextToken: string | undefined,
  ): Promise<SearchResult> {
    const filters: ParameterStringFilter[] | undefined = query
      ? [{ Key: 'Name', Option: 'Contains', Values: [query] }]
      : undefined;

    const res = await this.run(() =>
      this.ssm.send(
        new DescribeParametersCommand({
          MaxResults: Math.min(maxResults ?? DESCRIBE_MAX, DESCRIBE_MAX),
          NextToken: nextToken,
          ParameterFilters: filters,
        }),
      ),
    );

    const items = (res.Parameters ?? []).map((m) =>
      metadataToItem(m, this.region, this.account),
    );
    return { items, nextToken: res.NextToken };
  }

  /**
   * Enumerate the direct children of a branch.
   *
   * SSM has no prefix-enumeration API: GetParametersByPath with
   * Recursive:false returns the *parameters* one level down and never the
   * child prefixes, so `/app/prod/db/host` yields no `db` branch. Branches
   * must therefore be synthesized from a recursive scan of the subtree.
   *
   * DescribeParameters (MaxResults 50) is used rather than
   * GetParametersByPath (hard cap 10) for 5× fewer round trips, and because
   * its ParameterMetadata maps through metadataToItem — making browse leaves
   * shape-identical to search results (same ARN, tier, dataType).
   *
   * nextToken is always undefined: branches aggregate over the whole subtree,
   * so a partial scan would report a partial branch set and repeat those same
   * branches on the next page. The scan runs to exhaustion behind
   * BROWSE_MAX_PAGES and maxResults is applied as a client-side slice.
   */
  async browse(options: BrowseOptions): Promise<BrowseResult> {
    const { path = SSM_ROOT_PATH, maxResults } = options;

    // Root is already the delimiter; deeper branches ('/app') are not
    // delimiter-terminated, so normalize before matching — otherwise '/app'
    // would also capture '/apple/...'.
    const prefix = path.endsWith(SSM_DELIMITER) ? path : path + SSM_DELIMITER;

    // The Path filter rejects a bare '/', so the root scans unfiltered.
    const filters: ParameterStringFilter[] | undefined =
      prefix === SSM_ROOT_PATH
        ? undefined
        : [{ Key: 'Path', Option: 'Recursive', Values: [path] }];

    const branches = new Map<string, BranchNode>();
    const leaves: LeafNode[] = [];
    let token: string | undefined;
    let pages = 0;

    do {
      const res = await this.run(() =>
        this.ssm.send(
          new DescribeParametersCommand({
            MaxResults: DESCRIBE_MAX,
            NextToken: token,
            ParameterFilters: filters,
          }),
        ),
      );

      for (const meta of res.Parameters ?? []) {
        const name = meta.Name;
        if (!name || !name.startsWith(prefix)) {
          continue;
        }
        const rest = name.slice(prefix.length);
        const cut = rest.indexOf(SSM_DELIMITER);
        if (cut === -1) {
          leaves.push({
            kind: 'leaf',
            item: metadataToItem(meta, this.region, this.account),
          });
          continue;
        }
        // Not delimiter-terminated, matching SSM's own path convention; round
        // trips verbatim into both browse() and GetParametersByPath({ Path }).
        const branchPath = prefix + rest.slice(0, cut);
        if (!branches.has(branchPath)) {
          branches.set(branchPath, {
            kind: 'branch',
            path: branchPath,
            name: lastSegment(branchPath, SSM_DELIMITER),
          });
        }
      }

      token = res.NextToken;
      pages += 1;
    } while (token && pages < BROWSE_MAX_PAGES);

    // Branches before leaves, the order a tree UI renders a level in.
    const nodes: TreeNode[] = [...branches.values(), ...leaves];

    return {
      nodes: maxResults === undefined ? nodes : nodes.slice(0, maxResults),
      nextToken: undefined,
    };
  }

  async getItem(id: string): Promise<Item> {
    const res = await this.run(() =>
      this.ssm.send(
        new DescribeParametersCommand({
          ParameterFilters: [{ Key: 'Name', Option: 'Equals', Values: [id] }],
        }),
      ),
    );
    const meta = res.Parameters?.[0];
    if (!meta) {
      throw new Error(`Parameter not found: ${id}`);
    }
    const item = metadataToItem(meta, this.region, this.account);
    item.metadata.tags = await this.loadTags(id);
    return item;
  }

  private async loadTags(
    name: string,
  ): Promise<Record<string, string> | undefined> {
    try {
      const res = await this.ssm.send(
        new ListTagsForResourceCommand({
          ResourceType: ResourceTypeForTagging.PARAMETER,
          ResourceId: name,
        }),
      );
      const tags = res.TagList ?? [];
      if (tags.length === 0) {
        return undefined;
      }
      return Object.fromEntries(tags.map((t) => [t.Key ?? '', t.Value ?? '']));
    } catch {
      return undefined;
    }
  }

  async getValue(id: string): Promise<string> {
    const res = await this.run(() =>
      this.ssm.send(
        new GetParameterCommand({ Name: id, WithDecryption: this.decrypt }),
      ),
    );
    const value = res.Parameter?.Value;
    if (value === undefined) {
      throw new Error(`Parameter has no value: ${id}`);
    }
    return value;
  }

  getItemDetails(item: Item): DetailField[] {
    return buildDetailFields(item);
  }

  async updateValue(id: string, newValue: string): Promise<void> {
    await this.run(() =>
      this.ssm.send(
        new PutParameterCommand({ Name: id, Value: newValue, Overwrite: true }),
      ),
    );
  }

  async createItem(path: string, value: string, type: ItemType): Promise<Item> {
    const res = await this.run(() =>
      this.ssm.send(
        new PutParameterCommand({
          Name: path,
          Value: value,
          Type: itemTypeToSsmType(type),
          Overwrite: false,
        }),
      ),
    );
    return {
      id: path,
      path,
      name: lastSegment(path),
      type,
      value: undefined,
      metadata: { version: res.Version, lastModified: new Date() },
      providerMetadata: {},
    };
  }

  async deleteItem(id: string): Promise<void> {
    await this.run(() => this.ssm.send(new DeleteParameterCommand({ Name: id })));
  }
}

export const AwsSsmProviderFactory: ProviderFactory = {
  create(): Provider {
    return new AwsSsmProvider();
  },
};
