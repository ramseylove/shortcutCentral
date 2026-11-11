import rawPacks from 'virtual:packs';
import { getApp } from '../apps';
import { getActiveConfig, getConfigVersion } from '../config/active';
import { expandPlaceholders, parseKeys, type KeyToken } from '../keys/notation';
import type { Lesson, Pack, PackItem } from './schema';

export const allPacks: Pack[] = rawPacks;

/** Packs of one app as written in the pack files, required packs first. */
export function basePacksForApp(appId: string): Pack[] {
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

function withOverrides(pack: Pack, overrides: ReadonlyMap<string, string[]>): Pack {
  if (overrides.size === 0) return pack;
  return {
    ...pack,
    lessons: pack.lessons.map((lesson) => ({
      ...lesson,
      items: lesson.items.map((item) => {
        const keys = overrides.get(cardKey(pack, item));
        return keys ? { ...item, keys, source: 'config' as const } : item;
      }),
    })),
  };
}

const effectiveCache = new Map<string, { version: number; packs: Pack[] }>();

/**
 * Packs of one app as the user sees them: the pack files, with keys replaced
 * where the applied config maps an action differently, followed by the pack
 * generated from the config's own mappings.
 */
export function packsForApp(appId: string): Pack[] {
  const version = getConfigVersion();
  const cached = effectiveCache.get(appId);
  if (cached && cached.version === version) return cached.packs;
  const config = getActiveConfig(appId);
  let packs = basePacksForApp(appId);
  if (config) {
    packs = packs.map((pack) => withOverrides(pack, config.overrides));
    if (config.myPack) packs = [...packs, config.myPack];
  }
  effectiveCache.set(appId, { version, packs });
  return packs;
}

export function getPack(appId: string, packId: string): Pack | undefined {
  return packsForApp(appId).find((pack) => pack.id === packId);
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
  const placeholders = { ...getApp(appId)?.placeholders, ...getActiveConfig(appId)?.placeholders };
  return item.keys.map((keys) => expandPlaceholders(parseKeys(keys), placeholders));
}
