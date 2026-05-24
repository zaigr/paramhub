/**
 * Command Registry — the central hub for all commands in paramhub.
 *
 * This is a module-level singleton that stores all registered commands
 * (both core and provider-contributed). It supports:
 * - Registration and unregistration of commands
 * - Hotkey resolution (normalized key string → command)
 * - Fuzzy search via fuse.js for the command palette
 *
 * Architectural invariant: every user-facing action is a command.
 * If it can't be found in Ctrl+P, it doesn't exist.
 */

import Fuse from 'fuse.js';
import type { Command, CommandContext } from '@paramhub/types';

/** Internal representation of a registered command with mutable hotkey. */
interface RegisteredCommand {
  command: Command;
  /** The currently assigned hotkey (may differ from the command's default via overrides). */
  hotkey: string | undefined;
}

class CommandRegistry {
  private commands: Map<string, RegisteredCommand> = new Map();
  private fuse: Fuse<RegisteredCommand> | null = null;
  private dirty = true;

  /** Register a command. Replaces existing command with same ID. */
  register(command: Command): void {
    this.commands.set(command.id, {
      command,
      hotkey: command.hotkey,
    });
    this.dirty = true;
  }

  /** Register multiple commands at once. */
  registerAll(commands: Command[]): void {
    for (const cmd of commands) {
      this.register(cmd);
    }
  }

  /** Unregister a command by ID. */
  unregister(id: string): void {
    this.commands.delete(id);
    this.dirty = true;
  }

  /** Unregister all commands with a given prefix (e.g., "aws-ssm:"). */
  unregisterByPrefix(prefix: string): void {
    for (const key of this.commands.keys()) {
      if (key.startsWith(prefix)) {
        this.commands.delete(key);
      }
    }
    this.dirty = true;
  }

  /** Get a command by its ID. */
  getById(id: string): Command | undefined {
    return this.commands.get(id)?.command;
  }

  /** Get all registered commands. */
  getAll(): Command[] {
    return Array.from(this.commands.values()).map((rc) => rc.command);
  }

  /** Get the current hotkey for a command. */
  getHotkey(id: string): string | undefined {
    return this.commands.get(id)?.hotkey;
  }

  /** Override the hotkey for a command. */
  setHotkey(id: string, hotkey: string): void {
    const entry = this.commands.get(id);
    if (entry) {
      entry.hotkey = hotkey;
    }
  }

  /**
   * Resolve a normalized key string to a command.
   * Only returns the command if it is enabled and visible.
   */
  resolveByHotkey(normalizedKey: string, context: CommandContext): Command | undefined {
    for (const { command, hotkey } of this.commands.values()) {
      if (hotkey === normalizedKey) {
        const visible = command.isVisible ? command.isVisible(context) : true;
        const enabled = command.isEnabled ? command.isEnabled(context) : true;
        if (visible && enabled) {
          return command;
        }
      }
    }
    return undefined;
  }

  /**
   * Fuzzy-search commands by label and description.
   * Filters by visibility based on the current context.
   */
  search(query: string, context: CommandContext): Command[] {
    if (this.dirty) {
      this.rebuildIndex();
      this.dirty = false;
    }

    const visibleCommands = Array.from(this.commands.values()).filter((rc) => {
      const visible = rc.command.isVisible ? rc.command.isVisible(context) : true;
      return visible;
    });

    if (!query.trim()) {
      return visibleCommands.map((rc) => rc.command);
    }

    // Rebuild fuse with only visible commands for this search
    const fuse = new Fuse(visibleCommands, {
      keys: [
        { name: 'command.label', weight: 0.7 },
        { name: 'command.description', weight: 0.2 },
        { name: 'command.id', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });

    return fuse.search(query).map((result) => result.item.command);
  }

  /** Get all commands in a specific category. */
  getByCategory(category: Command['category']): Command[] {
    return this.getAll().filter((cmd) => cmd.category === category);
  }

  /** Clear all commands from the registry. */
  clear(): void {
    this.commands.clear();
    this.fuse = null;
    this.dirty = true;
  }

  private rebuildIndex(): void {
    const items = Array.from(this.commands.values());
    this.fuse = new Fuse(items, {
      keys: [
        { name: 'command.label', weight: 0.7 },
        { name: 'command.description', weight: 0.2 },
        { name: 'command.id', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
  }
}

/** The global command registry singleton. */
export const commandRegistry = new CommandRegistry();
