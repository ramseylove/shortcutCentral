import type { Pack } from '../packs/schema';

/** The part of an applied config that changes what packs contain. */
export interface ActiveConfig {
  /** Values for `<leader>` and `<localleader>`. */
  placeholders: Record<string, string>;
  /** Card key -> the keys the config maps that action to. */
  overrides: ReadonlyMap<string, string[]>;
  /** The generated pack of the user's own described mappings, if there are any. */
  myPack: Pack | null;
}

const active = new Map<string, ActiveConfig>();
const listeners = new Set<() => void>();
let version = 0;

export function getActiveConfig(appId: string): ActiveConfig | undefined {
  return active.get(appId);
}

export function setActiveConfig(appId: string, config: ActiveConfig | null): void {
  if (!config && !active.has(appId)) return;
  if (config) active.set(appId, config);
  else active.delete(appId);
  version++;
  listeners.forEach((listener) => listener());
}

/** Changes every time a config is applied or removed. */
export function getConfigVersion(): number {
  return version;
}

export function subscribeConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
