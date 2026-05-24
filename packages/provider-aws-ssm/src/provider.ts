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
  Command,
  ConnectionTestResult,
  DetailField,
  Item,
  ItemType,
  Provider,
  ProviderCapabilities,
  ProviderConfigField,
  ProviderContext,
  ProviderFactory,
  SearchOptions,
  SearchResult,
} from '@paramhub/types';

import { createSsmClient, createStsClient } from './auth.js';
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

/** Common AWS regions offered for switching (SSM has no list-regions API). */
const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'sa-east-1',
];

const DESCRIBE_MAX = 50;
const GET_BY_PATH_MAX = 10;

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

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ssm.send(new DescribeParametersCommand({ MaxResults: 1 }));
      return { ok: true, message: `Connected to AWS SSM (${this.region})` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
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
      const res = await this.ssm.send(
        new GetParametersByPathCommand({
          Path: pathPrefix,
          Recursive: true,
          WithDecryption: false,
          MaxResults: GET_BY_PATH_MAX,
          NextToken: token,
        }),
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

    const res = await this.ssm.send(
      new DescribeParametersCommand({
        MaxResults: Math.min(maxResults ?? DESCRIBE_MAX, DESCRIBE_MAX),
        NextToken: nextToken,
        ParameterFilters: filters,
      }),
    );

    const items = (res.Parameters ?? []).map((m) =>
      metadataToItem(m, this.region, this.account),
    );
    return { items, nextToken: res.NextToken };
  }

  async getItem(id: string): Promise<Item> {
    const res = await this.ssm.send(
      new DescribeParametersCommand({
        ParameterFilters: [{ Key: 'Name', Option: 'Equals', Values: [id] }],
      }),
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
    const res = await this.ssm.send(
      new GetParameterCommand({ Name: id, WithDecryption: this.decrypt }),
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
    await this.ssm.send(
      new PutParameterCommand({ Name: id, Value: newValue, Overwrite: true }),
    );
  }

  async createItem(path: string, value: string, type: ItemType): Promise<Item> {
    const res = await this.ssm.send(
      new PutParameterCommand({
        Name: path,
        Value: value,
        Type: itemTypeToSsmType(type),
        Overwrite: false,
      }),
    );
    const segments = path.split('/').filter(Boolean);
    return {
      id: path,
      path,
      name: segments[segments.length - 1] ?? path,
      type,
      value: undefined,
      metadata: { version: res.Version, lastModified: new Date() },
      providerMetadata: {},
    };
  }

  async deleteItem(id: string): Promise<void> {
    await this.ssm.send(new DeleteParameterCommand({ Name: id }));
  }
}

export const AwsSsmProviderFactory: ProviderFactory = {
  create(): Provider {
    return new AwsSsmProvider();
  },
};
