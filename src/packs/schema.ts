import { z } from 'zod';
import { parseKeys } from '../keys/notation';

/** Mock surfaces that exist as React components. Pack items may only name these. */
export const MOCK_NAMES = ['editor'] as const;

/** Marks the cursor position in a goal item's `start` and `end` buffers. */
export const CURSOR_MARK = '|';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'use lower-case letters, digits and hyphens');

const keysField = z
  .array(z.string().min(1))
  .min(1)
  .refine((list) => list.every((keys) => parseKeys(keys).length > 0), 'empty key sequence');

const markedBuffer = z
  .string()
  .refine(
    (text) => text.split(CURSOR_MARK).length === 2,
    `must contain exactly one "${CURSOR_MARK}" cursor mark`,
  );

const itemBase = {
  id: slug,
  /** Stable name for what the shortcut does. Config overrides attach to this. */
  action: z.string().min(1),
  prompt: z.string().min(1),
  /** Accepted sequences in Neovim notation. The first is the canonical answer. */
  keys: keysField,
  source: z.enum(['default', 'suggested']).default('default'),
  /** Command strings or Lua references that identify this action in a user's config. */
  match: z.array(z.string()).optional(),
};

const keysItem = z.object({
  ...itemBase,
  type: z.literal('keys'),
  surface: z.looseObject({ mock: z.enum(MOCK_NAMES) }).optional(),
});

const goalItem = z.object({
  ...itemBase,
  type: z.literal('goal'),
  start: markedBuffer,
  end: markedBuffer,
  endMode: z.enum(['normal', 'insert', 'visual']).default('normal'),
  /** Keypress budget. Defaults to the canonical answer's length plus a margin. */
  maxKeys: z.number().int().positive().optional(),
});

export const itemSchema = z.discriminatedUnion('type', [keysItem, goalItem]);

const lessonSchema = z.object({
  id: slug,
  title: z.string().min(1),
  items: z.array(itemSchema).min(1),
});

export const packSchema = z
  .object({
    id: slug,
    /** The program this pack belongs to, e.g. `neovim`. */
    app: slug,
    name: z.string().min(1),
    version: z.number().int().positive(),
    /** Plugin repository, matched against plugin specs in a config. Core packs have none. */
    repo: z.string().optional(),
    /** Packs of the same app that must be started first. */
    requires: z.array(slug).default([]),
    lessons: z.array(lessonSchema).min(1),
  })
  .superRefine((pack, ctx) => {
    const lessonIds = new Set<string>();
    const itemIds = new Set<string>();
    pack.lessons.forEach((lesson, li) => {
      if (lessonIds.has(lesson.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate lesson id "${lesson.id}"`, path: ['lessons', li, 'id'] });
      }
      lessonIds.add(lesson.id);
      lesson.items.forEach((item, ii) => {
        if (itemIds.has(item.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `duplicate item id "${item.id}" (item ids are unique within a pack)`,
            path: ['lessons', li, 'items', ii, 'id'],
          });
        }
        itemIds.add(item.id);
      });
    });
  });

export type Pack = z.infer<typeof packSchema>;
export type Lesson = Pack['lessons'][number];
export type PackItem = z.infer<typeof itemSchema>;
export type KeysItem = z.infer<typeof keysItem>;
export type GoalItem = z.infer<typeof goalItem>;

/**
 * Validates a set of pack files together: each against the schema, then the
 * cross-pack rules (unique ids per app, `requires` pointing at real packs).
 * Throws one error listing every problem.
 */
export function validatePacks(files: { file: string; data: unknown }[]): Pack[] {
  const errors: string[] = [];
  const packs: Pack[] = [];
  const seen = new Map<string, string>();

  for (const { file, data } of files) {
    const result = packSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }
    const key = `${result.data.app}/${result.data.id}`;
    const previous = seen.get(key);
    if (previous) errors.push(`${file}: pack "${key}" is already defined in ${previous}`);
    seen.set(key, file);
    packs.push(result.data);
  }

  for (const pack of packs) {
    for (const required of pack.requires) {
      if (!seen.has(`${pack.app}/${required}`)) {
        errors.push(`${pack.app}/${pack.id}: requires unknown pack "${required}"`);
      }
    }
  }

  if (errors.length > 0) throw new Error(`Invalid packs:\n  ${errors.join('\n  ')}`);
  return packs;
}
