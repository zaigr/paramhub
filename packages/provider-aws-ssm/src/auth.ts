/**
 * AWS client construction.
 *
 * Centralizes SDK client creation so the provider can re-instantiate
 * clients when the region or profile changes.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { STSClient } from '@aws-sdk/client-sts';
import { awsCredentials } from '@paramhub/aws-common';

export function createSsmClient(
  region: string,
  profile: string | undefined,
): SSMClient {
  return new SSMClient({ region, credentials: awsCredentials(profile) });
}

export function createStsClient(
  region: string,
  profile: string | undefined,
): STSClient {
  return new STSClient({ region, credentials: awsCredentials(profile) });
}

// Re-exported so provider.ts and the tests keep importing it from here.
export { describeAwsError } from '@paramhub/aws-common';
