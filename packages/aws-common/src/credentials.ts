/**
 * Credential resolution shared by every AWS-backed provider.
 */

import { fromIni, fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { AwsCredentialIdentityProvider } from '@smithy/types';

/**
 * Resolve credentials for an optional named profile.
 *
 * When the user has explicitly chosen a profile (e.g. via the in-app profile
 * picker), resolve credentials from that profile alone. Using the full node
 * provider chain here would (a) let ambient AWS_* env credentials silently
 * win over the requested profile, and (b) emit a multi-source WARNING to the
 * console that corrupts the Ink TUI. fromIni resolves the named profile
 * directly — static keys, SSO, assume-role, credential_process — with no env
 * precedence and no warning. Fall back to the full chain only when no profile
 * is set (env vars, instance/role credentials, etc.).
 *
 * The return type is annotated rather than inferred: this is an exported
 * symbol, and tsup cannot name the SDK's inferred provider type across the
 * pnpm store without it.
 */
export function awsCredentials(
  profile: string | undefined,
): AwsCredentialIdentityProvider {
  return profile ? fromIni({ profile }) : fromNodeProviderChain({});
}
