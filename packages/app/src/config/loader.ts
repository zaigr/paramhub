import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { AppConfigSchema } from './schema.js';
import type { AppConfig } from './schema.js';
import { getConfigDir } from './xdg.js';

export function getConfigFilePath(): string {
  return path.join(getConfigDir(), 'config.yaml');
}

export interface LoadConfigResult {
  config: AppConfig;
  /** True when no config file exists yet — triggers the setup wizard. */
  firstRun: boolean;
  /** The path the config was loaded from (or would be written to). */
  configPath: string;
}

/** Write config file contents, creating parent directories as needed. */
export async function writeConfigFile(configPath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, contents, 'utf-8');
}

/**
 * Load and validate the config file.
 *
 * A missing file is not an error: it marks the run as `firstRun` (the setup
 * wizard owns creating the file) and returns pure defaults. Parse/validation
 * failures log to stderr and fall back to defaults, so a broken config never
 * prevents the app from starting.
 */
export async function loadConfig(configPathOverride?: string): Promise<LoadConfigResult> {
  const configPath = configPathOverride ?? getConfigFilePath();
  const defaults = () => AppConfigSchema.parse({});

  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { config: defaults(), firstRun: true, configPath };
    }
    console.error(`[paramhub] Failed to read config at ${configPath}:`, err);
    return { config: defaults(), firstRun: false, configPath };
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err) {
    console.error(`[paramhub] Failed to parse config at ${configPath}:`, err);
    return { config: defaults(), firstRun: false, configPath };
  }

  const result = AppConfigSchema.safeParse(parsed ?? {});
  if (!result.success) {
    console.error(
      `[paramhub] Config validation errors (using defaults):`,
      result.error.flatten(),
    );
    return { config: defaults(), firstRun: false, configPath };
  }

  return { config: result.data, firstRun: false, configPath };
}
