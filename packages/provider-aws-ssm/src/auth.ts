/**
 * AWS client construction.
 *
 * Centralizes SDK client creation so the provider can re-instantiate
 * clients when the region or profile changes.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { STSClient } from '@aws-sdk/client-sts';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

function credentials(profile: string | undefined) {
  return fromNodeProviderChain(profile ? { profile } : {});
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
