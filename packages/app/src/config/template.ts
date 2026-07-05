/**
 * Commented config template.
 *
 * Rendered on first run (by the setup wizard) and by `paramhub
 * --default-config`. Kept as a hand-written template — rather than
 * yaml.stringify of defaults — so every option carries an explanatory
 * comment for users editing the file later.
 */

export interface ConfigTemplateOptions {
  /** Theme name to write (default "dark"). */
  theme?: string;
  /** Enable the AWS SSM provider entry (default true). */
  awsEnabled?: boolean;
  /** Enable the built-in mock/demo provider entry (default false). */
  mockEnabled?: boolean;
  /** Editor command; empty string means $EDITOR / $VISUAL / platform fallback. */
  editorCommand?: string;
}

/** Quote a value for safe inclusion in the YAML template. */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function renderConfigTemplate(options: ConfigTemplateOptions = {}): string {
  const theme = options.theme ?? 'dark';
  const awsEnabled = options.awsEnabled ?? true;
  const mockEnabled = options.mockEnabled ?? false;
  const editorCommand = options.editorCommand ?? '';

  return `# paramhub configuration
# Regenerate this template anytime with: paramhub --default-config
# Print the effective (parsed) config with: paramhub show-config

# Color theme: dark | light | dracula | nord
theme: ${yamlString(theme)}

# Provider tab activated at startup (provider id).
defaultProvider: "aws-ssm"

# Parameter-store providers to load. Each entry is an npm package that
# implements the paramhub provider contract; disabled entries are skipped.
providers:
  - package: "@paramhub/provider-aws-ssm"
    enabled: ${awsEnabled}
    config:
      defaultRegion: "us-east-1"     # initial AWS region
      defaultProfile: "default"      # AWS shared-config profile
      decryptSecureStrings: true     # decrypt SecureString values on read

  # Built-in demo provider with fake data — no cloud access needed.
  # Also useful as a second tab for testing Tab/Shift+Tab switching.
  - package: "@paramhub/types/mock"
    enabled: ${mockEnabled}
    config: {}

# Remap hotkeys by command ID (see all IDs in the ? help overlay), e.g.:
#   core:switch-region: "ctrl+r"
#   core:focus-search: "ctrl+f"
keybindings: {}

# Search-result cache.
cache:
  enabled: true        # cache provider search results
  ttlSeconds: 30       # seconds before cached results expire

# External editor used for editing parameter values.
editor:
  command: ${yamlString(editorCommand)}${editorCommand ? '' : '     # empty = use $EDITOR / $VISUAL / vi (notepad on Windows)'}
  tempDir: ""          # empty = OS default temp directory
  # gui: true          # set for GUI editors that detach from the terminal

# Saved searches (managed by the app).
bookmarks: []
`;
}
