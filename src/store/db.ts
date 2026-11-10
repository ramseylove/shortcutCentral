import Dexie, { type Table } from 'dexie';

export type DrillType = 'keys' | 'goal' | 'query';

/** FSRS scheduling state for one card. Dates are stored as epoch milliseconds. */
export interface FsrsState {
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
}

export interface CardRecord {
  /** `app/packId/itemId` */
  key: string;
  app: string;
  packId: string;
  /** Epoch milliseconds. */
  due: number;
  /** Set while the card's pack is disabled. */
  suspended: boolean;
  fsrs: FsrsState;
}

export interface AttemptRecord {
  id?: number;
  cardKey: string;
  timestamp: number;
  correct: boolean;
  durationMs: number;
  keys: string[];
  drillType: DrillType;
  context: 'lesson' | 'review';
}

export interface LessonRecord {
  /** `app/packId/lessonId` */
  key: string;
  status: 'completed';
  completedAt: number;
}

export interface SettingRecord {
  name: string;
  value: unknown;
}

export class ShortcutCentralDb extends Dexie {
  cards!: Table<CardRecord, string>;
  attempts!: Table<AttemptRecord, number>;
  lessons!: Table<LessonRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor(name = 'shortcut-central') {
    super(name);
    this.version(1).stores({
      cards: 'key, app, due',
      attempts: '++id, cardKey, timestamp',
      lessons: 'key',
      settings: 'name',
    });
  }
}

export const db = new ShortcutCentralDb();
