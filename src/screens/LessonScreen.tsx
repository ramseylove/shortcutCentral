import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  REQUIRED_STREAK,
  currentItemId,
  lessonReducer,
  startLesson,
} from '../curriculum/lessonSession';
import { lessonStatus } from '../curriculum/unlock';
import { Drill } from '../drills/Drill';
import { KeySequence } from '../drills/KeyEcho';
import { enterImmersive, exitImmersive, supportsKeyboardLock } from '../keys/keyboardLock';
import { useImmersive } from '../keys/useImmersive';
import { useKeyCapture } from '../keys/useKeyCapture';
import { acceptedSequences, getLesson, getPack, lessonKey, packsForApp } from '../packs/registry';
import type { Lesson, Pack, PackItem } from '../packs/schema';
import { useProgress } from '../store/progress';

const CORRECT_PAUSE_MS = 650;

function Answer({ appId, item }: { appId: string; item: PackItem }) {
  const sequences = acceptedSequences(appId, item);
  return (
    <span className="answer">
      {sequences.map((keys, i) => (
        <span key={i}>
          {i > 0 && <span className="answer-or"> or </span>}
          <KeySequence keys={keys} />
        </span>
      ))}
    </span>
  );
}

function LessonRunner({ appId, pack, lesson }: { appId: string; pack: Pack; lesson: Lesson }) {
  const navigate = useNavigate();
  const [session, dispatch] = useReducer(
    lessonReducer,
    lesson.items.map((item) => item.id),
    startLesson,
  );
  const completeLesson = useProgress((state) => state.completeLesson);
  const immersive = useImmersive();
  const shownAt = useRef(performance.now());

  const item = lesson.items.find((candidate) => candidate.id === currentItemId(session));
  const { result, phase } = session;
  const intro = phase === 'intro';

  useEffect(() => {
    shownAt.current = performance.now();
  }, [session.attempt]);

  // A correct answer moves on by itself; a miss waits so the answer can be read.
  useEffect(() => {
    if (!result?.correct) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'next' }), CORRECT_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [result]);

  useEffect(() => {
    if (phase === 'done') completeLesson(lessonKey(pack, lesson));
  }, [phase, completeLesson, pack, lesson]);

  useKeyCapture(
    (token) => {
      if (token === '<CR>' || token === '<Space>') dispatch({ type: 'next' });
    },
    { enabled: result !== null && !result.correct },
  );

  const leave = () => {
    void exitImmersive();
    navigate(`/${appId}/curriculum`);
  };

  if (phase === 'done') {
    const accuracy = session.attempts ? Math.round((session.correct / session.attempts) * 100) : 100;
    const nextLesson = pack.lessons[pack.lessons.indexOf(lesson) + 1];
    return (
      <div className="lesson-screen">
        <div className="summary" data-testid="lesson-summary">
          <h1>Lesson complete</h1>
          <p className="summary-title">{lesson.title}</p>
          <dl className="summary-stats">
            <div>
              <dt>Drills</dt>
              <dd>{session.attempts}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{accuracy}%</dd>
            </div>
            <div>
              <dt>Missed</dt>
              <dd>{session.missed.length}</dd>
            </div>
          </dl>
          {session.missed.length > 0 && (
            <ul className="missed-list">
              {session.missed.map((id) => {
                const missed = lesson.items.find((candidate) => candidate.id === id)!;
                return (
                  <li key={id}>
                    <span>{missed.prompt}</span>
                    <Answer appId={appId} item={missed} />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="summary-actions">
            {nextLesson && (
              <Link className="button primary" to={`/${appId}/lesson/${pack.id}/${nextLesson.id}`}>
                Next lesson: {nextLesson.title}
              </Link>
            )}
            <button type="button" className="button" onClick={leave}>
              Back to curriculum
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!item) return null;
  const learned = lesson.items.filter((i) => session.streaks[i.id] >= REQUIRED_STREAK).length;
  const introIndex = lesson.items.length - session.queue.length + 1;

  return (
    <div className="lesson-screen">
      <header className="lesson-header">
        <span className="lesson-name">{lesson.title}</span>
        <span className="lesson-progress" data-testid="lesson-progress">
          {intro
            ? `New shortcut ${introIndex} of ${lesson.items.length}`
            : `${learned} of ${lesson.items.length} learned`}
        </span>
        <span className="header-spacer" />
        {supportsKeyboardLock() && !immersive.locked && (
          <button type="button" className="button small" onClick={() => void enterImmersive()}>
            Enter fullscreen
          </button>
        )}
        <button type="button" className="button small" onClick={leave}>
          Exit lesson
        </button>
      </header>

      <div
        className="lesson-body"
        data-testid="lesson-body"
        data-attempt={session.attempt}
        data-phase={phase}
      >
        <p className="prompt" data-testid="prompt">
          {item.prompt}
        </p>
        <div className="answer-line">
          {intro ? (
            <>
              Type <Answer appId={appId} item={item} />
            </>
          ) : (
            ' '
          )}
        </div>

        <Drill
          key={session.attempt}
          appId={appId}
          item={item}
          frozen={result !== null}
          onResult={(attempt) => dispatch({ type: 'answer', result: attempt })}
        />

        <div className={`feedback ${result ? (result.correct ? 'ok' : 'bad') : ''}`} data-testid="feedback">
          {result?.correct && 'Correct'}
          {result && !result.correct && (
            <>
              <span>
                {intro ? 'Not quite. Try it again:' : 'Not quite. The answer is'}{' '}
                <Answer appId={appId} item={item} />
              </span>
              <button type="button" className="button small" onClick={() => dispatch({ type: 'next' })}>
                Continue (Enter)
              </button>
            </>
          )}
          {!result && !intro && (
            <button
              type="button"
              className="link-button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                dispatch({
                  type: 'answer',
                  result: {
                    correct: false,
                    durationMs: Math.round(performance.now() - shownAt.current),
                    keys: [],
                  },
                })
              }
            >
              Show answer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LessonScreen() {
  const { appId = '', packId = '', lessonId = '' } = useParams();
  const pack = getPack(appId, packId);
  const lesson = pack && getLesson(pack, lessonId);
  const completedLessons = useProgress((state) => state.completedLessons);
  // Only the state when the lesson was opened matters: finishing it must not lock it.
  const status = useMemo(
    () =>
      pack && lesson
        ? lessonStatus(pack, lesson, packsForApp(appId), new Set(Object.keys(completedLessons)))
        : 'locked',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appId, pack, lesson],
  );

  if (!pack || !lesson || status === 'locked') {
    return (
      <div className="lesson-screen">
        <div className="summary">
          <h1>{pack && lesson ? 'This lesson is locked' : 'Lesson not found'}</h1>
          <Link className="button" to={`/${appId || 'neovim'}/curriculum`}>
            Back to curriculum
          </Link>
        </div>
      </div>
    );
  }
  // Keyed so that moving to the next lesson starts a fresh session.
  return <LessonRunner key={lessonKey(pack, lesson)} appId={appId} pack={pack} lesson={lesson} />;
}
