import { useEffect, useReducer, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  REQUIRED_STREAK,
  currentItemId,
  lessonReducer,
  startLesson,
} from '../curriculum/lessonSession';
import { lessonStatus, type LessonStatus } from '../curriculum/unlock';
import { DrillStage } from '../drills/DrillStage';
import { exitImmersive } from '../keys/keyboardLock';
import { useEnabledPacks } from '../packs/enabled';
import { getLesson, lessonKey } from '../packs/registry';
import type { Lesson, Pack } from '../packs/schema';
import { completeLesson, recordAttempt, useCompletedLessons } from '../store/progress';
import { SessionLayout, SessionMessage, SessionSummary } from './SessionLayout';

function LessonRunner({ appId, pack, lesson }: { appId: string; pack: Pack; lesson: Lesson }) {
  const navigate = useNavigate();
  const [session, dispatch] = useReducer(
    lessonReducer,
    lesson.items.map((item) => item.id),
    startLesson,
  );
  const item = lesson.items.find((candidate) => candidate.id === currentItemId(session));
  const { phase } = session;

  useEffect(() => {
    if (phase === 'done') void completeLesson(pack, lesson);
  }, [phase, pack, lesson]);

  const leave = (to: string) => {
    void exitImmersive();
    navigate(to);
  };

  if (phase === 'done') {
    const nextLesson = pack.lessons[pack.lessons.indexOf(lesson) + 1];
    return (
      <SessionSummary
        appId={appId}
        heading="Lesson complete"
        subtitle={`${lesson.title}. Its shortcuts come up for review from tomorrow.`}
        countLabel="Drills"
        count={session.attempts}
        correct={session.correct}
        missed={session.missed.map((id) => lesson.items.find((candidate) => candidate.id === id)!)}
      >
        {nextLesson && (
          <Link className="button primary" to={`/${appId}/lesson/${pack.id}/${nextLesson.id}`}>
            Next lesson: {nextLesson.title}
          </Link>
        )}
        <button type="button" className="button" onClick={() => leave(`/${appId}/today`)}>
          Back to Today
        </button>
      </SessionSummary>
    );
  }

  if (!item) return null;
  const learned = lesson.items.filter((i) => session.streaks[i.id] >= REQUIRED_STREAK).length;
  const introIndex = lesson.items.length - session.queue.length + 1;

  return (
    <SessionLayout
      title={lesson.title}
      progress={
        phase === 'intro'
          ? `New shortcut ${introIndex} of ${lesson.items.length}`
          : `${learned} of ${lesson.items.length} learned`
      }
      onExit={() => leave(`/${appId}/curriculum`)}
    >
      <DrillStage
        appId={appId}
        item={item}
        attempt={session.attempt}
        phase={phase}
        result={session.result}
        answerVisible={phase === 'intro'}
        onAnswer={(result) => {
          dispatch({ type: 'answer', result });
          // The intro is practice with the answer showing, so it is not recorded.
          if (phase === 'drill') void recordAttempt(pack, item, result, 'lesson');
        }}
        onNext={() => dispatch({ type: 'next' })}
      />
    </SessionLayout>
  );
}

export function LessonScreen() {
  const { appId = '', packId = '', lessonId = '' } = useParams();
  const packs = useEnabledPacks(appId);
  const completed = useCompletedLessons();
  // Only the state when the lesson was opened matters: finishing it must not lock it.
  const opened = useRef<{ key: string; status: LessonStatus } | null>(null);

  if (!packs || !completed) return <div className="lesson-screen" />;
  const pack = packs.find((candidate) => candidate.id === packId);
  const lesson = pack && getLesson(pack, lessonId);
  const back = (
    <Link className="button" to={`/${appId}/curriculum`}>
      Back to curriculum
    </Link>
  );
  if (!pack || !lesson) return <SessionMessage heading="Lesson not found">{back}</SessionMessage>;

  const key = lessonKey(pack, lesson);
  if (opened.current?.key !== key) {
    opened.current = { key, status: lessonStatus(pack, lesson, packs, completed) };
  }
  if (opened.current.status === 'locked') {
    return <SessionMessage heading="This lesson is locked">{back}</SessionMessage>;
  }
  // Keyed so that moving to the next lesson starts a fresh session.
  return <LessonRunner key={key} appId={appId} pack={pack} lesson={lesson} />;
}
