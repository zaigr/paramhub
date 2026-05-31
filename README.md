## paramhub

A cross-platform terminal UI for browsing, searching, and editing cloud parameter stores. Built for engineers who live in the terminal and are tired of clunky web consoles and hard-to-remember CLI commands.

Works on macOS, Linux, and Windows.

**Supports multiple backends through a plugin system** — start with AWS SSM Parameter Store, add Azure Key Vault, HashiCorp Vault, or any custom provider as a drop-in npm package.

### Features

- 🔍 Fast fuzzy search across parameters
- ⌨️ VS Code-style command palette (`Ctrl+P`) — every action is discoverable
- ✏️ Edit values in your preferred `$EDITOR`
- ★ Bookmarked searches for quick access to frequent paths
- 🔒 Secure values masked by default, revealed on demand
- 🌍 Switch regions and accounts without leaving the app
- 🎨 Themeable to match your terminal
- 🔌 Extensible provider architecture — bring your own backend

### Adding a provider

Install the provider package, then add it to `~/.config/paramhub/config.yaml` (created automatically on first run):

```sh
npm install -g @company/paramhub-provider-vault
```

```yaml
providers:
  - package: "@paramhub/provider-aws-ssm"
    enabled: true
    config:
      defaultRegion: "us-east-1"

  - package: "@company/paramhub-provider-vault"
    enabled: true
    config:
      address: "https://vault.example.com"
```

Providers are loaded dynamically at startup — no rebuild required. Any npm package that exports an object with a `create(): Provider` method works as a provider. See `@paramhub/types` for the full `Provider` interface contract.
