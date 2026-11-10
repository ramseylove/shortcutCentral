import { useLiveQuery } from 'dexie-react-hooks';
import type { AttemptResult } from '../curriculum/lessonSession';
import { cardKey, lessonKey } from '../packs/registry';
import type { Lesson, Pack, PackItem } from '../packs/schema';
import { deriveRating, type Medians } from '../srs/rating';
import { newCardState, reviewCard } from '../srs/scheduler';
import { db, type AttemptRecord } from './db';

/** Marks a lesson complete and creates one card per item, due the next day. */
export async function completeLesson(pack: Pack, lesson: Lesson, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.lessons, db.cards], async () => {
    const key = lessonKey(pack, lesson);
    if (!(await db.lessons.get(key))) {
      await db.lessons.put({ key, status: 'completed', completedAt: now });
    }
    for (const item of lesson.items) {
      const id = cardKey(pack, item);
      // A card that already exists keeps its history.
      if (await db.cards.get(id)) continue;
      await db.cards.put({ key: id, app: pack.app, packId: pack.id, suspended: false, ...newCardState(now) });
    }
  });
}

export async function recordAttempt(
  pack: Pack,
  item: PackItem,
  result: AttemptResult,
  context: AttemptRecord['context'],
  now = Date.now(),
): Promise<void> {
  await db.attempts.add({
    cardKey: cardKey(pack, item),
    timestamp: now,
    correct: result.correct,
    durationMs: result.durationMs,
    keys: result.keys,
    drillType: item.type,
    context,
  });
}

/** Rates a review answer from its outcome and speed, and reschedules the card. */
export async function applyReview(
  pack: Pack,
  item: PackItem,
  result: AttemptResult,
  medians: Medians,
  now = Date.now(),
): Promise<void> {
  const key = cardKey(pack, item);
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(key);
    if (!card) return;
    const grade = deriveRating(result, medians[item.type]);
    await db.cards.update(key, reviewCard(card, grade, now));
  });
}

/** Keys of completed lessons; `undefined` while loading. */
export function useCompletedLessons(): ReadonlySet<string> | undefined {
  return useLiveQuery(async () => new Set(await db.lessons.toCollection().primaryKeys()), []);
}

export async function resetProgress(): Promise<void> {
  await db.transaction('rw', [db.cards, db.attempts, db.lessons], async () => {
    await Promise.all([db.cards.clear(), db.attempts.clear(), db.lessons.clear()]);
  });
}

/** Consecutive local days with at least one attempt, ending today or yesterday. */
export function streakDays(timestamps: number[], now: number): number {
  const dayOf = (ms: number) => {
    const d = new Date(ms);
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  };
  const days = new Set(timestamps.map(dayOf));
  let day = dayOf(now);
  if (!days.has(day)) day -= 1;
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day -= 1;
  }
  return streak;
}
