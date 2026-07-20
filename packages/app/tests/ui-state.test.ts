/**
 * Persisted UI state.
 *
 * Every path here must degrade to "no remembered preference" rather than throw:
 * a corrupt or unwritable state file must never stop the app from starting.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadUiState, saveListMode } from '../src/config/ui-state.js';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paramhub-ui-state-'));
  file = path.join(dir, 'nested', 'ui-state.json');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('ui-state', () => {
  it('returns empty state when the file does not exist', async () => {
    expect(await loadUiState(file)).toEqual({ listModes: {} });
  });

  it('round-trips a saved mode, creating parent directories', async () => {
    await saveListMode('aws-s3', 'flat', file);
    expect(await loadUiState(file)).toEqual({ listModes: { 'aws-s3': 'flat' } });
  });

  it('keeps other providers when saving one', async () => {
    await saveListMode('aws-ssm', 'flat', file);
    await saveListMode('aws-s3', 'tree', file);
    expect(await loadUiState(file)).toEqual({
      listModes: { 'aws-ssm': 'flat', 'aws-s3': 'tree' },
    });
  });

  it('overwrites the mode for a provider already recorded', async () => {
    await saveListMode('aws-s3', 'tree', file);
    await saveListMode('aws-s3', 'flat', file);
    expect(await loadUiState(file)).toEqual({ listModes: { 'aws-s3': 'flat' } });
  });

  it('falls back to empty state on malformed JSON', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{ not json', 'utf-8');
    expect(await loadUiState(file)).toEqual({ listModes: {} });
  });

  it('drops entries that are not a valid ListMode', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({ listModes: { good: 'flat', bad: 'sideways', worse: 42 } }),
      'utf-8',
    );
    expect(await loadUiState(file)).toEqual({ listModes: { good: 'flat' } });
  });

  it('tolerates a file with no listModes key', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ somethingElse: true }), 'utf-8');
    expect(await loadUiState(file)).toEqual({ listModes: {} });
  });

  it('never throws when the path cannot be written', async () => {
    // A path under a regular file can never be created.
    const blocker = path.join(dir, 'blocker');
    await fs.writeFile(blocker, 'x', 'utf-8');
    await expect(saveListMode('aws-s3', 'flat', path.join(blocker, 'ui.json'))).resolves
      .toBeUndefined();
  });
});
