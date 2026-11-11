import { APPS } from '../apps';
import { setActiveConfig } from '../config/active';
import type { Recording } from '../config/recording';
import { resolveConfig, type ResolvedConfig } from '../config/resolve';
import { resolveEnabledPacks } from '../packs/enabled';
import { cardKey, lessonKey } from '../packs/registry';
import { db } from './db';
import { getSetting, settingNames } from './settings';

/** An applied config: its text, and what running it recorded. */
export interface StoredConfig {
  source: string;
  recording: Recording;
  appliedAt: number;
}

export function getStoredConfig(appId: string): Promise<StoredConfig | null> {
  return getSetting<StoredConfig | null>(settingNames.config(appId), null);
}

/**
 * Puts every stored config into effect. Runs before the first render and after
 * an import. The stored recording is resolved against the current pack files,
 * so the Lua VM is not needed here.
 */
export async function loadStoredConfigs(): Promise<void> {
  for (const app of APPS) {
    const stored = await getStoredConfig(app.id);
    setActiveConfig(app.id, stored ? resolveConfig(app.id, stored.recording).active : null);
  }
}

/**
 * Stores a config and puts it into effect: packs for the plugins it installs
 * are turned on, and lessons of the My config pack that gained mappings are
 * reopened. No progress is deleted; a card whose keys change keeps its history.
 */
export async function applyConfig(appId: string, source: string, recording: Recording): Promise<ResolvedConfig> {
  const resolved = resolveConfig(appId, recording);
  const enabledName = settingNames.enabledPacks(appId);
  await db.transaction('rw', [db.settings, db.cards, db.lessons], async () => {
    const stored: StoredConfig = { source, recording, appliedAt: Date.now() };
    await db.settings.put({ name: settingNames.config(appId), value: stored });

    const chosen = new Set(await getSetting<string[]>(enabledName, []));
    for (const plugin of resolved.plugins) {
      if (plugin.packId) chosen.add(plugin.packId);
    }
    await db.settings.put({ name: enabledName, value: [...chosen] });
    setActiveConfig(appId, resolved.active);

    const enabled = new Set(resolveEnabledPacks(appId, [...chosen]).map((pack) => pack.id));
    await db.cards
      .where('app')
      .equals(appId)
      .modify((card) => {
        card.suspended = !enabled.has(card.packId);
      });

    // A finished My config lesson that now holds a mapping without a card has to be taken again.
    const myPack = resolved.active.myPack;
    for (const lesson of myPack?.lessons ?? []) {
      const cards = await db.cards.bulkGet(lesson.items.map((item) => cardKey(myPack!, item)));
      if (cards.some((card) => card === undefined)) await db.lessons.delete(lessonKey(myPack!, lesson));
    }
  });
  return resolved;
}

/** Removes the stored config. Packs go back to their own keys; progress and enabled packs stay. */
export async function removeConfig(appId: string): Promise<void> {
  await db.settings.delete(settingNames.config(appId));
  setActiveConfig(appId, null);
}
