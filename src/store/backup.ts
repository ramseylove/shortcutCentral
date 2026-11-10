import { z } from 'zod';
import { db, type ShortcutCentralDb } from './db';

export const EXPORT_SCHEMA_VERSION = 1;

const fsrsState = z.object({
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number(),
  last_review: z.number().nullable(),
});

const exportSchema = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.number(),
  cards: z.array(
    z.object({
      key: z.string(),
      app: z.string(),
      packId: z.string(),
      due: z.number(),
      suspended: z.boolean(),
      fsrs: fsrsState,
    }),
  ),
  attempts: z.array(
    z.object({
      id: z.number().optional(),
      cardKey: z.string(),
      timestamp: z.number(),
      correct: z.boolean(),
      durationMs: z.number(),
      keys: z.array(z.string()),
      drillType: z.enum(['keys', 'goal', 'query']),
      context: z.enum(['lesson', 'review']),
    }),
  ),
  lessons: z.array(
    z.object({ key: z.string(), status: z.literal('completed'), completedAt: z.number() }),
  ),
  settings: z.array(z.object({ name: z.string(), value: z.unknown() })),
});

export type ExportFile = z.infer<typeof exportSchema>;

/** The four tables as one JSON document. */
export async function exportData(database: ShortcutCentralDb = db): Promise<ExportFile> {
  const [cards, attempts, lessons, settings] = await Promise.all([
    database.cards.toArray(),
    database.attempts.toArray(),
    database.lessons.toArray(),
    database.settings.toArray(),
  ]);
  return { schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: Date.now(), cards, attempts, lessons, settings };
}

/** Parses an export file's text. Throws with a readable message when it is not one. */
export function parseExport(text: string): ExportFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  const result = exportSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Not a Shortcut Central export: ${issue.path.join('.') || 'file'}: ${issue.message}`);
  }
  return result.data;
}

/** Replaces all four tables with the file's contents, in one transaction. */
export async function importData(file: ExportFile, database: ShortcutCentralDb = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.cards, database.attempts, database.lessons, database.settings],
    async () => {
      await Promise.all([
        database.cards.clear(),
        database.attempts.clear(),
        database.lessons.clear(),
        database.settings.clear(),
      ]);
      await database.cards.bulkPut(file.cards);
      await database.attempts.bulkPut(file.attempts);
      await database.lessons.bulkPut(file.lessons);
      await database.settings.bulkPut(file.settings.map(({ name, value }) => ({ name, value })));
    },
  );
}
