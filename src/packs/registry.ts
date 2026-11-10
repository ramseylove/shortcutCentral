import rawPacks from 'virtual:packs';
import { getApp } from '../apps';
import { expandPlaceholders, parseKeys, type KeyToken } from '../keys/notation';
import type { Lesson, Pack, PackItem } from './schema';

export const allPacks: Pack[] = rawPacks;

/** Packs of one app, with required packs ahead of the packs that need them. */
export function packsForApp(appId: string): Pack[] {
  const packs = allPacks.filter((pack) => pack.app === appId);
  const ordered: Pack[] = [];
  const visit = (pack: Pack) => {
    if (ordered.includes(pack)) return;
    for (const id of pack.requires) {
      const required = packs.find((p) => p.id === id);
      if (required) visit(required);
    }
    ordered.push(pack);
  };
  packs.forEach(visit);
  return ordered;
}

export function getPack(appId: string, packId: string): Pack | undefined {
  return allPacks.find((pack) => pack.app === appId && pack.id === packId);
}

export function getLesson(pack: Pack, lessonId: string): Lesson | undefined {
  return pack.lessons.find((lesson) => lesson.id === lessonId);
}

/** Key for stored progress on one item. */
export function cardKey(pack: Pack, item: PackItem): string {
  return `${pack.app}/${pack.id}/${item.id}`;
}

/** Key for stored progress on one lesson. */
export function lessonKey(pack: Pack, lesson: Lesson): string {
  return `${pack.app}/${pack.id}/${lesson.id}`;
}

/** An item's accepted sequences as tokens, with `<leader>` and friends expanded. */
export function acceptedSequences(appId: string, item: PackItem): KeyToken[][] {
  const placeholders = getApp(appId)?.placeholders ?? {};
  return item.keys.map((keys) => expandPlaceholders(parseKeys(keys), placeholders));
}
