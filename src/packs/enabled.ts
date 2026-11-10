import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting, settingNames } from '../store/settings';
import { cardKey, packsForApp } from './registry';
import type { Pack, PackItem } from './schema';

/** A pack with no plugin repository is part of the app itself and cannot be turned off. */
export function isBuiltIn(pack: Pack): boolean {
  return pack.repo === undefined;
}

/**
 * The packs in use: built-in packs, plus chosen packs whose required packs are
 * also in use. Order is the curriculum order (required packs first).
 */
export function resolveEnabledPacks(appId: string, chosenIds: readonly string[]): Pack[] {
  const enabled: Pack[] = [];
  for (const pack of packsForApp(appId)) {
    const wanted = isBuiltIn(pack) || chosenIds.includes(pack.id);
    const requirementsMet = pack.requires.every((id) => enabled.some((p) => p.id === id));
    if (wanted && requirementsMet) enabled.push(pack);
  }
  return enabled;
}

export async function loadEnabledPacks(appId: string): Promise<Pack[]> {
  return resolveEnabledPacks(appId, await getSetting<string[]>(settingNames.enabledPacks(appId), []));
}

/** Live list of enabled packs; `undefined` while loading. */
export function useEnabledPacks(appId: string): Pack[] | undefined {
  return useLiveQuery(() => loadEnabledPacks(appId), [appId]);
}

/** Every item of the given packs, by card key. */
export function indexItems(packs: Pack[]): Map<string, { pack: Pack; item: PackItem }> {
  const index = new Map<string, { pack: Pack; item: PackItem }>();
  for (const pack of packs) {
    for (const lesson of pack.lessons) {
      for (const item of lesson.items) index.set(cardKey(pack, item), { pack, item });
    }
  }
  return index;
}
