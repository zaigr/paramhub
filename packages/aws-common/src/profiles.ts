/**
 * Shared AWS profile discovery and resolution.
 */

import { loadSharedConfigFiles } from '@smithy/shared-ini-file-loader';

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
