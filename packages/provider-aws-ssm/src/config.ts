/**
 * Provider configuration: schema, parsing, and profile resolution.
 */

import type { ProviderConfigField } from '@paramhub/types';
import { DEFAULT_REGION, listProfiles, resolveProfile } from '@paramhub/aws-common';

export { DEFAULT_REGION, listProfiles, resolveProfile };

export interface ParsedConfig {
  region: string;
  profile: string | undefined;
  decrypt: boolean;
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
      key: 'decryptSecureStrings',
      label: 'Decrypt SecureString Values',
      type: 'boolean',
      required: false,
      default: 'true',
    },
  ];
}

export function parseConfig(config: Record<string, unknown>): {
  region: string;
  configuredProfile: string | undefined;
  decrypt: boolean;
} {
  return {
    region: (config.defaultRegion as string | undefined) ?? DEFAULT_REGION,
    configuredProfile: config.defaultProfile as string | undefined,
    decrypt: (config.decryptSecureStrings as boolean | undefined) ?? true,
  };
}
