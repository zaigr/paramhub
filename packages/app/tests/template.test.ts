import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { renderConfigTemplate } from '../src/config/template.js';
import { AppConfigSchema } from '../src/config/schema.js';

describe('renderConfigTemplate', () => {
  it('default template parses and validates against the schema', () => {
    const parsed = AppConfigSchema.parse(parse(renderConfigTemplate()));
    expect(parsed.theme).toBe('dark');
    expect(parsed.providers).toHaveLength(3);
    expect(parsed.providers[0]).toMatchObject({
      package: '@paramhub/provider-aws-ssm',
      enabled: true,
    });
    expect(parsed.providers[1]).toMatchObject({
      package: '@paramhub/provider-aws-s3',
      enabled: false,
    });
    expect(parsed.providers[2]).toMatchObject({
      package: '@paramhub/types/mock',
      enabled: false,
    });
    expect(parsed.editor.command).toBe('');
    expect(parsed.list.defaultMode).toBe('tree');
  });

  it('substitutes wizard choices', () => {
    const parsed = AppConfigSchema.parse(
      parse(
        renderConfigTemplate({
          theme: 'nord',
          awsEnabled: false,
          mockEnabled: true,
          editorCommand: 'code --wait',
        }),
      ),
    );
    expect(parsed.theme).toBe('nord');
    expect(parsed.providers[0]!.enabled).toBe(false);
    expect(parsed.providers[2]!.enabled).toBe(true);
    expect(parsed.editor.command).toBe('code --wait');
  });

  it('enables only the S3 entry and makes it the default provider', () => {
    const parsed = AppConfigSchema.parse(
      parse(renderConfigTemplate({ awsEnabled: false, s3Enabled: true })),
    );
    expect(parsed.defaultProvider).toBe('aws-s3');
    expect(parsed.providers[0]!.enabled).toBe(false);
    expect(parsed.providers[1]).toMatchObject({
      package: '@paramhub/provider-aws-s3',
      enabled: true,
    });
  });

  it('quotes editor commands safely', () => {
    const parsed = AppConfigSchema.parse(
      parse(renderConfigTemplate({ editorCommand: 'weird "editor" --flag' })),
    );
    expect(parsed.editor.command).toBe('weird "editor" --flag');
  });

  it('keeps explanatory comments', () => {
    const template = renderConfigTemplate();
    expect(template).toContain('# Color theme: dark | light | dracula | nord');
    expect(template).toContain('# Remap hotkeys by command ID');
  });
});
