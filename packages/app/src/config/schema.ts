import { z } from 'zod';

const ProviderEntrySchema = z.object({
  package: z.string(),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});

const BookmarkSchema = z.object({
  label: z.string(),
  provider: z.string(),
  query: z.string(),
  region: z.string().optional(),
  profile: z.string().optional(),
});

export const AppConfigSchema = z.object({
  theme: z.string().default('dark'),
  defaultProvider: z.string().optional(),
  providers: z.array(ProviderEntrySchema).default([]),
  keybindings: z.record(z.string()).default({}),
  cache: z
    .object({
      enabled: z.boolean().default(true),
      ttlSeconds: z.number().default(30),
    })
    .default({}),
  editor: z
    .object({
      command: z.string().default(''),
      tempDir: z.string().default(''),
      gui: z.boolean().optional(),
    })
    .default({}),
  bookmarks: z.array(BookmarkSchema).default([]),
  list: z
    .object({
      /** Providers without a hierarchy always list flat regardless of this. */
      defaultMode: z.enum(['tree', 'flat']).default('tree'),
    })
    .default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;
