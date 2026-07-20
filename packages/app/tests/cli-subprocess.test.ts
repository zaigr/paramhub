/**
 * Subprocess tests for the CLI flag/subcommand surface.
 *
 * These spawn the built dist/cli.js — `pnpm build` (or `turbo test`, which
 * depends on build) must have produced it. None of these modes reach the
 * alternate screen or Ink, so no TTY is needed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { AppConfigSchema } from '../src/config/schema.js';

const execFileAsync = promisify(execFile);

const pkgRoot = path.resolve(fileURLToPath(import.meta.url), '../..');
const cliPath = path.join(pkgRoot, 'dist', 'cli.js');

function runCli(args: string[], env: Record<string, string> = {}) {
  return execFileAsync('node', [cliPath, ...args], {
    env: { ...process.env, ...env },
  });
}

let tmpDir: string;

beforeAll(async () => {
  await fs.access(cliPath); // fail fast with a clear message if dist is missing
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paramhub-cli-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('cli subprocess', () => {
  it('--version prints the package version', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(pkgRoot, 'package.json'), 'utf-8')) as {
      version: string;
    };
    const { stdout } = await runCli(['--version']);
    expect(stdout.trim()).toBe(pkg.version);
  });

  it('--help prints usage', async () => {
    const { stdout } = await runCli(['--help']);
    expect(stdout).toContain('Usage: paramhub');
    expect(stdout).toContain('show-config');
    expect(stdout).toContain('--default-config');
  });

  it('--default-config prints a commented template that validates', async () => {
    const { stdout } = await runCli(['--default-config']);
    expect(stdout).toContain('# paramhub configuration');
    expect(() => AppConfigSchema.parse(parse(stdout))).not.toThrow();
  });

  it('show-config falls back to defaults when no config file exists', async () => {
    const { stdout } = await runCli(['show-config'], {
      XDG_CONFIG_HOME: path.join(tmpDir, 'empty-xdg'),
    });
    expect(stdout).toContain('# config file:');
    expect(stdout).toContain('not found');
    const config = AppConfigSchema.parse(parse(stdout.replace(/^#.*$/gm, '')));
    expect(config.theme).toBe('dark');
    expect(config.providers).toEqual([]);
  });

  it('show-config reflects the config file (greppable YAML)', async () => {
    const configPath = path.join(tmpDir, 'custom.yaml');
    await fs.writeFile(configPath, 'theme: nord\nkeybindings:\n  core:show-help: "h"\n');
    const { stdout } = await runCli(['show-config', '--config', configPath]);
    expect(stdout).toContain(`# config file: ${configPath}`);
    expect(stdout).toContain('theme: nord');
    expect(stdout).toContain('core:show-help: h');
  });

  it('show-config honors XDG_CONFIG_HOME', async () => {
    const xdg = path.join(tmpDir, 'xdg');
    await fs.mkdir(path.join(xdg, 'paramhub'), { recursive: true });
    await fs.writeFile(path.join(xdg, 'paramhub', 'config.yaml'), 'theme: dracula\n');
    const { stdout } = await runCli(['show-config'], { XDG_CONFIG_HOME: xdg });
    expect(stdout).toContain('theme: dracula');
  });

  it('unknown flags exit 1 with usage on stderr', async () => {
    await expect(runCli(['--bogus'])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Unknown argument: --bogus'),
    });
  });
});
