import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  SSMClient,
  DescribeParametersCommand,
  GetParameterCommand,
  GetParametersByPathCommand,
  PutParameterCommand,
  DeleteParameterCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-ssm';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { runProviderConformanceTests } from '@paramhub/types/testing';

import { AwsSsmProviderFactory, AwsSsmProvider } from '../src/index.js';
import { ssmTypeToItemType, itemTypeToSsmType } from '../src/mapper.js';

const ACCOUNT = '123456789012';
const REGION = 'us-east-1';

interface StoredParam {
  Name: string;
  Type: 'String' | 'StringList' | 'SecureString';
  Value: string;
  Version: number;
  LastModifiedDate: Date;
  DataType: string;
}

const ssmMock = mockClient(SSMClient);
const stsMock = mockClient(STSClient);

let store: Map<string, StoredParam>;

function arnFor(name: string): string {
  return `arn:aws:ssm:${REGION}:${ACCOUNT}:parameter${name}`;
}

function seedStore(): void {
  store = new Map();
  const seed: Array<
    Omit<StoredParam, 'Version' | 'LastModifiedDate' | 'DataType'>
  > = [
    { Name: '/app/prod/api/key', Type: 'SecureString', Value: 'prod-api-key' },
    { Name: '/app/prod/db/host', Type: 'String', Value: 'prod-db.example.com' },
    {
      Name: '/app/prod/db/password',
      Type: 'SecureString',
      Value: 'prod-secret',
    },
    {
      Name: '/app/staging/db/host',
      Type: 'String',
      Value: 'staging-db.example.com',
    },
    { Name: '/app/staging/feature-flags', Type: 'StringList', Value: 'a,b,c' },
    { Name: '/shared/region', Type: 'String', Value: 'us-east-1' },
  ];
  for (const s of seed) {
    store.set(s.Name, {
      ...s,
      Version: 1,
      LastModifiedDate: new Date('2024-01-01T00:00:00Z'),
      DataType: 'text',
    });
  }
}

function sorted(): StoredParam[] {
  return [...store.values()].sort((a, b) => a.Name.localeCompare(b.Name));
}

function applyFilters(
  params: StoredParam[],
  filters:
    | Array<{ Key?: string; Option?: string; Values?: string[] }>
    | undefined,
): StoredParam[] {
  if (!filters) return params;
  return params.filter((p) =>
    filters.every((f) => {
      const value = f.Values?.[0] ?? '';
      if (f.Key === 'Path') {
        // AWS matches on a segment boundary, so '/app' never captures '/apple/x'.
        const prefix = value.endsWith('/') ? value : value + '/';
        if (f.Option === 'OneLevel') {
          return p.Name.startsWith(prefix) && !p.Name.slice(prefix.length).includes('/');
        }
        return p.Name.startsWith(prefix); // Recursive (default)
      }
      if (f.Key !== 'Name') return true;
      if (f.Option === 'Equals') return p.Name === value;
      if (f.Option === 'BeginsWith') return p.Name.startsWith(value);
      return p.Name.includes(value); // Contains (default)
    }),
  );
}

function paginate<T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: string | undefined,
): { page: T[]; nextToken: string | undefined } {
  const start = nextToken ? parseInt(nextToken, 10) : 0;
  const end = start + (maxResults ?? items.length);
  return {
    page: items.slice(start, end),
    nextToken: end < items.length ? String(end) : undefined,
  };
}

function installHandlers(): void {
  ssmMock.on(DescribeParametersCommand).callsFake((input) => {
    const filtered = applyFilters(sorted(), input.ParameterFilters);
    const { page, nextToken } = paginate(
      filtered,
      input.MaxResults,
      input.NextToken,
    );
    return {
      Parameters: page.map((p) => ({
        Name: p.Name,
        Type: p.Type,
        Version: p.Version,
        LastModifiedDate: p.LastModifiedDate,
        LastModifiedUser: 'arn:aws:iam::123456789012:user/test',
        Tier: 'Standard',
        DataType: p.DataType,
        ARN: arnFor(p.Name),
      })),
      NextToken: nextToken,
    };
  });

  ssmMock.on(GetParametersByPathCommand).callsFake((input) => {
    const prefix = input.Path ?? '';
    const matched = sorted().filter((p) => p.Name.startsWith(prefix));
    const { page, nextToken } = paginate(
      matched,
      input.MaxResults,
      input.NextToken,
    );
    return {
      Parameters: page.map((p) => ({
        Name: p.Name,
        Type: p.Type,
        Value: p.Value,
        Version: p.Version,
        LastModifiedDate: p.LastModifiedDate,
        DataType: p.DataType,
        ARN: arnFor(p.Name),
      })),
      NextToken: nextToken,
    };
  });

  ssmMock.on(GetParameterCommand).callsFake((input) => {
    const p = store.get(input.Name ?? '');
    if (!p) {
      const err = new Error(`ParameterNotFound: ${input.Name}`);
      err.name = 'ParameterNotFound';
      throw err;
    }
    return {
      Parameter: {
        Name: p.Name,
        Type: p.Type,
        Value: p.Value,
        Version: p.Version,
        LastModifiedDate: p.LastModifiedDate,
        DataType: p.DataType,
        ARN: arnFor(p.Name),
      },
    };
  });

  ssmMock.on(PutParameterCommand).callsFake((input) => {
    const name = input.Name as string;
    const existing = store.get(name);
    if (existing && !input.Overwrite) {
      const err = new Error(`ParameterAlreadyExists: ${name}`);
      err.name = 'ParameterAlreadyExists';
      throw err;
    }
    if (existing) {
      existing.Value = input.Value as string;
      existing.Version += 1;
      existing.LastModifiedDate = new Date();
      return { Version: existing.Version, Tier: 'Standard' };
    }
    store.set(name, {
      Name: name,
      Type: (input.Type as StoredParam['Type']) ?? 'String',
      Value: input.Value as string,
      Version: 1,
      LastModifiedDate: new Date(),
      DataType: 'text',
    });
    return { Version: 1, Tier: 'Standard' };
  });

  ssmMock.on(DeleteParameterCommand).callsFake((input) => {
    if (!store.has(input.Name ?? '')) {
      const err = new Error(`ParameterNotFound: ${input.Name}`);
      err.name = 'ParameterNotFound';
      throw err;
    }
    store.delete(input.Name as string);
    return {};
  });

  ssmMock.on(ListTagsForResourceCommand).resolves({ TagList: [] });

  stsMock.on(GetCallerIdentityCommand).resolves({
    Account: ACCOUNT,
    Arn: `arn:aws:iam::${ACCOUNT}:user/test`,
    UserId: 'AIDATEST',
  });
}

function setup(): void {
  ssmMock.reset();
  stsMock.reset();
  seedStore();
  installHandlers();
}

// Install once for the conformance suite (its beforeAll runs after this).
setup();

runProviderConformanceTests(AwsSsmProviderFactory, {
  defaultRegion: REGION,
  defaultProfile: 'default',
});

describe('AwsSsmProvider — type mapping', () => {
  it('maps SSM types to ItemType', () => {
    expect(ssmTypeToItemType('String')).toBe('string');
    expect(ssmTypeToItemType('SecureString')).toBe('secure');
    expect(ssmTypeToItemType('StringList')).toBe('list');
    expect(ssmTypeToItemType(undefined)).toBe('string');
  });

  it('maps ItemType back to SSM types', () => {
    expect(itemTypeToSsmType('secure')).toBe('SecureString');
    expect(itemTypeToSsmType('list')).toBe('StringList');
    expect(itemTypeToSsmType('string')).toBe('String');
    expect(itemTypeToSsmType('json')).toBe('String');
    expect(itemTypeToSsmType('binary')).toBe('String');
  });
});

describe('AwsSsmProvider — behavior', () => {
  let provider: AwsSsmProvider;

  beforeEach(async () => {
    setup();
    provider = new AwsSsmProvider();
    await provider.init({ defaultRegion: REGION, defaultProfile: 'default' });
  });

  it('routes pathPrefix search to GetParametersByPath', async () => {
    const result = await provider.search({
      query: '',
      pathPrefix: '/app/prod',
    });
    expect(
      ssmMock.commandCalls(GetParametersByPathCommand).length,
    ).toBeGreaterThan(0);
    expect(ssmMock.commandCalls(DescribeParametersCommand).length).toBe(0);
    expect(result.items.length).toBe(3);
    for (const item of result.items) {
      expect(item.path.startsWith('/app/prod')).toBe(true);
      expect(item.value).toBeUndefined();
    }
  });

  function addParam(name: string): void {
    store.set(name, {
      Name: name,
      Type: 'String',
      Value: 'v',
      Version: 1,
      LastModifiedDate: new Date('2024-01-01T00:00:00Z'),
      DataType: 'text',
    });
  }

  it('collects path-search matches that fall on later AWS pages', async () => {
    // Page size is 10; matches must sort after a full page of non-matches.
    for (let i = 0; i < 11; i++) {
      addParam(`/bulk/aaa-${String(i).padStart(2, '0')}`);
    }
    addParam('/bulk/zzz-match-1');
    addParam('/bulk/zzz-match-2');

    const result = await provider.search({
      query: 'zzz-match',
      pathPrefix: '/bulk',
    });

    expect(result.items.map((i) => i.name).sort()).toEqual([
      'zzz-match-1',
      'zzz-match-2',
    ]);
    expect(
      ssmMock.commandCalls(GetParametersByPathCommand).length,
    ).toBeGreaterThan(1);
  });

  it('stops path search at target and paginates the rest', async () => {
    for (let i = 0; i < 25; i++) {
      addParam(`/page/p-${String(i).padStart(2, '0')}`);
    }

    const page1 = await provider.search({
      query: '',
      pathPrefix: '/page',
      maxResults: 5,
    });
    expect(page1.items.length).toBeGreaterThanOrEqual(5);
    expect(page1.nextToken).toBeDefined();

    const page2 = await provider.search({
      query: '',
      pathPrefix: '/page',
      maxResults: 5,
      nextToken: page1.nextToken,
    });
    expect(page2.items.length).toBeGreaterThan(0);

    const page1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it('declares a hierarchy so the app can browse it as a tree', () => {
    expect(provider.getCapabilities().hierarchy).toEqual({
      delimiter: '/',
      rootPath: '/',
    });
  });

  it('browses the root into top-level branches only', async () => {
    const result = await provider.browse({});
    expect(result.nodes.map((n) => (n.kind === 'branch' ? n.path : n.item.id))).toEqual([
      '/app',
      '/shared',
    ]);
    expect(result.nodes.every((n) => n.kind === 'branch')).toBe(true);
    // A recursive scan cannot page without repeating branches; see browse()'s docblock.
    expect(result.nextToken).toBeUndefined();
  });

  it('browses a branch into its direct children, branches before leaves', async () => {
    const result = await provider.browse({ path: '/app/staging' });
    expect(result.nodes).toEqual([
      { kind: 'branch', path: '/app/staging/db', name: 'db' },
      expect.objectContaining({ kind: 'leaf' }),
    ]);
    const leaf = result.nodes[1]!;
    expect(leaf.kind === 'leaf' && leaf.item.path).toBe('/app/staging/feature-flags');
    // Search results and browse leaves must agree: metadataToItem supplies the ARN.
    expect(leaf.kind === 'leaf' && leaf.item.metadata.version).toBe(1);
    expect(leaf.kind === 'leaf' && leaf.item.value).toBeUndefined();
  });

  it('does not capture a sibling branch sharing a name prefix', async () => {
    addParam('/apple/decoy');
    const result = await provider.browse({ path: '/app' });
    const paths = result.nodes.map((n) => (n.kind === 'branch' ? n.path : n.item.id));
    expect(paths).toEqual(['/app/prod', '/app/staging']);
    expect(paths).not.toContain('/apple/decoy');
  });

  it('applies maxResults as a client-side slice', async () => {
    const result = await provider.browse({ maxResults: 1 });
    expect(result.nodes.length).toBe(1);
  });

  it('reports canSwitchAccount since profile switching is supported', () => {
    expect(provider.getCapabilities().canSwitchAccount).toBe(true);
  });

  it('routes query search to DescribeParameters with a Contains filter', async () => {
    const result = await provider.search({ query: 'host' });
    const calls = ssmMock.commandCalls(DescribeParametersCommand);
    expect(calls.length).toBe(1);
    expect(calls[0]!.args[0].input.ParameterFilters).toEqual([
      { Key: 'Name', Option: 'Contains', Values: ['host'] },
    ]);
    expect(result.items.length).toBe(2);
  });

  it('passes WithDecryption based on config', async () => {
    await provider.getValue('/app/prod/db/password');
    expect(
      ssmMock.commandCalls(GetParameterCommand)[0]!.args[0].input
        .WithDecryption,
    ).toBe(true);

    setup();
    const plain = new AwsSsmProvider();
    await plain.init({ defaultRegion: REGION, decryptSecureStrings: false });
    await plain.getValue('/app/prod/db/host');
    expect(
      ssmMock.commandCalls(GetParameterCommand)[0]!.args[0].input
        .WithDecryption,
    ).toBe(false);
  });

  it('maps ItemType to SSM Type on createItem', async () => {
    await provider.createItem('/app/new/list', 'a,b', 'list');
    const put = ssmMock.commandCalls(PutParameterCommand)[0]!.args[0].input;
    expect(put.Type).toBe('StringList');
    expect(put.Overwrite).toBe(false);
  });

  it('throws on getItem for a missing parameter', async () => {
    await expect(provider.getItem('/does/not/exist')).rejects.toThrow();
  });

  it('builds a displayLabel with the account from STS', async () => {
    const ctx = await provider.getCurrentContext();
    expect(ctx.account).toBe(ACCOUNT);
    expect(ctx.displayLabel).toBe(`${ACCOUNT} / ${REGION}`);
  });

  it('exposes a copy-arn command gated on a selected item', () => {
    const cmd = provider.getCommands().find((c) => c.id === 'aws-ssm:copy-arn');
    expect(cmd).toBeDefined();
    expect(
      cmd!.isEnabled!({
        activeProviderId: 'aws-ssm',
        view: 'list',
        selectedItem: null,
        searchQuery: '',
      }),
    ).toBe(false);
  });
});
