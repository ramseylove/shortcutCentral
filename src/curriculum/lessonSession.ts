/**
 * State machine for running one lesson. Each item is first shown once with its
 * answer visible (intro), then all items are drilled until each has been
 * answered correctly twice in a row.
 */
export const REQUIRED_STREAK = 2;

export interface AttemptResult {
  correct: boolean;
  durationMs: number;
  keys: string[];
}

export interface LessonSession {
  itemIds: string[];
  phase: 'intro' | 'drill' | 'done';
  /** Item ids still to come; the first is the current item. */
  queue: string[];
  streaks: Record<string, number>;
  /** Set once the current item has been answered, until `next`. */
  result: AttemptResult | null;
  /** Increments for every presentation, so a drill can be remounted. */
  attempt: number;
  /** Scored attempts (drill phase only). */
  attempts: number;
  correct: number;
  missed: string[];
}

export type LessonAction = { type: 'answer'; result: AttemptResult } | { type: 'next' };

export function startLesson(itemIds: string[]): LessonSession {
  return {
    itemIds,
    phase: 'intro',
    queue: [...itemIds],
    streaks: Object.fromEntries(itemIds.map((id) => [id, 0])),
    result: null,
    attempt: 0,
    attempts: 0,
    correct: 0,
    missed: [],
  };
}

export function currentItemId(session: LessonSession): string | undefined {
  return session.phase === 'done' ? undefined : session.queue[0];
}

function answer(session: LessonSession, result: AttemptResult): LessonSession {
  if (session.result || session.phase === 'done') return session;
  if (session.phase === 'intro') return { ...session, result };

  const id = session.queue[0];
  return {
    ...session,
    result,
    attempts: session.attempts + 1,
    correct: session.correct + (result.correct ? 1 : 0),
    streaks: { ...session.streaks, [id]: result.correct ? session.streaks[id] + 1 : 0 },
    missed: result.correct || session.missed.includes(id) ? session.missed : [...session.missed, id],
  };
}

function next(session: LessonSession): LessonSession {
  if (!session.result || session.phase === 'done') return session;
  const [id, ...rest] = session.queue;
  const base = { ...session, result: null, attempt: session.attempt + 1 };

  if (session.phase === 'intro') {
    // An intro item is repeated until it is done correctly; it is not scored.
    if (!session.result.correct) return base;
    if (rest.length > 0) return { ...base, queue: rest };
    return { ...base, phase: 'drill', queue: [...session.itemIds] };
  }

  if (session.streaks[id] >= REQUIRED_STREAK) {
    return rest.length > 0 ? { ...base, queue: rest } : { ...base, phase: 'done', queue: [] };
  }
  // Not learned yet: a miss comes back after two other items, a first correct
  // answer goes to the end of the queue.
  const position = session.result.correct ? rest.length : Math.min(2, rest.length);
  return { ...base, queue: [...rest.slice(0, position), id, ...rest.slice(position)] };
}

export function lessonReducer(session: LessonSession, action: LessonAction): LessonSession {
  return action.type === 'answer' ? answer(session, action.result) : next(session);
}
