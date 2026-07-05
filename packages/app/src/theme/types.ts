/**
 * Theme type — semantic color tokens.
 *
 * Components never use raw color names; they read tokens from the active
 * theme via useTheme(). Themes set foreground colors only — "light" means
 * light-terminal-friendly accents, not a background repaint (Ink boxes have
 * no background fill; the terminal keeps its own background).
 *
 * Values are Ink `color` prop values: named ANSI colors or hex strings.
 */
export interface Theme {
  /** Primary accent — selection, focus, titles, modal frames. */
  accent: string;
  /** Chrome borders (top/status bar, detail panel). */
  border: string;
  /** De-emphasized text where an explicit color is needed (vs dimColor). */
  muted: string;
  /** Success / confirmation messages, profile chip. */
  success: string;
  /** Errors. */
  error: string;
  /** Warnings, region chip, loading emphasis. */
  warning: string;
  /** Secure/masked values and their badges. */
  secure: string;
  /** Active text-input content. */
  inputText: string;
  /** Hotkey labels in hints. */
  hotkey: string;
  /** Diff: added lines. */
  diffAdded: string;
  /** Diff: removed lines. */
  diffRemoved: string;
}
