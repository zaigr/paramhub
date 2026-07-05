import { describe, it, expect } from 'vitest';
import { themes, resolveTheme, getThemeNames, DEFAULT_THEME_NAME } from '../src/theme/index.js';
import type { Theme } from '../src/theme/index.js';

const TOKENS: Array<keyof Theme> = [
  'accent',
  'border',
  'muted',
  'success',
  'error',
  'warning',
  'secure',
  'inputText',
  'hotkey',
  'diffAdded',
  'diffRemoved',
];

describe('themes', () => {
  it('ships dark, light, dracula, nord', () => {
    expect(getThemeNames().sort()).toEqual(['dark', 'dracula', 'light', 'nord']);
  });

  it('every theme defines every token', () => {
    for (const [name, theme] of Object.entries(themes)) {
      for (const token of TOKENS) {
        expect(theme[token], `${name}.${token}`).toBeTruthy();
      }
    }
  });

  it('resolveTheme returns the named theme', () => {
    expect(resolveTheme('nord')).toEqual({ theme: themes['nord'], name: 'nord' });
  });

  it('resolveTheme falls back to the default for unknown/missing names', () => {
    expect(resolveTheme('does-not-exist').name).toBe(DEFAULT_THEME_NAME);
    expect(resolveTheme(undefined).name).toBe(DEFAULT_THEME_NAME);
  });

  it('dark theme keeps the original named-color palette', () => {
    expect(themes['dark']).toMatchObject({
      accent: 'cyan',
      border: 'gray',
      success: 'green',
      error: 'red',
      warning: 'yellow',
    });
  });
});
