import { describe, expect, it } from 'vitest';
import { currentItemId, lessonReducer, startLesson, type LessonSession } from './lessonSession';

const right = { correct: true, durationMs: 500, keys: [] };
const wrong = { correct: false, durationMs: 500, keys: [] };

function play(session: LessonSession, correct: boolean): LessonSession {
  const answered = lessonReducer(session, { type: 'answer', result: correct ? right : wrong });
  return lessonReducer(answered, { type: 'next' });
}

describe('lesson session', () => {
  it('shows every item once in the intro, repeating a missed one', () => {
    let s = startLesson(['a', 'b']);
    expect(s.phase).toBe('intro');
    s = play(s, false);
    expect(currentItemId(s)).toBe('a');
    s = play(s, true);
    expect(currentItemId(s)).toBe('b');
    s = play(s, true);
    expect(s.phase).toBe('drill');
    expect(s.attempts).toBe(0);
  });

  it('finishes when every item is correct twice in a row', () => {
    let s = startLesson(['a', 'b']);
    s = play(play(s, true), true);
    for (let i = 0; i < 4; i++) s = play(s, true);
    expect(s.phase).toBe('done');
    expect(s.attempts).toBe(4);
    expect(s.correct).toBe(4);
    expect(s.missed).toEqual([]);
  });

  it('resets the streak on a miss and records it', () => {
    let s = startLesson(['a', 'b']);
    s = play(play(s, true), true);
    s = play(s, true); // a: 1
    s = play(s, true); // b: 1
    s = play(s, false); // a: 0
    expect(s.streaks.a).toBe(0);
    let guard = 0;
    while (s.phase !== 'done' && guard++ < 20) s = play(s, true);
    expect(s.phase).toBe('done');
    expect(s.missed).toEqual(['a']);
    expect(s.attempts).toBe(6);
  });

  it('ignores a second answer to the same presentation', () => {
    let s = startLesson(['a']);
    s = play(s, true);
    s = lessonReducer(s, { type: 'answer', result: right });
    s = lessonReducer(s, { type: 'answer', result: right });
    expect(s.attempts).toBe(1);
  });
});
