/**
 * Mapping between AWS SSM parameter shapes and the universal Item contract.
 */

import type { Parameter, ParameterMetadata } from '@aws-sdk/client-ssm';
import { ParameterType } from '@aws-sdk/client-ssm';
import type { DetailField, Item, ItemType } from '@paramhub/types';
import { lastSegment } from '@paramhub/types';

export function ssmTypeToItemType(type: string | undefined): ItemType {
  switch (type) {
    case 'SecureString':
      return 'secure';
    case 'StringList':
      return 'list';
    default:
      return 'string';
  }
}

export function itemTypeToSsmType(type: ItemType): ParameterType {
  switch (type) {
    case 'secure':
      return ParameterType.SECURE_STRING;
    case 'list':
      return ParameterType.STRING_LIST;
    default:
      return ParameterType.STRING;
  }
}

function buildArn(
  name: string,
  region: string,
  account: string | undefined,
): string | undefined {
  if (!account) {
    return undefined;
  }
  // Parameter names start with '/'; the ARN omits the leading slash boundary.
  return `arn:aws:ssm:${region}:${account}:parameter${name}`;
}

/** Map a fully-hydrated SSM Parameter (from GetParameter / GetParametersByPath). */
export function parameterToItem(p: Parameter): Item {
  const name = p.Name ?? '';
  return {
    id: name,
    path: name,
    name: lastSegment(name),
    type: ssmTypeToItemType(p.Type),
    value: undefined,
    metadata: {
      lastModified: p.LastModifiedDate,
      version: p.Version,
    },
    providerMetadata: {
      arn: p.ARN,
      dataType: p.DataType,
    },
  };
}

/** Map SSM ParameterMetadata (from DescribeParameters — no value, richer metadata). */
export function metadataToItem(
  m: ParameterMetadata,
  region: string,
  account: string | undefined,
): Item {
  const name = m.Name ?? '';
  return {
    id: name,
    path: name,
    name: lastSegment(name),
    type: ssmTypeToItemType(m.Type),
    value: undefined,
    metadata: {
      lastModified: m.LastModifiedDate,
      version: m.Version,
      createdBy: m.LastModifiedUser,
    },
    providerMetadata: {
      arn: m.ARN ?? buildArn(name, region, account),
      tier: m.Tier,
      dataType: m.DataType,
      keyId: m.KeyId,
    },
  };
}

function pm(item: Item, key: string): string | undefined {
  const value = item.providerMetadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function buildDetailFields(item: Item): DetailField[] {
  const fields: DetailField[] = [
    { label: 'Name', value: item.path, copyable: true },
    { label: 'Type', value: item.type },
  ];

  const arn = pm(item, 'arn');
  if (arn) {
    fields.push({ label: 'ARN', value: arn, copyable: true });
  }
  const tier = pm(item, 'tier');
  if (tier) {
    fields.push({ label: 'Tier', value: tier });
  }
  const dataType = pm(item, 'dataType');
  if (dataType) {
    fields.push({ label: 'Data Type', value: dataType });
  }
  if (item.metadata.version !== undefined) {
    fields.push({ label: 'Version', value: String(item.metadata.version) });
  }
  if (item.metadata.lastModified) {
    fields.push({
      label: 'Last Modified',
      value: item.metadata.lastModified.toISOString(),
    });
  }
  if (item.metadata.createdBy) {
    fields.push({ label: 'Last Modified By', value: item.metadata.createdBy });
  }
  const keyId = pm(item, 'keyId');
  if (keyId && item.type === 'secure') {
    fields.push({ label: 'KMS Key ID', value: keyId, copyable: true });
  }
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
