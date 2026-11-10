import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { getApp } from '../apps';
import { lessonStatus } from '../curriculum/unlock';
import { enterImmersive } from '../keys/keyboardLock';
import { indexItems, useEnabledPacks } from '../packs/enabled';
import { countDue } from '../srs/queue';
import { db } from '../store/db';
import { streakDays, useCompletedLessons } from '../store/progress';
import { DEFAULT_SESSION_CAP, settingNames, useSetting } from '../store/settings';

function formatDay(ms: number, now: number): string {
  const days = Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 1) return 'tomorrow';
  return `in ${days} days`;
}

export function TodayScreen() {
  const { appId = '' } = useParams();
  const app = getApp(appId);
  const packs = useEnabledPacks(appId);
  const completed = useCompletedLessons();
  const cap = useSetting(settingNames.sessionCap, DEFAULT_SESSION_CAP);
  const cards = useLiveQuery(() => db.cards.where('app').equals(appId).toArray(), [appId]);
  const timestamps = useLiveQuery(
    async () => (await db.attempts.orderBy('timestamp').keys()) as number[],
    [],
  );

  if (!app) return <p>Unknown app “{appId}”.</p>;
  if (!packs || !completed || !cards || !timestamps || cap === undefined) return null;

  const now = Date.now();
  const known = new Set(indexItems(packs).keys());
  const due = countDue(cards, now, known);
  const sessionSize = Math.min(due, cap);
  const streak = streakDays(timestamps, now);
  const upcoming = cards
    .filter((card) => !card.suspended && known.has(card.key))
    .map((card) => card.due)
    .sort((a, b) => a - b)[0];

  let nextLesson: { packId: string; lessonId: string; title: string; packName: string } | undefined;
  for (const pack of packs) {
    const lesson = pack.lessons.find((l) => lessonStatus(pack, l, packs, completed) === 'available');
    if (lesson) {
      nextLesson = { packId: pack.id, lessonId: lesson.id, title: lesson.title, packName: pack.name };
      break;
    }
  }

  return (
    <div className="screen">
      <h1>Today</h1>
      <dl className="today-stats">
        <div>
          <dt>Reviews due</dt>
          <dd data-testid="due-count">{due}</dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd data-testid="streak">{streak}</dd>
        </div>
        <div>
          <dt>Shortcuts learned</dt>
          <dd>{cards.filter((card) => known.has(card.key)).length}</dd>
        </div>
      </dl>

      {due > 0 ? (
        <section className="today-card primary">
          <div>
            <h2>Review</h2>
            <p>
              {sessionSize} {sessionSize === 1 ? 'card' : 'cards'} in this session
              {due > sessionSize ? `, ${due - sessionSize} more after it` : ''}.
            </p>
          </div>
          <Link
            className="button primary"
            to={`/${appId}/review`}
            onClick={() => void enterImmersive()}
            data-testid="start-review"
          >
            Start
          </Link>
        </section>
      ) : (
        <section className="today-card">
          <div>
            <h2>Review</h2>
            <p>
              {upcoming === undefined
                ? 'Nothing to review yet. Finish a lesson and its shortcuts come up from the next day.'
                : `Nothing due today. Next review ${formatDay(upcoming, now)}.`}
            </p>
          </div>
        </section>
      )}

      {nextLesson ? (
        <section className={`today-card ${due === 0 ? 'primary' : ''}`}>
          <div>
            <h2>Next lesson</h2>
            <p>
              {nextLesson.title} <span className="muted">· {nextLesson.packName}</span>
            </p>
          </div>
          <Link
            className={`button ${due === 0 ? 'primary' : ''}`}
            to={`/${appId}/lesson/${nextLesson.packId}/${nextLesson.lessonId}`}
            onClick={() => void enterImmersive()}
            data-testid="start-lesson"
          >
            {due === 0 ? 'Start' : 'Start lesson'}
          </Link>
        </section>
      ) : (
        <section className="today-card">
          <div>
            <h2>Next lesson</h2>
            <p>Every lesson in your enabled packs is complete.</p>
          </div>
        </section>
      )}
    </div>
  );
}
