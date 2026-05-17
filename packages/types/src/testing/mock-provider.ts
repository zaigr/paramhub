/**
 * Mock provider for testing and development.
 *
 * Implements the full Provider interface with in-memory data,
 * useful for testing the TUI without cloud credentials and for
 * running the conformance test suite.
 */

import type {
  Provider,
  ProviderFactory,
  ProviderContext,
  ProviderCapabilities,
  ProviderConfigField,
  ConnectionTestResult,
  Item,
  ItemType,
  DetailField,
  SearchOptions,
  SearchResult,
  Command,
  CommandContext,
} from '../index.js';

/** Pre-populated mock items simulating a typical SSM parameter store. */
const MOCK_ITEMS: Item[] = [
  {
    id: '/app/production/database/host',
    path: '/app/production/database/host',
    name: 'host',
    type: 'string',
    value: 'prod-db.cluster-abc123.us-east-1.rds.amazonaws.com',
    metadata: {
      lastModified: new Date('2024-11-15T10:30:00Z'),
      version: 3,
      createdBy: 'admin@company.com',
      size: 52,
      tags: { environment: 'production', service: 'api' },
    },
  },
  {
    id: '/app/production/database/password',
    path: '/app/production/database/password',
    name: 'password',
    type: 'secure',
    value: 'super-secret-prod-password-123!',
    metadata: {
      lastModified: new Date('2024-12-01T08:00:00Z'),
      version: 7,
      createdBy: 'admin@company.com',
      size: 31,
      tags: { environment: 'production', service: 'api', sensitive: 'true' },
    },
  },
  {
    id: '/app/production/database/port',
    path: '/app/production/database/port',
    name: 'port',
    type: 'string',
    value: '5432',
    metadata: {
      lastModified: new Date('2024-10-01T12:00:00Z'),
      version: 1,
      createdBy: 'admin@company.com',
      size: 4,
      tags: { environment: 'production', service: 'api' },
    },
  },
  {
    id: '/app/production/api/config',
    path: '/app/production/api/config',
    name: 'config',
    type: 'json',
    value: JSON.stringify(
      { rateLimit: 1000, timeout: 30, retries: 3 },
      null,
      2,
    ),
    metadata: {
      lastModified: new Date('2024-11-20T14:15:00Z'),
      version: 5,
      createdBy: 'devops@company.com',
      size: 52,
      tags: { environment: 'production', service: 'api' },
    },
  },
  {
    id: '/app/production/api/allowed-origins',
    path: '/app/production/api/allowed-origins',
    name: 'allowed-origins',
    type: 'list',
    value: 'https://app.example.com,https://admin.example.com',
    metadata: {
      lastModified: new Date('2024-11-10T09:00:00Z'),
      version: 2,
      createdBy: 'devops@company.com',
      size: 49,
      tags: { environment: 'production', service: 'api' },
    },
  },
  {
    id: '/app/staging/database/host',
    path: '/app/staging/database/host',
    name: 'host',
    type: 'string',
    value: 'staging-db.cluster-xyz789.us-east-1.rds.amazonaws.com',
    metadata: {
      lastModified: new Date('2024-11-01T11:00:00Z'),
      version: 2,
      createdBy: 'developer@company.com',
      size: 55,
      tags: { environment: 'staging', service: 'api' },
    },
  },
  {
    id: '/app/staging/database/password',
    path: '/app/staging/database/password',
    name: 'password',
    type: 'secure',
    value: 'staging-password-456',
    metadata: {
      lastModified: new Date('2024-11-05T16:30:00Z'),
      version: 4,
      createdBy: 'developer@company.com',
      size: 20,
      tags: { environment: 'staging', service: 'api' },
    },
  },
  {
    id: '/app/staging/feature-flags',
    path: '/app/staging/feature-flags',
    name: 'feature-flags',
    type: 'json',
    value: JSON.stringify(
      { darkMode: true, betaFeatures: true, newCheckout: false },
      null,
      2,
    ),
    metadata: {
      lastModified: new Date('2024-12-10T13:45:00Z'),
      version: 12,
      createdBy: 'developer@company.com',
      size: 60,
      tags: { environment: 'staging', service: 'frontend' },
    },
  },
  {
    id: '/shared/encryption/key-id',
    path: '/shared/encryption/key-id',
    name: 'key-id',
    type: 'string',
    value: 'arn:aws:kms:us-east-1:123456789012:key/mrk-abc123def456',
    metadata: {
      lastModified: new Date('2024-09-01T10:00:00Z'),
      version: 1,
      createdBy: 'security@company.com',
      size: 56,
      tags: { service: 'encryption', team: 'security' },
    },
  },
  {
    id: '/shared/notification/webhook-url',
    path: '/shared/notification/webhook-url',
    name: 'webhook-url',
    type: 'secure',
    value: 'https://example.com/webhook/mock-url',
    metadata: {
      lastModified: new Date('2024-10-15T08:30:00Z'),
      version: 2,
      createdBy: 'devops@company.com',
      size: 78,
      tags: { service: 'notifications', team: 'platform' },
    },
  },
];

/**
 * In-memory mock provider implementing the full Provider interface.
 *
 * Supports search (path/name filtering), CRUD operations, and
 * contributes example commands to the command registry.
 */
export class MockProvider implements Provider {
  readonly id = 'mock';
  readonly displayName = 'Mock Provider';
  readonly icon = '🧪';

  private items: Item[] = [];
  private config: Record<string, unknown> = {};
  private initialized = false;
  private region = 'us-east-1';
  private profile = 'default';

  getConfigSchema(): ProviderConfigField[] {
    return [
      {
        key: 'defaultRegion',
        label: 'Default Region',
        type: 'select',
        required: false,
        default: 'us-east-1',
        options: ['us-east-1', 'us-west-2', 'eu-west-1'],
      },
      {
        key: 'defaultProfile',
        label: 'Default Profile',
        type: 'string',
        required: false,
        default: 'default',
      },
    ];
  }

  async init(config: Record<string, unknown>): Promise<void> {
    this.config = config;
    this.region =
      (config.defaultRegion as string | undefined) ?? 'us-east-1';
    this.profile =
      (config.defaultProfile as string | undefined) ?? 'default';
    // Deep-clone mock items so mutations don't affect the template
    this.items = MOCK_ITEMS.map((item) => ({
      ...item,
      metadata: { ...item.metadata, tags: { ...item.metadata.tags } },
    }));
    this.initialized = true;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.initialized) {
      return { ok: false, message: 'Provider not initialized' };
    }
    return { ok: true, message: 'Mock provider connected' };
  }

  async dispose(): Promise<void> {
    this.items = [];
    this.initialized = false;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      canEdit: true,
      canDelete: true,
      canCreate: true,
      canSearch: true,
      canSwitchRegion: true,
      canSwitchAccount: false,
      supportedItemTypes: ['string', 'secure', 'binary', 'json', 'list'],
      customActions: [
        {
          id: 'copy-path',
          label: 'Copy Path',
          hotkey: 'y',
          execute: async (item: Item) => ({
            message: `Copied path: ${item.path}`,
            refreshList: false,
          }),
        },
        {
          id: 'show-tags',
          label: 'Show Tags',
          execute: async (item: Item) => ({
            message: `Tags: ${JSON.stringify(item.metadata.tags ?? {})}`,
            refreshList: false,
          }),
        },
      ],
      customTabs: [],
    };
  }

  getCommands(): Command[] {
    return [
      {
        id: 'mock:copy-path',
        label: 'Copy Parameter Path',
        description: 'Copy the full path of the selected parameter',
        category: 'item',
        hotkey: 'y',
        isEnabled: (ctx: CommandContext) => ctx.selectedItem !== null,
        execute: async (_ctx: CommandContext) => {
          // In a real implementation, this would copy to clipboard
        },
      },
      {
        id: 'mock:show-type',
        label: 'Show Parameter Type',
        description: 'Display the type of the selected parameter',
        category: 'item',
        isEnabled: (ctx: CommandContext) => ctx.selectedItem !== null,
        execute: async (_ctx: CommandContext) => {
          // In a real implementation, this would show a notification
        },
      },
      {
        id: 'mock:refresh',
        label: 'Refresh Parameters',
        description: 'Reload all parameters from the store',
        category: 'provider',
        hotkey: 'ctrl+shift+r',
        execute: async (_ctx: CommandContext) => {
          // In a real implementation, this would clear cache and re-fetch
        },
      },
    ];
  }

  async getCurrentContext(): Promise<ProviderContext> {
    return {
      account: '123456789012',
      region: this.region,
      profile: this.profile,
      displayLabel: `123456789012 / ${this.region}`,
    };
  }

  async getAvailableRegions(): Promise<string[]> {
    return ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
  }

  async getAvailableProfiles(): Promise<string[]> {
    return ['default', 'production', 'staging'];
  }

  async switchRegion(region: string): Promise<void> {
    this.region = region;
  }

  async switchProfile(profile: string): Promise<void> {
    this.profile = profile;
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    const { query, pathPrefix, maxResults = 10, nextToken } = options;

    let filtered = this.items;

    // Filter by path prefix
    if (pathPrefix) {
      filtered = filtered.filter((item) => item.path.startsWith(pathPrefix));
    }

    // Filter by query (match against path and name)
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.path.toLowerCase().includes(lowerQuery) ||
          item.name.toLowerCase().includes(lowerQuery),
      );
    }

    // Pagination
    const startIndex = nextToken ? parseInt(nextToken, 10) : 0;
    const endIndex = startIndex + maxResults;
    const pageItems = filtered.slice(startIndex, endIndex);

    return {
      items: pageItems.map((item) => ({
        ...item,
        // Don't include value in search results (must call getValue explicitly)
        value: undefined,
      })),
      nextToken:
        endIndex < filtered.length ? String(endIndex) : undefined,
    };
  }

  async getItem(id: string): Promise<Item> {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      throw new Error(`Item not found: ${id}`);
    }
    // Return without value (caller must use getValue for that)
    return { ...item, value: undefined };
  }

  async getValue(id: string): Promise<string> {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      throw new Error(`Item not found: ${id}`);
    }
    if (item.value === undefined) {
      throw new Error(`Item has no value: ${id}`);
    }
    return item.value;
  }

  getItemDetails(item: Item): DetailField[] {
    const details: DetailField[] = [
      { label: 'Path', value: item.path, copyable: true },
      { label: 'Type', value: item.type },
      { label: 'ID', value: item.id, copyable: true },
    ];

    if (item.metadata.lastModified) {
      details.push({
        label: 'Last Modified',
        value: item.metadata.lastModified.toISOString(),
      });
    }
    if (item.metadata.version !== undefined) {
      details.push({ label: 'Version', value: String(item.metadata.version) });
    }
    if (item.metadata.createdBy) {
      details.push({ label: 'Created By', value: item.metadata.createdBy });
    }
    if (item.metadata.size !== undefined) {
      details.push({
        label: 'Size',
        value: `${item.metadata.size} bytes`,
      });
    }
    if (item.metadata.tags && Object.keys(item.metadata.tags).length > 0) {
      details.push({
        label: 'Tags',
        value: Object.entries(item.metadata.tags)
          .map(([k, v]) => `${k}=${v}`)
          .join(', '),
      });
    }

    return details;
  }

  async updateValue(id: string, newValue: string): Promise<void> {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      throw new Error(`Item not found: ${id}`);
    }
    item.value = newValue;
    item.metadata.version = (item.metadata.version ?? 0) + 1;
    item.metadata.lastModified = new Date();
    item.metadata.size = newValue.length;
  }

  async createItem(path: string, value: string, type: ItemType): Promise<Item> {
    const existing = this.items.find((i) => i.path === path);
    if (existing) {
      throw new Error(`Item already exists: ${path}`);
    }

    const segments = path.split('/');
    const name = segments[segments.length - 1] ?? path;

    const item: Item = {
      id: path,
      path,
      name,
      type,
      value,
      metadata: {
        lastModified: new Date(),
        version: 1,
        createdBy: 'mock-user',
        size: value.length,
        tags: {},
      },
    };

    this.items.push(item);
    return { ...item, value: undefined };
  }

  async deleteItem(id: string): Promise<void> {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Item not found: ${id}`);
    }
    this.items.splice(index, 1);
  }
}

/** Factory for creating MockProvider instances. */
export const MockProviderFactory: ProviderFactory = {
  create(): Provider {
    return new MockProvider();
  },
};
