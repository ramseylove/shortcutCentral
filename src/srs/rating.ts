import { Rating, type Grade } from 'ts-fsrs';
import type { AttemptRecord, DrillType } from '../store/db';

/** Correct attempts needed before a drill type's median time is trusted. */
export const MIN_SAMPLES_FOR_MEDIAN = 5;

export type Medians = Partial<Record<DrillType, number>>;

/** Median time of correct attempts per drill type, where there are enough of them. */
export function medianDurations(
  attempts: Pick<AttemptRecord, 'correct' | 'durationMs' | 'drillType'>[],
): Medians {
  const byType: Partial<Record<DrillType, number[]>> = {};
  for (const attempt of attempts) {
    if (attempt.correct) (byType[attempt.drillType] ??= []).push(attempt.durationMs);
  }
  const medians: Medians = {};
  for (const [type, durations] of Object.entries(byType) as [DrillType, number[]][]) {
    if (durations.length < MIN_SAMPLES_FOR_MEDIAN) continue;
    durations.sort((a, b) => a - b);
    const middle = Math.floor(durations.length / 2);
    medians[type] =
      durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
  }
  return medians;
}

/**
 * The FSRS rating for an attempt. The user never grades themselves: a miss is
 * Again, and a correct answer is Hard, Good or Easy by its speed against the
 * user's median for that drill type. Without a median yet, correct is Good.
 */
export function deriveRating(
  attempt: { correct: boolean; durationMs: number },
  median: number | undefined,
): Grade {
  if (!attempt.correct) return Rating.Again;
  if (median === undefined) return Rating.Good;
  if (attempt.durationMs > median * 2) return Rating.Hard;
  if (attempt.durationMs < median / 2) return Rating.Easy;
  return Rating.Good;
}
