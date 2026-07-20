/**
 * Provider configuration: schema and parsing.
 */

import type { ProviderConfigField } from '@paramhub/types';
import { DEFAULT_REGION } from '@paramhub/aws-common';

/**
 * Largest object body paramhub will load into the value view.
 *
 * Reads are rejected above this rather than truncated: the edit flow round-trips
 * getValue → editor → updateValue, so a truncated read written back would
 * silently destroy the tail of the object.
 */
export const DEFAULT_MAX_VALUE_BYTES = 1024 * 1024;

export interface ParsedConfig {
  region: string;
  configuredProfile: string | undefined;
  /** Buckets to fan out across when a search has no path to scope it. */
  buckets: string[];
  maxValueBytes: number;
}

export function getConfigSchema(): ProviderConfigField[] {
  return [
    {
      key: 'defaultRegion',
      label: 'Default Region',
      type: 'string',
      required: false,
      default: DEFAULT_REGION,
    },
    {
      key: 'defaultProfile',
      label: 'Default Profile',
      type: 'string',
      required: false,
    },
    {
      key: 'buckets',
      label: 'Buckets to search (comma-separated; blank browses all)',
      type: 'string',
      required: false,
    },
    {
      key: 'maxValueBytes',
      label: 'Max object size to display (bytes)',
      type: 'string',
      required: false,
      default: String(DEFAULT_MAX_VALUE_BYTES),
    },
  ];
}

/** Accept either a comma-separated string (config file) or a real array (tests). */
function parseBuckets(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((b): b is string => typeof b === 'string' && b.length > 0);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
  }
  return [];
}

export function parseConfig(config: Record<string, unknown>): ParsedConfig {
  const maxRaw = config.maxValueBytes;
  const maxParsed =
    typeof maxRaw === 'number'
      ? maxRaw
      : typeof maxRaw === 'string'
        ? Number.parseInt(maxRaw, 10)
        : Number.NaN;

  return {
    region: (config.defaultRegion as string | undefined) ?? DEFAULT_REGION,
    configuredProfile: config.defaultProfile as string | undefined,
    buckets: parseBuckets(config.buckets ?? config.defaultBucket),
    maxValueBytes: Number.isFinite(maxParsed) && maxParsed > 0 ? maxParsed : DEFAULT_MAX_VALUE_BYTES,
  };
}
