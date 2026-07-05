/**
 * CLI argument parsing.
 *
 * Hand-rolled: the surface is tiny (four flags + one subcommand) and the
 * result is a discriminated union the entry point switches on. Every mode
 * except 'run' must print and exit before the alternate screen is entered.
 */

export type CliArgs =
  | { mode: 'help' }
  | { mode: 'version' }
  | { mode: 'default-config' }
  | { mode: 'show-config'; configPath?: string }
  | { mode: 'run'; configPath?: string }
  | { mode: 'error'; message: string };

export const USAGE = `Usage: paramhub [command] [options]

Terminal UI for browsing and managing cloud parameter stores.

Commands:
  show-config        Print the effective (parsed) configuration as YAML

Options:
  --config <path>    Use a specific config file instead of the default
  --default-config   Print the default config template (with comments)
  -v, --version      Print the version
  -h, --help         Show this help

Keys (inside the TUI):
  ctrl+p             Command palette (all actions live here)
  ?                  Help overlay with every command and keybinding
`;

export function parseCliArgs(argv: string[]): CliArgs {
  let configPath: string | undefined;
  let showConfig = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '-h':
      case '--help':
        return { mode: 'help' };
      case '-v':
      case '--version':
        return { mode: 'version' };
      case '--default-config':
        return { mode: 'default-config' };
      case '--config': {
        const value = argv[i + 1];
        if (!value || value.startsWith('-')) {
          return { mode: 'error', message: '--config requires a file path' };
        }
        configPath = value;
        i++;
        break;
      }
      case 'show-config':
        showConfig = true;
        break;
      default:
        return { mode: 'error', message: `Unknown argument: ${arg}` };
    }
  }

  return showConfig ? { mode: 'show-config', configPath } : { mode: 'run', configPath };
}
