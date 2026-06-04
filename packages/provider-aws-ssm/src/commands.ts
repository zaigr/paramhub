/**
 * Provider-specific commands contributed to the command registry.
 *
 * Command IDs are prefixed `aws-ssm:`. Provider commands receive only a
 * CommandContext and cannot surface a status toast (a known limitation of
 * the command contract), but their side effects still run.
 */

import clipboard from 'clipboardy';
import type { Command, CommandContext } from '@paramhub/types';

function selectedArn(ctx: CommandContext): string | undefined {
  const arn = ctx.selectedItem?.providerMetadata?.arn;
  return typeof arn === 'string' ? arn : undefined;
}

export function getCommands(): Command[] {
  return [
    {
      id: 'aws-ssm:copy-arn',
      label: 'Copy Parameter ARN',
      description: 'Copy the ARN of the selected parameter to the clipboard',
      category: 'item',
      isEnabled: (ctx) => ctx.selectedItem !== null,
      execute: async (ctx) => {
        const arn = selectedArn(ctx);
        if (arn) {
          await clipboard.write(arn);
        }
      },
    },
  ];
}
