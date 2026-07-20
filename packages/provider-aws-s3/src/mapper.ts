/**
 * Mapping between S3 object shapes and the universal Item contract.
 */

import type { DetailField, Item, ItemType } from '@paramhub/types';
import { lastSegment } from '@paramhub/types';

export const S3_DELIMITER = '/';

/**
 * Split a paramhub S3 path into its bucket and key.
 *
 * Item ids are `<bucket>/<key>` rather than a bare key so that getItem,
 * getValue and deleteItem are self-describing — the provider never needs an
 * ambient "current bucket" to resolve one.
 */
export function splitS3Path(path: string): { bucket: string; key: string } {
  const cut = path.indexOf(S3_DELIMITER);
  if (cut === -1) {
    throw new Error(`Not an S3 object path (expected "<bucket>/<key>"): ${path}`);
  }
  return { bucket: path.slice(0, cut), key: path.slice(cut + 1) };
}

export function joinS3Path(bucket: string, key: string): string {
  return `${bucket}${S3_DELIMITER}${key}`;
}

const JSON_EXTENSIONS = new Set(['json']);
const TEXT_EXTENSIONS = new Set([
  'txt',
  'yaml',
  'yml',
  'env',
  'properties',
  'conf',
  'config',
  'ini',
  'toml',
  'md',
  'csv',
  'xml',
  'sh',
  'log',
]);

/**
 * Classify an object by key extension, falling back to Content-Type.
 *
 * Never returns 'secure': S3 server-side encryption is transparent on read, so
 * marking objects secure would mask values the user can plainly see anyway.
 */
export function objectItemType(key: string, contentType?: string): ItemType {
  const name = lastSegment(key, S3_DELIMITER);
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';

  if (JSON_EXTENSIONS.has(ext)) return 'json';
  if (TEXT_EXTENSIONS.has(ext)) return 'string';

  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('json')) return 'json';
    if (ct.startsWith('text/')) return 'string';
    return 'binary';
  }

  // No extension and no Content-Type: assume text, the common case for
  // config-style keys ('app/prod/database-url').
  return ext === '' ? 'string' : 'binary';
}

export interface S3ObjectSummary {
  bucket: string;
  key: string;
  size?: number;
  lastModified?: Date;
  etag?: string;
  storageClass?: string;
  contentType?: string;
  versionId?: string;
  serverSideEncryption?: string;
}

export function objectToItem(o: S3ObjectSummary): Item {
  const path = joinS3Path(o.bucket, o.key);
  return {
    id: path,
    path,
    name: lastSegment(o.key, S3_DELIMITER),
    type: objectItemType(o.key, o.contentType),
    value: undefined,
    metadata: {
      lastModified: o.lastModified,
      size: o.size,
    },
    providerMetadata: {
      bucket: o.bucket,
      key: o.key,
      uri: `s3://${o.bucket}/${o.key}`,
      etag: o.etag,
      storageClass: o.storageClass,
      contentType: o.contentType,
      versionId: o.versionId,
      serverSideEncryption: o.serverSideEncryption,
    },
  };
}

function pm(item: Item, key: string): string | undefined {
  const value = item.providerMetadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

function humanSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`;
}

export function buildDetailFields(item: Item): DetailField[] {
  const fields: DetailField[] = [];

  const bucket = pm(item, 'bucket');
  const key = pm(item, 'key');
  if (bucket) fields.push({ label: 'Bucket', value: bucket, copyable: true });
  if (key) fields.push({ label: 'Key', value: key, copyable: true });

  const uri = pm(item, 'uri');
  if (uri) fields.push({ label: 'URI', value: uri, copyable: true });

  fields.push({ label: 'Type', value: item.type });

  if (item.metadata.size !== undefined) {
    fields.push({ label: 'Size', value: humanSize(item.metadata.size) });
  }
  const contentType = pm(item, 'contentType');
  if (contentType) fields.push({ label: 'Content Type', value: contentType });

  const etag = pm(item, 'etag');
  if (etag) fields.push({ label: 'ETag', value: etag.replace(/"/g, '') });

  const storageClass = pm(item, 'storageClass');
  if (storageClass) fields.push({ label: 'Storage Class', value: storageClass });

  if (item.metadata.lastModified) {
    fields.push({
      label: 'Last Modified',
      value: item.metadata.lastModified.toISOString(),
    });
  }

  const sse = pm(item, 'serverSideEncryption');
  if (sse) fields.push({ label: 'Encryption', value: sse });

  const versionId = pm(item, 'versionId');
  if (versionId) fields.push({ label: 'Version Id', value: versionId });

  if (item.metadata.tags && Object.keys(item.metadata.tags).length > 0) {
    fields.push({
      label: 'Tags',
      value: Object.entries(item.metadata.tags)
        .map(([k, v]) => `${k}=${v}`)
        .join(', '),
    });
  }

  return fields;
}
