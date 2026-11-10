import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { exportData, importData, parseExport } from '../store/backup';
import { ShortcutCentralDb, type CardRecord } from '../store/db';
import { streakDays } from '../store/progress';
import { buildQueue } from './queue';
import { deriveRating, medianDurations } from './rating';
import { isFirstAnswer, reviewReducer, startReview } from './reviewSession';
import { Rating, endOfDay, newCardState, reviewCard, type Grade } from './scheduler';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 10, 9, 0).getTime();

function card(key: string, due: number, extra: Partial<CardRecord> = {}): CardRecord {
  return { key, app: 'neovim', packId: 'core', suspended: false, ...newCardState(NOW), due, ...extra };
}

describe('rating', () => {
  const sample = (durationMs: number, correct = true) => ({ correct, durationMs, drillType: 'keys' as const });

  it('needs enough correct samples before using a median', () => {
    expect(medianDurations([1000, 1000, 1000, 1000].map((d) => sample(d)))).toEqual({});
    const mixed = [...[800, 1000, 1200, 900, 5000].map((d) => sample(d)), sample(10, false)];
    expect(medianDurations(mixed)).toEqual({ keys: 1000 });
  });

  it('derives the rating from outcome and speed', () => {
    expect(deriveRating({ correct: false, durationMs: 100 }, 1000)).toBe(Rating.Again);
    expect(deriveRating({ correct: true, durationMs: 2500 }, 1000)).toBe(Rating.Hard);
    expect(deriveRating({ correct: true, durationMs: 1000 }, 1000)).toBe(Rating.Good);
    expect(deriveRating({ correct: true, durationMs: 400 }, 1000)).toBe(Rating.Easy);
    expect(deriveRating({ correct: true, durationMs: 9000 }, undefined)).toBe(Rating.Good);
  });
});

describe('scheduler', () => {
  it('makes a new card due the next day', () => {
    expect(newCardState(NOW).due).toBe(NOW + DAY);
  });

  it('pushes a card further out the better the answer, by at least a day', () => {
    const fresh = newCardState(NOW);
    const at = NOW + DAY;
    const interval = (grade: Grade) => reviewCard(fresh, grade, at).due - at;
    expect(interval(Rating.Again)).toBeGreaterThanOrEqual(DAY);
    expect(interval(Rating.Good)).toBeGreaterThan(interval(Rating.Again));
    expect(interval(Rating.Easy)).toBeGreaterThan(interval(Rating.Good));
  });

  it('grows the interval over successive good reviews', () => {
    let state = newCardState(NOW);
    const intervals: number[] = [];
    for (let i = 0; i < 3; i++) {
      const at = state.due;
      state = reviewCard(state, Rating.Good, at);
      intervals.push(state.due - at);
    }
    expect(intervals[1]).toBeGreaterThan(intervals[0]);
    expect(intervals[2]).toBeGreaterThan(intervals[1]);
    expect(state.fsrs.reps).toBe(3);
  });
});

describe('queue', () => {
  const known = new Set(['a', 'b', 'c', 'd']);
  it('takes cards due by the end of today, most overdue first, up to the cap', () => {
    const cards = [
      card('a', NOW + 2 * 3_600_000), // later today
      card('b', NOW - 3 * DAY),
      card('c', endOfDay(NOW) + 1), // tomorrow
      card('d', NOW - DAY, { suspended: true }),
      card('gone', NOW - DAY),
    ];
    expect(buildQueue(cards, NOW, 30, known).map((c) => c.key)).toEqual(['b', 'a']);
    expect(buildQueue(cards, NOW, 1, known).map((c) => c.key)).toEqual(['b']);
    expect(buildQueue(cards, NOW + DAY, 30, known).map((c) => c.key)).toEqual(['b', 'a', 'c']);
  });
});

describe('review session', () => {
  const right = { correct: true, durationMs: 1, keys: [] };
  const wrong = { correct: false, durationMs: 1, keys: [] };

  it('repeats a missed card until it is correct once, rating it only the first time', () => {
    let s = startReview(['a', 'b']);
    expect(isFirstAnswer(s)).toBe(true);
    s = reviewReducer(reviewReducer(s, { type: 'answer', result: wrong }), { type: 'next' });
    expect(s.queue).toEqual(['b', 'a']);
    s = reviewReducer(reviewReducer(s, { type: 'answer', result: right }), { type: 'next' });
    expect(s.queue).toEqual(['a']);
    expect(isFirstAnswer(s)).toBe(false);
    s = reviewReducer(reviewReducer(s, { type: 'answer', result: right }), { type: 'next' });
    expect(s.done).toBe(true);
    expect(s.missed).toEqual(['a']);
    expect(s.rated).toEqual(['a', 'b']);
  });

  it('is done immediately with nothing due', () => {
    expect(startReview([]).done).toBe(true);
  });
});

describe('streak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(streakDays([], NOW)).toBe(0);
    expect(streakDays([NOW, NOW - DAY, NOW - 2 * DAY, NOW - 4 * DAY], NOW)).toBe(3);
    expect(streakDays([NOW - DAY, NOW - 2 * DAY], NOW)).toBe(2);
    expect(streakDays([NOW - 2 * DAY], NOW)).toBe(0);
  });
});

describe('export and import', () => {
  it('round-trips all four tables and replaces existing data', async () => {
    const source = new ShortcutCentralDb('test-source');
    await source.cards.add(card('neovim/core/save', NOW + DAY));
    await source.attempts.add({
      cardKey: 'neovim/core/save',
      timestamp: NOW,
      correct: true,
      durationMs: 900,
      keys: [':', 'w', '<CR>'],
      drillType: 'keys',
      context: 'lesson',
    });
    await source.lessons.add({ key: 'neovim/core/basics', status: 'completed', completedAt: NOW });
    await source.settings.add({ name: 'sessionCap', value: 20 });

    const file = parseExport(JSON.stringify(await exportData(source)));
    expect(file.schemaVersion).toBe(1);

    const target = new ShortcutCentralDb('test-target');
    await target.lessons.add({ key: 'neovim/core/old', status: 'completed', completedAt: 1 });
    await importData(file, target);

    expect(await target.lessons.toCollection().primaryKeys()).toEqual(['neovim/core/basics']);
    expect(await target.cards.toArray()).toEqual(await source.cards.toArray());
    expect(await target.attempts.toArray()).toEqual(await source.attempts.toArray());
    expect((await target.settings.get('sessionCap'))?.value).toBe(20);
  });

  it('rejects files that are not exports', () => {
    expect(() => parseExport('nope')).toThrowError(/not valid JSON/);
    expect(() => parseExport('{"schemaVersion":99}')).toThrowError(/Not a Shortcut Central export/);
  });
});
