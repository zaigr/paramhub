/**
 * Path helpers shared by providers.
 *
 * One implementation so per-provider copies cannot drift — an earlier copy
 * dropped the empty-segment filter, so a leading-delimiter path yielded an
 * empty display name.
 */

/** Default path segment delimiter. */
export const DEFAULT_DELIMITER = '/';

/**
 * Last segment of a delimited path — the display name.
 *
 * Empty segments are ignored, so `/app/db/host` and `app/db/host` both yield
 * `host`, and a trailing delimiter (`app/db/`) yields `db`. Falls back to the
 * whole path when it contains no non-empty segment.
 */
export function lastSegment(path: string, delimiter = DEFAULT_DELIMITER): string {
  const segments = path.split(delimiter).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}
