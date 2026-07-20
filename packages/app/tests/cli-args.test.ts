import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../src/cli-args.js';

describe('parseCliArgs', () => {
  it('defaults to run mode', () => {
    expect(parseCliArgs([])).toEqual({ mode: 'run', configPath: undefined });
  });

  it.each([
    [['-h'], 'help'],
    [['--help'], 'help'],
    [['-v'], 'version'],
    [['--version'], 'version'],
    [['--default-config'], 'default-config'],
  ])('parses %j as %s', (argv, mode) => {
    expect(parseCliArgs(argv as string[]).mode).toBe(mode);
  });

  it('parses show-config subcommand', () => {
    expect(parseCliArgs(['show-config'])).toEqual({
      mode: 'show-config',
      configPath: undefined,
    });
  });

  it('parses --config with a path', () => {
    expect(parseCliArgs(['--config', '/tmp/x.yaml'])).toEqual({
      mode: 'run',
      configPath: '/tmp/x.yaml',
    });
  });

  it('combines show-config with --config in either order', () => {
    expect(parseCliArgs(['show-config', '--config', '/tmp/x.yaml'])).toEqual({
      mode: 'show-config',
      configPath: '/tmp/x.yaml',
    });
    expect(parseCliArgs(['--config', '/tmp/x.yaml', 'show-config'])).toEqual({
      mode: 'show-config',
      configPath: '/tmp/x.yaml',
    });
  });

  it('errors on --config without a value', () => {
    expect(parseCliArgs(['--config']).mode).toBe('error');
    expect(parseCliArgs(['--config', '--help']).mode).toBe('error');
  });

  it('errors on unknown arguments', () => {
    const result = parseCliArgs(['--bogus']);
    expect(result).toEqual({ mode: 'error', message: 'Unknown argument: --bogus' });
  });

  it('help wins over other flags', () => {
    expect(parseCliArgs(['show-config', '--help']).mode).toBe('help');
  });
});
