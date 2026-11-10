import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export const DEFAULT_SESSION_CAP = 30;

/** Setting names. Per-app settings are prefixed with the app id. */
export const settingNames = {
  sessionCap: 'sessionCap',
  enabledPacks: (appId: string) => `${appId}/enabledPacks`,
};

export async function getSetting<T>(name: string, fallback: T): Promise<T> {
  const record = await db.settings.get(name);
  return record === undefined ? fallback : (record.value as T);
}

export async function setSetting(name: string, value: unknown): Promise<void> {
  await db.settings.put({ name, value });
}

/** Live value of a setting; `undefined` while it loads. */
export function useSetting<T>(name: string, fallback: T): T | undefined {
  return useLiveQuery(() => getSetting(name, fallback), [name]);
}
