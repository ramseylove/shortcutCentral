import { lessonKey } from '../packs/registry';
import type { Lesson, Pack } from '../packs/schema';

export type LessonStatus = 'locked' | 'available' | 'completed';

/**
 * A lesson is available when the previous lesson in its pack is complete and
 * every required pack has its first lesson complete.
 */
export function lessonStatus(
  pack: Pack,
  lesson: Lesson,
  appPacks: Pack[],
  completed: ReadonlySet<string>,
): LessonStatus {
  if (completed.has(lessonKey(pack, lesson))) return 'completed';

  const index = pack.lessons.indexOf(lesson);
  if (index > 0 && !completed.has(lessonKey(pack, pack.lessons[index - 1]))) return 'locked';

  for (const requiredId of pack.requires) {
    const required = appPacks.find((p) => p.id === requiredId);
    if (!required || !completed.has(lessonKey(required, required.lessons[0]))) return 'locked';
  }
  return 'available';
}
