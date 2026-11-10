import { useEffect, useRef } from 'react';
import type { AttemptResult } from '../curriculum/lessonSession';
import { useKeyCapture } from '../keys/useKeyCapture';
import type { PackItem } from '../packs/schema';
import { Answer } from './Answer';
import { Drill } from './Drill';

const CORRECT_PAUSE_MS = 650;

/**
 * One presentation of one item: prompt, drill, then feedback. A correct answer
 * moves on by itself; a miss shows the answer and waits for Enter or Space.
 */
export function DrillStage({
  appId,
  item,
  attempt,
  phase,
  result,
  answerVisible,
  onAnswer,
  onNext,
}: {
  appId: string;
  item: PackItem;
  /** Changes for every presentation, so the drill starts fresh. */
  attempt: number;
  phase: string;
  result: AttemptResult | null;
  /** Show the answer from the start (a lesson's intro). */
  answerVisible: boolean;
  onAnswer: (result: AttemptResult) => void;
  onNext: () => void;
}) {
  const shownAt = useRef(performance.now());
  useEffect(() => {
    shownAt.current = performance.now();
  }, [attempt]);

  useEffect(() => {
    if (!result?.correct) return undefined;
    const timer = setTimeout(onNext, CORRECT_PAUSE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useKeyCapture(
    (token) => {
      if (token === '<CR>' || token === '<Space>') onNext();
    },
    { enabled: result !== null && !result.correct },
  );

  return (
    <div className="lesson-body" data-testid="lesson-body" data-attempt={attempt} data-phase={phase}>
      <p className="prompt" data-testid="prompt">
        {item.prompt}
      </p>
      <div className="answer-line">
        {answerVisible ? (
          <>
            Type <Answer appId={appId} item={item} />
          </>
        ) : (
          ' '
        )}
      </div>

      <Drill key={attempt} appId={appId} item={item} frozen={result !== null} onResult={onAnswer} />

      <div className={`feedback ${result ? (result.correct ? 'ok' : 'bad') : ''}`} data-testid="feedback">
        {result?.correct && 'Correct'}
        {result && !result.correct && (
          <>
            <span>
              {answerVisible ? 'Not quite. Try it again:' : 'Not quite. The answer is'}{' '}
              <Answer appId={appId} item={item} />
            </span>
            <button type="button" className="button small" onClick={onNext}>
              Continue (Enter)
            </button>
          </>
        )}
        {!result && !answerVisible && (
          <button
            type="button"
            className="link-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              onAnswer({
                correct: false,
                durationMs: Math.round(performance.now() - shownAt.current),
                keys: [],
              })
            }
          >
            Show answer
          </button>
        )}
      </div>
    </div>
  );
}
