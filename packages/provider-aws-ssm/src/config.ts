/**
 * Provider configuration: schema, parsing, and profile resolution.
 */

import { loadSharedConfigFiles } from '@smithy/shared-ini-file-loader';
import type { ProviderConfigField } from '@paramhub/types';

export const DEFAULT_REGION = 'us-east-1';

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

/** Read profile names from the shared AWS config/credentials files. */
export async function listProfiles(): Promise<string[]> {
  try {
    const { configFile, credentialsFile } = await loadSharedConfigFiles();
    const names = new Set([
      ...Object.keys(configFile ?? {}),
      ...Object.keys(credentialsFile ?? {}),
    ]);
    return [...names];
  } catch {
    return [];
  }
}

/**
 * Resolve which profile to use without hardcoding 'default'.
 *
 * Order: explicitly configured profile → 'default' if present in shared
 * config → first available profile → undefined (let the SDK credential
 * chain decide via env vars, SSO, instance role, etc.).
 */
export async function resolveProfile(
  configured: string | undefined,
): Promise<string | undefined> {
  if (configured) {
    return configured;
  }
  const profiles = await listProfiles();
  if (profiles.includes('default')) {
    return 'default';
  }
  return profiles[0];
}
