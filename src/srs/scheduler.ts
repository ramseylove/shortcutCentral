import { Rating, State, fsrs, type Card, type Grade } from 'ts-fsrs';
import type { CardRecord, FsrsState } from '../store/db';

export { Rating };
export type { Grade };

const DAY_MS = 24 * 60 * 60 * 1000;

// Short-term (minutes-long) learning steps are off: a missed card is repeated
// within the session by the review queue itself, so FSRS only schedules days.
const scheduler = fsrs({ enable_short_term: false, enable_fuzz: false });

/** State of a card created when its lesson is completed: new, due the next day. */
export function newCardState(now: number): { due: number; fsrs: FsrsState } {
  return {
    due: now + DAY_MS,
    fsrs: {
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
      last_review: null,
    },
  };
}

/** Applies one review to a card and returns its next due date and state. */
export function reviewCard(
  card: Pick<CardRecord, 'due' | 'fsrs'>,
  grade: Grade,
  now: number,
): { due: number; fsrs: FsrsState } {
  const input: Card = {
    ...card.fsrs,
    due: new Date(card.due),
    last_review: card.fsrs.last_review === null ? undefined : new Date(card.fsrs.last_review),
  };
  const next = scheduler.next(input, new Date(now), grade).card;
  return {
    due: next.due.getTime(),
    fsrs: {
      stability: next.stability,
      difficulty: next.difficulty,
      elapsed_days: next.elapsed_days,
      scheduled_days: next.scheduled_days,
      learning_steps: next.learning_steps,
      reps: next.reps,
      lapses: next.lapses,
      state: next.state,
      last_review: next.last_review ? next.last_review.getTime() : null,
    },
  };
}

/** Start of the local day after `now`. A card is due once its due time is before this. */
export function endOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}
