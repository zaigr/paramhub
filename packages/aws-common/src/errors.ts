/**
 * AWS error normalization shared by every AWS-backed provider.
 */

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
