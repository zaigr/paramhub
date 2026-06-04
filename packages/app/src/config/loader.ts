import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { AppConfigSchema } from './schema.js';
import type { AppConfig } from './schema.js';
import { getConfigDir } from './xdg.js';

export function getConfigFilePath(): string {
  return path.join(getConfigDir(), 'config.yaml');
}

const DEFAULT_CONFIG_TEMPLATE = `# paramhub configuration
# Generated on first run. Edit to customize.
# Full docs: https://github.com/paramhub/paramhub

theme: "dark"
defaultProvider: "aws-ssm"

providers:
  - package: "@paramhub/provider-aws-ssm"
    enabled: true
    config:
      defaultRegion: "us-east-1"
      defaultProfile: "default"
      decryptSecureStrings: true

  # Built-in mock provider — flip enabled to true to get a second tab
  # for testing Tab/Shift+Tab provider switching without real cloud access.
  - package: "@paramhub/types/mock"
    enabled: false
    config: {}

keybindings: {}
  # Override hotkeys by command ID, e.g.:
  # core:switch-region: "ctrl+r"

cache:
  enabled: true
  ttlSeconds: 30

editor:
  command: ""     # empty = use $EDITOR / $VISUAL / vi
  tempDir: ""     # empty = OS default temp directory

bookmarks: []
`;

export async function writeDefaultConfig(configPath: string): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, DEFAULT_CONFIG_TEMPLATE, 'utf-8');
}

export async function loadConfig(): Promise<AppConfig> {
  const configPath = getConfigFilePath();

  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        await writeDefaultConfig(configPath);
      } catch {
        // Read-only filesystem or similar — continue with defaults
      }
    }
    return AppConfigSchema.parse({});
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (err) {
    console.error(`[paramhub] Failed to parse config at ${configPath}:`, err);
    return AppConfigSchema.parse({});
  }

  const result = AppConfigSchema.safeParse(parsed ?? {});
  if (!result.success) {
    console.error(
      `[paramhub] Config validation errors (using defaults):`,
      result.error.flatten(),
    );
    return AppConfigSchema.parse({});
  }

  return result.data;
}
