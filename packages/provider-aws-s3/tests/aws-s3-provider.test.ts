import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
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
import { runProviderConformanceTests } from '@paramhub/types/testing';

import { AwsS3ProviderFactory, AwsS3Provider } from '../src/index.js';
import { splitS3Path, joinS3Path, objectItemType } from '../src/mapper.js';

const ACCOUNT = '123456789012';
const REGION = 'us-east-1';
const BUCKET = 'test-bucket';

interface StoredObject {
  bucket: string;
  key: string;
  body: string;
  contentType?: string;
  lastModified: Date;
}

const s3Mock = mockClient(S3Client);
const stsMock = mockClient(STSClient);

let store: Map<string, StoredObject>;
/** Buckets in the account, in ListBuckets order. */
const BUCKETS = [BUCKET, 'other-bucket'];

function objectKey(bucket: string, key: string): string {
  return `${bucket}/${key}`;
}

function seedStore(): void {
  store = new Map();
  const seed: Array<[string, string, string, string | undefined]> = [
    [BUCKET, 'app/prod/api-key', 'prod-api-key', 'text/plain'],
    [BUCKET, 'app/prod/db-host', 'prod-db.example.com', 'text/plain'],
    [BUCKET, 'app/staging/db-host', 'staging-db.example.com', 'text/plain'],
    [BUCKET, 'app/settings.json', '{"a":1}', 'application/json'],
    [BUCKET, 'shared/region', 'us-east-1', 'text/plain'],
    [BUCKET, 'README.md', '# readme', 'text/plain'],
    // The zero-byte marker object a console creates for a "folder".
    [BUCKET, 'app/prod/', '', undefined],
    ['other-bucket', 'misc/thing', 'value', 'text/plain'],
  ];
  for (const [bucket, key, body, contentType] of seed) {
    store.set(objectKey(bucket, key), {
      bucket,
      key,
      body,
      contentType,
      lastModified: new Date('2024-01-01T00:00:00Z'),
    });
  }
}

function sortedKeys(bucket: string): StoredObject[] {
  return [...store.values()]
    .filter((o) => o.bucket === bucket)
    .sort((a, b) => a.key.localeCompare(b.key));
}

function installHandlers(): void {
  s3Mock.on(ListBucketsCommand).callsFake(() => ({
    Buckets: BUCKETS.map((Name) => ({ Name, CreationDate: new Date('2023-01-01') })),
  }));

  s3Mock.on(GetBucketLocationCommand).resolves({ LocationConstraint: undefined });

  // Honours Prefix, Delimiter, MaxKeys and ContinuationToken the way S3 does:
  // CommonPrefixes and Contents share one page budget and one cursor.
  s3Mock.on(ListObjectsV2Command).callsFake((input) => {
    const bucket = input.Bucket as string;
    const prefix = (input.Prefix as string | undefined) ?? '';
    const delimiter = input.Delimiter as string | undefined;
    const maxKeys = (input.MaxKeys as number | undefined) ?? 1000;
    const start = input.ContinuationToken
      ? Number.parseInt(input.ContinuationToken as string, 10)
      : 0;
    const startAfter = input.StartAfter as string | undefined;

    const matched = sortedKeys(bucket)
      .filter((o) => o.key.startsWith(prefix))
      // StartAfter is exclusive and applies in lexicographic key order.
      .filter((o) => (startAfter ? o.key > startAfter : true));

    const commonPrefixes: string[] = [];
    const contents: StoredObject[] = [];
    for (const o of matched) {
      const rest = o.key.slice(prefix.length);
      const cut = delimiter ? rest.indexOf(delimiter) : -1;
      if (cut === -1) {
        contents.push(o);
      } else {
        const cp = prefix + rest.slice(0, cut + 1);
        if (!commonPrefixes.includes(cp)) commonPrefixes.push(cp);
      }
    }

    // One combined cursor over prefixes-then-contents.
    const combined = [
      ...commonPrefixes.map((p) => ({ kind: 'prefix' as const, value: p })),
      ...contents.map((o) => ({ kind: 'object' as const, value: o })),
    ];
    const page = combined.slice(start, start + maxKeys);
    const end = start + maxKeys;

    return {
      CommonPrefixes: page
        .filter((e) => e.kind === 'prefix')
        .map((e) => ({ Prefix: e.value as string })),
      Contents: page
        .filter((e) => e.kind === 'object')
        .map((e) => {
          const o = e.value as StoredObject;
          return {
            Key: o.key,
            Size: Buffer.byteLength(o.body),
            LastModified: o.lastModified,
            ETag: `"etag-${o.key}"`,
            StorageClass: 'STANDARD',
          };
        }),
      IsTruncated: end < combined.length,
      NextContinuationToken: end < combined.length ? String(end) : undefined,
    };
  });

  s3Mock.on(HeadObjectCommand).callsFake((input) => {
    const o = store.get(objectKey(input.Bucket as string, input.Key as string));
    if (!o) {
      const err = new Error('NoSuchKey');
      err.name = 'NotFound';
      throw err;
    }
    return {
      ContentLength: Buffer.byteLength(o.body),
      LastModified: o.lastModified,
      ETag: `"etag-${o.key}"`,
      ContentType: o.contentType,
      StorageClass: 'STANDARD',
    };
  });

  s3Mock.on(GetObjectCommand).callsFake((input) => {
    const o = store.get(objectKey(input.Bucket as string, input.Key as string));
    if (!o) {
      const err = new Error('NoSuchKey');
      err.name = 'NoSuchKey';
      throw err;
    }
    return {
      ContentLength: Buffer.byteLength(o.body),
      ContentType: o.contentType,
      Body: { transformToString: async () => o.body },
    };
  });

  s3Mock.on(PutObjectCommand).callsFake((input) => {
    const bucket = input.Bucket as string;
    const key = input.Key as string;
    store.set(objectKey(bucket, key), {
      bucket,
      key,
      body: String(input.Body ?? ''),
      contentType: input.ContentType as string | undefined,
      lastModified: new Date(),
    });
    return { ETag: `"etag-${key}"` };
  });

  s3Mock.on(DeleteObjectCommand).callsFake((input) => {
    store.delete(objectKey(input.Bucket as string, input.Key as string));
    return {};
  });

  s3Mock.on(GetObjectTaggingCommand).resolves({ TagSet: [] });

  stsMock.on(GetCallerIdentityCommand).resolves({
    Account: ACCOUNT,
    Arn: `arn:aws:iam::${ACCOUNT}:user/test`,
    UserId: 'AIDATEST',
  });
}

function setup(): void {
  s3Mock.reset();
  stsMock.reset();
  seedStore();
  installHandlers();
}

// Install once for the conformance suite (its beforeAll runs after this).
setup();

// A bucket must be configured: the conformance Search block issues an unscoped
// search and asserts a non-empty result, which the no-bucket cascade cannot serve.
runProviderConformanceTests(AwsS3ProviderFactory, {
  defaultRegion: REGION,
  defaultProfile: 'default',
  buckets: [BUCKET],
});

describe('AwsS3Provider — path mapping', () => {
  it('splits and rejoins bucket/key paths', () => {
    expect(splitS3Path('my-bucket/app/prod/key')).toEqual({
      bucket: 'my-bucket',
      key: 'app/prod/key',
    });
    expect(joinS3Path('my-bucket', 'app/key')).toBe('my-bucket/app/key');
  });

  it('rejects a path with no key separator', () => {
    expect(() => splitS3Path('bucket-only')).toThrow(/expected "<bucket>\/<key>"/);
  });

  it('classifies objects by extension, then content type', () => {
    expect(objectItemType('a/b.json')).toBe('json');
    expect(objectItemType('a/b.yaml')).toBe('string');
    expect(objectItemType('a/db-host')).toBe('string');
    expect(objectItemType('a/blob.bin', 'application/octet-stream')).toBe('binary');
    expect(objectItemType('a/b.txt', 'application/octet-stream')).toBe('string');
    // Never 'secure': S3 encryption is transparent on read.
    expect(objectItemType('a/secret.txt')).not.toBe('secure');
  });
});

describe('AwsS3Provider — behavior', () => {
  let provider: AwsS3Provider;

  beforeEach(async () => {
    setup();
    provider = new AwsS3Provider();
    await provider.init({
      defaultRegion: REGION,
      defaultProfile: 'default',
      buckets: [BUCKET],
    });
  });

  it('declares buckets as the top of the hierarchy', () => {
    expect(provider.getCapabilities().hierarchy).toEqual({ delimiter: '/', rootPath: '' });
  });

  it('browses the root into one branch per bucket', async () => {
    const result = await provider.browse({});
    expect(result.nodes).toEqual([
      { kind: 'branch', path: 'test-bucket/', name: 'test-bucket' },
      { kind: 'branch', path: 'other-bucket/', name: 'other-bucket' },
    ]);
  });

  it('browses a bucket into its top-level prefixes and objects', async () => {
    const result = await provider.browse({ path: 'test-bucket/' });
    const branches = result.nodes.filter((n) => n.kind === 'branch');
    const leaves = result.nodes.filter((n) => n.kind === 'leaf');

    expect(branches.map((b) => (b.kind === 'branch' ? b.path : ''))).toEqual([
      'test-bucket/app/',
      'test-bucket/shared/',
    ]);
    expect(leaves.map((l) => (l.kind === 'leaf' ? l.item.path : ''))).toEqual([
      'test-bucket/README.md',
    ]);
  });

  it('round-trips a branch path back into browse verbatim', async () => {
    const root = await provider.browse({ path: 'test-bucket/' });
    const appBranch = root.nodes.find((n) => n.kind === 'branch' && n.path.endsWith('app/'));
    expect(appBranch?.kind).toBe('branch');

    const child = await provider.browse({ path: (appBranch as { path: string }).path });
    expect(child.nodes.map((n) => (n.kind === 'branch' ? n.path : n.item.path))).toEqual([
      'test-bucket/app/prod/',
      'test-bucket/app/staging/',
      'test-bucket/app/settings.json',
    ]);
  });

  it('skips the zero-byte marker object that shares its branch prefix', async () => {
    const result = await provider.browse({ path: 'test-bucket/app/prod/' });
    // 'app/prod/' itself is stored as an object but must not appear as a leaf.
    expect(result.nodes.map((n) => (n.kind === 'leaf' ? n.item.path : n.path))).toEqual([
      'test-bucket/app/prod/api-key',
      'test-bucket/app/prod/db-host',
    ]);
  });

  it('paginates prefixes and objects on one shared cursor', async () => {
    const page1 = await provider.browse({ path: 'test-bucket/', maxResults: 2 });
    expect(page1.nodes).toHaveLength(2);
    expect(page1.nextToken).toBeDefined();

    const page2 = await provider.browse({
      path: 'test-bucket/',
      maxResults: 2,
      nextToken: page1.nextToken,
    });
    const key = (n: (typeof page2.nodes)[number]) =>
      n.kind === 'branch' ? n.path : n.item.id;
    const seen = new Set(page1.nodes.map(key));
    for (const node of page2.nodes) {
      expect(seen.has(key(node))).toBe(false);
    }
  });

  it('scopes a search to the branch it was issued from', async () => {
    const result = await provider.search({ query: 'db-host', pathPrefix: 'test-bucket/app/prod/' });
    expect(result.items.map((i) => i.path)).toEqual(['test-bucket/app/prod/db-host']);
  });

  it('searches recursively beneath the prefix', async () => {
    const result = await provider.search({ query: 'db-host', pathPrefix: 'test-bucket/app/' });
    expect(result.items.map((i) => i.path).sort()).toEqual([
      'test-bucket/app/prod/db-host',
      'test-bucket/app/staging/db-host',
    ]);
  });

  it('falls back to the configured buckets when a search has no prefix', async () => {
    const result = await provider.search({ query: 'api-key' });
    expect(result.items.map((i) => i.path)).toEqual(['test-bucket/app/prod/api-key']);
  });

  it('explains itself rather than scanning the account when no bucket is known', async () => {
    setup();
    const bare = new AwsS3Provider();
    await bare.init({ defaultRegion: REGION });
    // Silently returning [] here reads as "the store is empty" when the real
    // cause is a missing setting, so the error names both cause and remedy.
    await expect(bare.search({ query: 'api-key' })).rejects.toThrow(/"buckets" configured/);
    await expect(bare.search({ query: 'api-key' })).rejects.toThrow(/press t/);
  });

  it('still searches a bucket named by pathPrefix when none are configured', async () => {
    setup();
    const bare = new AwsS3Provider();
    await bare.init({ defaultRegion: REGION });
    const result = await bare.search({ query: 'api-key', pathPrefix: 'test-bucket/app/' });
    expect(result.items.map((i) => i.path)).toEqual(['test-bucket/app/prod/api-key']);
  });

  it('reads a text object', async () => {
    expect(await provider.getValue('test-bucket/app/prod/db-host')).toBe('prod-db.example.com');
  });

  it('rejects an object larger than the configured cap instead of truncating', async () => {
    setup();
    const tiny = new AwsS3Provider();
    await tiny.init({ defaultRegion: REGION, buckets: [BUCKET], maxValueBytes: 5 });
    await expect(tiny.getValue('test-bucket/app/prod/db-host')).rejects.toThrow(
      /too large to display/,
    );
  });

  it('refuses to render a binary object as a value', async () => {
    store.set(objectKey(BUCKET, 'blob.bin'), {
      bucket: BUCKET,
      key: 'blob.bin',
      body: 'binary',
      contentType: 'application/octet-stream',
      lastModified: new Date(),
    });
    await expect(provider.getValue('test-bucket/blob.bin')).rejects.toThrow(/binary/);
  });

  it('preserves Content-Type when updating a value', async () => {
    await provider.updateValue('test-bucket/app/settings.json', '{"a":2}');
    const put = s3Mock.commandCalls(PutObjectCommand)[0]!.args[0].input;
    expect(put.ContentType).toBe('application/json');
    expect(store.get(objectKey(BUCKET, 'app/settings.json'))!.body).toBe('{"a":2}');
  });

  it('creates and deletes objects addressed by bucket/key', async () => {
    const item = await provider.createItem('test-bucket/new/thing.json', '{}', 'json');
    expect(item.id).toBe('test-bucket/new/thing.json');
    expect(item.type).toBe('json');
    expect(store.has(objectKey(BUCKET, 'new/thing.json'))).toBe(true);

    await provider.deleteItem('test-bucket/new/thing.json');
    expect(store.has(objectKey(BUCKET, 'new/thing.json'))).toBe(false);
  });

  it('exposes bucket, key and URI as detail fields', async () => {
    const item = await provider.getItem('test-bucket/app/settings.json');
    const labels = provider.getItemDetails(item).map((f) => f.label);
    expect(labels).toContain('Bucket');
    expect(labels).toContain('Key');
    expect(labels).toContain('URI');
    const uri = provider.getItemDetails(item).find((f) => f.label === 'URI');
    expect(uri?.value).toBe('s3://test-bucket/app/settings.json');
  });

  it('builds a displayLabel with the account from STS', async () => {
    const ctx = await provider.getCurrentContext();
    expect(ctx.account).toBe(ACCOUNT);
    expect(ctx.displayLabel).toBe(`${ACCOUNT} / ${REGION}`);
  });

  it('resolves a bucket region once and reuses the client', async () => {
    await provider.browse({ path: 'test-bucket/' });
    await provider.browse({ path: 'test-bucket/app/' });
    // The location lookup is cached, not repeated per call.
    expect(s3Mock.commandCalls(GetBucketLocationCommand).length).toBe(1);
  });
});
