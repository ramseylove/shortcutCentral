import { Link, useParams } from 'react-router-dom';
import { getApp } from '../apps';
import { lessonStatus } from '../curriculum/unlock';
import { enterImmersive } from '../keys/keyboardLock';
import { useEnabledPacks } from '../packs/enabled';
import { useCompletedLessons } from '../store/progress';

const STATUS_LABEL = { locked: 'Locked', available: 'Start', completed: 'Done' } as const;

export function CurriculumScreen() {
  const { appId = '' } = useParams();
  const app = getApp(appId);
  const packs = useEnabledPacks(appId);
  const completed = useCompletedLessons();

  if (!app) return <p>Unknown app “{appId}”.</p>;
  if (!packs || !completed) return null;

  return (
    <div className="screen">
      <h1>{app.name} curriculum</h1>
      {packs.map((pack) => (
        <section key={pack.id} className="pack">
          <h2>{pack.name}</h2>
          <ol className="lesson-list">
            {pack.lessons.map((lesson) => {
              const status = lessonStatus(pack, lesson, packs, completed);
              const row = (
                <>
                  <span className="lesson-title">{lesson.title}</span>
                  <span className="lesson-meta">{lesson.items.length} shortcuts</span>
                  <span className={`lesson-status ${status}`}>{STATUS_LABEL[status]}</span>
                </>
              );
              return (
                <li key={lesson.id} className={`lesson ${status}`} data-testid={`lesson-${pack.id}-${lesson.id}`}>
                  {status === 'locked' ? (
                    <div className="lesson-row">{row}</div>
                  ) : (
                    <Link
                      className="lesson-row"
                      to={`/${appId}/lesson/${pack.id}/${lesson.id}`}
                      // Fullscreen can only be requested from the click itself.
                      onClick={() => void enterImmersive()}
                    >
                      {row}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
