/**
 * Built-in themes.
 *
 * `dark` encodes the exact palette the app shipped with before theming
 * (named ANSI colors), so the default look is unchanged. The others use hex
 * values (supported by Ink) tuned for their namesake palettes.
 */

import type { Theme } from './types.js';

export const DEFAULT_THEME_NAME = 'dark';

const dark: Theme = {
  accent: 'cyan',
  border: 'gray',
  muted: 'gray',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  secure: 'yellow',
  inputText: 'white',
  hotkey: 'white',
  diffAdded: 'green',
  diffRemoved: 'red',
};

/** For light terminal backgrounds — darker, higher-contrast foregrounds. */
const light: Theme = {
  accent: '#0969da',
  border: '#8c959f',
  muted: '#57606a',
  success: '#1a7f37',
  error: '#cf222e',
  warning: '#9a6700',
  secure: '#9a6700',
  inputText: '#24292f',
  hotkey: '#24292f',
  diffAdded: '#1a7f37',
  diffRemoved: '#cf222e',
};

const dracula: Theme = {
  accent: '#bd93f9',
  border: '#6272a4',
  muted: '#6272a4',
  success: '#50fa7b',
  error: '#ff5555',
  warning: '#ffb86c',
  secure: '#f1fa8c',
  inputText: '#f8f8f2',
  hotkey: '#8be9fd',
  diffAdded: '#50fa7b',
  diffRemoved: '#ff5555',
};

const nord: Theme = {
  accent: '#88c0d0',
  border: '#4c566a',
  muted: '#616e88',
  success: '#a3be8c',
  error: '#bf616a',
  warning: '#ebcb8b',
  secure: '#ebcb8b',
  inputText: '#eceff4',
  hotkey: '#81a1c1',
  diffAdded: '#a3be8c',
  diffRemoved: '#bf616a',
};

export const themes: Record<string, Theme> = { dark, light, dracula, nord };

/** All selectable theme names, default first. */
export function getThemeNames(): string[] {
  return Object.keys(themes);
}

/** Resolve a theme by name; unknown names fall back to the default. */
export function resolveTheme(name: string | undefined): { theme: Theme; name: string } {
  if (name && themes[name]) {
    return { theme: themes[name]!, name };
  }
  return { theme: themes[DEFAULT_THEME_NAME]!, name: DEFAULT_THEME_NAME };
}
