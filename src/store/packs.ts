import { resolveEnabledPacks } from '../packs/enabled';
import { db } from './db';
import { getSetting, settingNames } from './settings';

/**
 * Turns a plugin pack on or off. Disabling suspends the pack's cards (and those
 * of packs that require it); enabling restores them. History is never deleted.
 */
export async function setPackEnabled(appId: string, packId: string, enabled: boolean): Promise<void> {
  const name = settingNames.enabledPacks(appId);
  await db.transaction('rw', [db.settings, db.cards], async () => {
    const chosen = new Set(await getSetting<string[]>(name, []));
    if (enabled) chosen.add(packId);
    else chosen.delete(packId);
    await db.settings.put({ name, value: [...chosen] });

    const active = new Set(resolveEnabledPacks(appId, [...chosen]).map((pack) => pack.id));
    await db.cards
      .where('app')
      .equals(appId)
      .modify((card) => {
        card.suspended = !active.has(card.packId);
      });
  });
}
