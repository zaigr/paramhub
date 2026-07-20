/**
 * AWS client construction for the S3 provider.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { STSClient } from '@aws-sdk/client-sts';
import { awsCredentials } from '@paramhub/aws-common';

export function createS3Client(region: string, profile: string | undefined): S3Client {
  return new S3Client({
    region,
    credentials: awsCredentials(profile),
    // Buckets are regional. Without this, any request to a bucket outside
    // `region` fails with PermanentRedirect (HTTP 301) instead of being
    // re-signed and retried against the region the redirect names.
    followRegionRedirects: true,
  });
}

export function createStsClient(region: string, profile: string | undefined): STSClient {
  return new STSClient({ region, credentials: awsCredentials(profile) });
}

export { describeAwsError } from '@paramhub/aws-common';
