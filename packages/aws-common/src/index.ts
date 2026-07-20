/**
 * @paramhub/aws-common
 *
 * Helpers shared by every AWS-backed paramhub provider. These live in one
 * place rather than per-provider so copies cannot drift — notably
 * `awsCredentials`, whose fromIni/node-chain choice guards against a warning
 * that corrupts the Ink TUI.
 */

export { describeAwsError } from './errors.js';
export { awsCredentials } from './credentials.js';
export { listProfiles, resolveProfile } from './profiles.js';
export { AWS_REGIONS, DEFAULT_REGION } from './regions.js';
