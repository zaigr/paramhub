/**
 * AWS client construction.
 *
 * Centralizes SDK client creation so the provider can re-instantiate
 * clients when the region or profile changes.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { STSClient } from '@aws-sdk/client-sts';
import { fromIni, fromNodeProviderChain } from '@aws-sdk/credential-providers';

function credentials(profile: string | undefined) {
  // When the user has explicitly chosen a profile (e.g. via the in-app profile
  // picker), resolve credentials from that profile alone. Using the full node
  // provider chain here would (a) let ambient AWS_* env credentials silently
  // win over the requested profile, and (b) emit a multi-source WARNING to the
  // console that corrupts the Ink TUI. fromIni resolves the named profile
  // directly — static keys, SSO, assume-role, credential_process — with no env
  // precedence and no warning. Fall back to the full chain only when no profile
  // is set (env vars, instance/role credentials, etc.).
  return profile ? fromIni({ profile }) : fromNodeProviderChain({});
}

export function createSsmClient(
  region: string,
  profile: string | undefined,
): SSMClient {
  return new SSMClient({ region, credentials: credentials(profile) });
}

export function createStsClient(
  region: string,
  profile: string | undefined,
): STSClient {
  return new STSClient({ region, credentials: credentials(profile) });
}

/**
 * Build a human-readable message from an AWS SDK / credential-provider error.
 *
 * AWS errors frequently carry an empty `message` (notably opaque
 * `UnknownError`s and credential-resolution failures), so falling back to
 * `err.message` alone surfaces nothing useful. Compose the error name and HTTP
 * status as well so the actual cause is visible.
 */
export function describeAwsError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return String(err);
  const e = err as {
    name?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const parts: string[] = [];
  if (e.name && e.name !== 'Error') parts.push(e.name);
  if (e.message && e.message.trim() && e.message !== e.name) parts.push(e.message.trim());
  if (e.$metadata?.httpStatusCode) parts.push(`HTTP ${e.$metadata.httpStatusCode}`);
  return parts.length > 0 ? parts.join(': ') : 'Unknown AWS error';
}
