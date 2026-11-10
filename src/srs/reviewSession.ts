import type { AttemptResult } from '../curriculum/lessonSession';

/**
 * State machine for a review session. Each card is rated on its first answer
 * only. A card answered wrong comes back later in the session until it is
 * answered correctly once.
 */
export interface ReviewSession {
  /** Card keys still to come; the first is the current card. */
  queue: string[];
  total: number;
  result: AttemptResult | null;
  attempt: number;
  /** Cards that have had their first answer, and so their rating. */
  rated: string[];
  missed: string[];
  done: boolean;
}

export type ReviewAction = { type: 'answer'; result: AttemptResult } | { type: 'next' };

export function startReview(cardKeys: string[]): ReviewSession {
  return {
    queue: [...cardKeys],
    total: cardKeys.length,
    result: null,
    attempt: 0,
    rated: [],
    missed: [],
    done: cardKeys.length === 0,
  };
}

/** True when the current presentation is the card's first in this session. */
export function isFirstAnswer(session: ReviewSession): boolean {
  return !session.rated.includes(session.queue[0]);
}

export function reviewReducer(session: ReviewSession, action: ReviewAction): ReviewSession {
  if (session.done) return session;
  const [key, ...rest] = session.queue;

  if (action.type === 'answer') {
    if (session.result) return session;
    const first = !session.rated.includes(key);
    return {
      ...session,
      result: action.result,
      rated: first ? [...session.rated, key] : session.rated,
      missed: first && !action.result.correct ? [...session.missed, key] : session.missed,
    };
  }

  if (!session.result) return session;
  const base = { ...session, result: null, attempt: session.attempt + 1 };
  if (session.result.correct) {
    return rest.length > 0 ? { ...base, queue: rest } : { ...base, queue: [], done: true };
  }
  // Missed: bring it back after three other cards, or at the end if fewer remain.
  const position = Math.min(3, rest.length);
  return { ...base, queue: [...rest.slice(0, position), key, ...rest.slice(position)] };
}
