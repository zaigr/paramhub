/**
 * Persisted UI state — choices the app makes on the user's behalf.
 *
 * Separate from config.yaml, which is hand-written and commented: there is no
 * way to update a single field there without rewriting the file and destroying
 * those comments. This file is machine-owned, so it can be rewritten freely.
 *
 * Every operation is best-effort. A missing, unreadable, corrupt or unwritable
 * state file must never stop the app from starting — the config default simply
 * applies instead.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getStateDir } from './xdg.js';

/** Mirrors ListMode in state/reducer.ts; duplicated to keep this module dependency-free. */
type ListMode = 'tree' | 'flat';

export interface UiState {
  /** Last list mode the user chose, per provider id. */
  listModes: Record<string, ListMode>;
}

const EMPTY: UiState = { listModes: {} };

export function getUiStateFilePath(): string {
  return path.join(getStateDir(), 'ui-state.json');
}

function isListMode(value: unknown): value is ListMode {
  return value === 'tree' || value === 'flat';
}

/** Read persisted UI state, falling back to empty on any problem. */
export async function loadUiState(filePath = getUiStateFilePath()): Promise<UiState> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return EMPTY;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const modes = (parsed as UiState | null)?.listModes;
    if (!modes || typeof modes !== 'object') {
      return EMPTY;
    }
    // Validate each entry: a hand-edited or stale file must not inject
    // arbitrary values into state.
    const listModes: Record<string, ListMode> = {};
    for (const [providerId, mode] of Object.entries(modes)) {
      if (isListMode(mode)) {
        listModes[providerId] = mode;
      }
    }
    return { listModes };
  } catch {
    return EMPTY;
  }
}

/**
 * Remember the list mode for one provider.
 *
 * Read-modify-write so a provider the current session never activated keeps its
 * remembered mode. Resolves even on failure — callers fire and forget.
 */
export async function saveListMode(
  providerId: string,
  mode: ListMode,
  filePath = getUiStateFilePath(),
): Promise<void> {
  try {
    const current = await loadUiState(filePath);
    const next: UiState = {
      ...current,
      listModes: { ...current.listModes, [providerId]: mode },
    };
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
  } catch {
    // Persisting a preference is never worth surfacing an error for.
  }
}
